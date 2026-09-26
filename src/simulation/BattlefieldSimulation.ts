import {
  type BattlefieldState,
  type SoldierState,
  type SquadState,
  type Vec2,
  type ConstructionRequest,
  distance,
  polylineLength,
} from '../core/types';
import { addSquad } from './createBattlefield';
import { SquadNavigation } from '../navigation/SquadNavigation';
import {FormationWalker} from '../navigation/FormationWalker';
import {routeJoin} from '../navigation/RouteJoin';
import { TerrainSystem } from '../terrain/TerrainSystem';
import { TrenchSystem } from '../construction/TrenchSystem';
import {MIN_TRENCH_LENGTH} from '../construction/ConstructionReadout';
import {reservedConstructionTeam} from '../construction/WorkAssignments';
import {atDistance,simplifyRoute} from '../core/Polyline';
import { GarrisonSystem } from '../garrison/GarrisonSystem';
import { OperationSystem } from '../operations/OperationSystem';
import { factionOf } from '../operations/types';
import {EngineerSystem} from '../construction/EngineerSystem';
import {prepareActions,ownsAction} from '../combat/Reactions';
import {coordinateMovement} from '../combat/Cooperation';
import type {TacticalIntent} from '../combat/types';
import {updateCasualtyCare} from '../combat/Casualties';
import {stepSupport} from '../combat/SupportWeapons';
import {stepReplacements} from '../operations/Replacements';
import {stepBuildings} from './BuildingSystem';
import {stepSelfPreservation} from './SelfPreservation';
import {initializeEquipment,squadHasEquipment} from '../combat/Equipment';
import {reconcileSupplyDemands} from '../garrison/SupplyDemand';
import {resumeWorkChoices} from '../construction/ResumeWork';
import {observeTrenches,knownTrenchNetworks} from '../operations/TrenchIntelligence';
import {prepareRaid,TrenchRaidSystem} from '../operations/TrenchRaid';
import {previewAssault,sameAssaultPreview,commitAssault,assaultSquad,detachedFromFormation} from '../operations/AssaultPlan';

export class BattlefieldSimulation {
  readonly stepCosts={actions:0,movement:0,earthworks:0,garrison:0,combat:0,terrainIntel:0,support:0,total:0};
  prepareOrder(ids:number[],intent:TacticalIntent,target:Vec2,networkId?:number,includeWeaponCrews=false,sourcePositionIds?:number[]):number {
    if(this.commandsLocked||![target.x,target.z].every(Number.isFinite))return 0;
    const staffing=includeWeaponCrews?'all-in':'normal';
    const chosen=this.state.squads.filter(q=>ids.includes(q.id)&&q.faction!=='enemy'&&this.state.soldiers.some(s=>s.squadId===q.id&&s.health>0&&s.needs?.life!=='dead'));
    const orders=this.state.preparedOrders??=[];
    const known=intent==='assault'?knownTrenchNetworks(this.state).find(n=>n.id===networkId):undefined;
    const reserved=orders.filter(o=>o.networkId===networkId&&o.releasedAt===undefined&&o.raid).map(o=>o.raid!.entry);
    let prepared=0;
    for(const [i,q] of chosen.entries()){
      const old=orders.findIndex(o=>o.squadId===q.id);if(old>=0){if(orders[old].releasedAt!==undefined)continue;orders.splice(old,1);}
      const preview=intent==='assault'?previewAssault(this.state,[q.id],staffing,sourcePositionIds):undefined;
      const participants=preview?this.state.soldiers.filter(s=>preview.participantIds.includes(s.id)):[];
      const origin=participants.length?{...q,x:participants.reduce((n,s)=>n+s.x,0)/participants.length,z:participants.reduce((n,s)=>n+s.z,0)/participants.length}:q;
      const raid=known&&participants.length?prepareRaid(this.state,origin,known,i,chosen.length,reserved):undefined;
      if(raid){reserved.push(raid.entry);raid.startingAble=preview?.participantIds.length??raid.startingAble;}
      orders.push({squadId:q.id,intent,target:{...this.terrain.clampToWorld(target)},networkId,preparedAt:this.state.elapsed,...(raid?{raid}:{}),...(preview?{assault:{staffing,sourcePositionIds,preview,participantIds:preview.participantIds.slice(),phase:'preview' as const}}:{})});prepared++;
    }
    return prepared;
  }
  lastSignalReason='';
  signalPrepared():number {
    if(this.commandsLocked)return 0;
    const orders=(this.state.preparedOrders??[]).filter(o=>o.releasedAt===undefined);let changed=false;
    for(const o of orders)if(o.assault){const preview=previewAssault(this.state,[o.squadId],o.assault.staffing,o.assault.sourcePositionIds);if(!sameAssaultPreview(preview,o.assault.preview)){o.assault.preview=preview;o.assault.participantIds=preview.participantIds.slice();o.assault.reviewRequired=true;delete o.signalAt;changed=true;}}
    if(changed){this.lastSignalReason='Personnel or consequences changed · review the preview, then confirm GO again';return 0;}
    const eligible=orders.filter(o=>!o.assault||o.assault.participantIds.length);
    for(const o of eligible){o.signalAt=this.state.elapsed;if(o.assault)delete o.assault.reviewRequired;}
    this.lastSignalReason=eligible.length?`GO · ${eligible.length} detachments receive the signal next tick`:'No eligible participants';return eligible.length;
  }
  cancelPrepared(ids?:number[],stop=true):void {
    const cancelled=(this.state.preparedOrders??[]).filter(o=>!ids||ids.includes(o.squadId));
    this.state.preparedOrders=(this.state.preparedOrders??[]).filter(o=>ids&&!ids.includes(o.squadId));
    for(const o of cancelled){const q=this.state.squads.find(q=>q.id===o.squadId);if(q?.orderNote==='WAIT FOR SIGNAL')delete q.orderNote;}
    // Cancelling the marker must also stop its already-released intention.
    // Remove the records first: Hold also clears prepared intentions.
    if(stop){
      for(const o of cancelled)if(o.assault&&o.releasedAt!==undefined)for(const s of this.state.soldiers.filter(s=>o.assault!.participantIds.includes(s.id))){s.assaultHold=this.state.elapsed;delete s.formationTravel;s.action='holding · assault cancelled';}
      const legacy=cancelled.filter(o=>!o.assault&&o.releasedAt!==undefined);if(legacy.length)this.issueHold(legacy.map(o=>o.squadId));
    }
  }
  lastResumeReason='Choose a local worksite';
  previewResume(squadId:number,requested?:number){const q=this.state.squads.find(q=>q.id===squadId);return q?resumeWorkChoices(this.state,this.garrisons.network,q,t=>this.engineers.workFaces(t,q),requested):{reason:'Select a formation',candidates:[]};}
  readonly terrain: TerrainSystem;
  readonly trenches: TrenchSystem;
  readonly navigation: SquadNavigation;
  private readonly formationWalker:FormationWalker;
  private readonly raids:TrenchRaidSystem;
  readonly garrisons: GarrisonSystem;
  readonly operations: OperationSystem;
  readonly engineers:EngineerSystem;
  scheduleNavigation?: (start:Vec2,goal:Vec2,done:(route:Vec2[])=>void)=>void;
  private routeRevision=new Map<number,number>();
  private worldRevision=0;
  private coverRevision=-1;
  get commandsLocked(): boolean { return Boolean(this.state.operation && this.state.operation.status !== 'active'); }
  get awaitingSupplyDecision(): boolean { return Boolean(this.state.living?.garrisons.some(g=>g.cutoff==='decision')); }

  setSpeed(speed: number): void {
    if(this.commandsLocked||this.awaitingSupplyDecision||![0,1,2,5].includes(speed))return;
    this.state.simSpeed=speed;
  }

  constructor(public state: BattlefieldState) {
    initializeEquipment(state);
    this.terrain = new TerrainSystem(state);
    this.trenches = new TrenchSystem(state);
    this.navigation = new SquadNavigation(this.terrain);
    this.formationWalker=new FormationWalker(this.terrain,this.navigation);
    this.raids=new TrenchRaidSystem(this.navigation,this.formationWalker);
    this.garrisons = new GarrisonSystem(state,this.terrain,this.navigation,this.trenches);
    this.operations = new OperationSystem(state, this.terrain);
    this.engineers=new EngineerSystem(state,this.navigation,this.trenches);
    this.resumeSavedOrders();
  }

  replaceState(state: BattlefieldState): void {
    initializeEquipment(state);
    this.worldRevision++;this.routeRevision.clear();
    this.coverRevision=-1;
    this.state = state;
    this.terrain.setState(state);
    this.trenches.setState(state);
    this.garrisons.replaceState(state);
    this.operations.replaceState(state);
    this.engineers.replaceState(state);
    this.resumeSavedOrders();
  }

  private resumeSavedOrders():void {
    if(this.commandsLocked)return;
    for(const squad of this.state.squads)if(squad.order.type==='occupy-trench'&&squad.order.trenchId&&!this.state.soldiers.some(s=>s.squadId===squad.id&&(s.garrisonId!==undefined||detachedFromFormation(this.state,s))))this.garrisons.assign([squad.id],squad.order.trenchId);
    for(const squad of this.state.squads)if(squad.order.type==='construct-trench'&&squad.workStarted===undefined&&squad.order.trenchId&&!this.state.soldiers.some(s=>s.squadId===squad.id&&detachedFromFormation(this.state,s)))this.startConstruction(squad,squad.order.trenchId);
    for(const squad of this.state.squads)if(squad.order.type==='move'&&squad.order.target&&!squad.route.length){if(squad.order.drawnPath)this.planDrawnApproach(squad);else this.planSquadRoute(squad,squad.order.target);}
  }

  step(dt: number): void {
    if(!Number.isFinite(dt)||dt<=0)return;
    const speed=this.state.simSpeed;
    if(![1,2,5].includes(speed))return;
    // Fast-forward repeats the caller's fixed tick; it must not change combat,
    // movement, logistics or duty timing by using a coarser simulation step.
    for(let tick=0;tick<speed;tick++){
      if(this.commandsLocked)return;
      // A decision or result raised inside this batch stops all remaining ticks.
      if(this.awaitingSupplyDecision){this.state.simSpeed=0;return;}
      if(this.state.simSpeed<=0)return;
      this.stepTick(dt);
      if(this.state.simSpeed<speed)return;
    }
  }

  /** Browser scheduler spreads fast-forward ticks across animation frames. */
  stepFixed():void {
    if(this.commandsLocked||this.state.simSpeed<=0)return;
    if(this.awaitingSupplyDecision){this.state.simSpeed=0;return;}
    this.stepTick(.05);
  }

  private stepTick(dt:number):void {
    const started=performance.now();let phase=started;
    this.state.elapsed += dt;
    // Release all signalled intentions on this fixed tick; normal physical reactions still own movement.
    const released=(this.state.preparedOrders??[]).filter(o=>o.signalAt!==undefined&&o.releasedAt===undefined);
    // Validate the entire signal against one pre-release world. Releasing the
    // first squad must not make a second squad's own confirmed staffing stale.
    const checks=released.filter(o=>o.assault).map(o=>({o,preview:previewAssault(this.state,[o.squadId],o.assault!.staffing,o.assault!.sourcePositionIds)}));
    const changed=checks.some(({o,preview})=>!sameAssaultPreview(preview,o.assault!.preview)||!preview.participantIds.length);
    if(changed){
      for(const o of released)delete o.signalAt;
      for(const {o,preview} of checks){o.assault!.preview=preview;o.assault!.participantIds=preview.participantIds.slice();o.assault!.reviewRequired=true;}
    }
    for(const o of released){
      if(changed)continue;
      if(o.assault){
        const q=this.state.squads.find(q=>q.id===o.squadId)!;commitAssault(this.state,q,o.assault,o.raid?.entry??o.target);
        o.assault.march!.route=this.navigation.planFormation(o.assault.march!,o.assault.march!.order.target!);
      }else this.issueTactical([o.squadId],o.intent,o.raid?.entry??o.target,true);
      o.releasedAt=this.state.elapsed;if(o.raid){o.raid.startingAble=o.assault?.participantIds.length??o.raid.startingAble;o.raid.phase='approach';o.raid.reason='GO · approaching assigned trench entry';}
    }
    if(released.length)this.state.preparedOrders=[...(this.state.preparedOrders??[]).filter(o=>!released.some(r=>r.squadId===o.squadId)),...released];
    prepareActions(this.state,this.terrain,this.navigation,dt);
    updateCasualtyCare(this.state,this.terrain,this.navigation,dt);
    stepSelfPreservation(this.state,this.terrain,this.navigation,dt);
    stepBuildings(this.state,this.terrain,this.navigation,dt);
    for(const q of this.state.squads)if(q.orderNote==='Leaving building'&&!this.state.soldiers.some(s=>s.squadId===q.id&&s.building&&s.needs?.life==='active')){delete q.orderNote;if(q.order.type==='move'&&q.order.target){if(q.order.drawnPath)this.planDrawnApproach(q);else this.planSquadRoute(q,q.order.target);}}
    coordinateMovement(this.state);
    this.stepCosts.actions=performance.now()-phase;phase=performance.now();
    this.updateSquadCenters();
    this.engineers.beginFrame();
    this.updateOrders(dt);
    this.engineers.finishFrame(dt);
    this.stepCosts.movement=performance.now()-phase;phase=performance.now();
    this.trenches.update(dt);
    for(const squad of this.state.squads)if(squadHasEquipment(this.state,squad,'tools')&&squad.order.type==='hold'&&squad.constructionQueue?.length&&!this.state.soldiers.some(s=>s.squadId===squad.id&&detachedFromFormation(this.state,s))){const job=squad.constructionQueue.shift()!;if(typeof job==='number'||job.kind==='trench')this.startConstruction(squad,typeof job==='number'?job:job.id,true);}
    this.terrain.syncModifications();
    this.stepCosts.earthworks=performance.now()-phase;phase=performance.now();
    stepReplacements(this.state,dt);
    this.garrisons.step(dt);
    for(const t of this.state.living!.trucks)for(const id of t.passengers??[]){const p=this.state.soldiers.find(s=>s.id===id);if(p){p.x=t.x;p.z=t.z;}}
    if(this.coverRevision!==this.terrain.revision){
      // Excavation changes protection even for a stationary or pinned worker.
      // Moving soldiers already update their cover; resample everyone only when
      // the terrain changes, or on the first tick after loading a campaign.
      for(const s of this.state.soldiers)s.cover=this.terrain.coverAt(s.x,s.z);
      this.coverRevision=this.terrain.revision;
    }
    // Care and transport move people outside the normal formation/duty walker.
    // Keep their derived protection current so loading never changes it.
    for(const s of this.state.soldiers)if(s.combat?.wound||s.combat?.careTask||s.action==='arriving replacement')s.cover=this.terrain.coverAt(s.x,s.z);
    this.updateSquadCenters();
    this.stepCosts.garrison=performance.now()-phase;phase=performance.now();
    this.operations.step(dt, (ids, target) => this.issueMove(ids, target, true), ids => this.issueHold(ids, true),(ids,trench)=>this.garrisons.assign(ids,trench));
    this.stepCosts.combat=performance.now()-phase;phase=performance.now();
    observeTrenches(this.state,this.terrain,this.garrisons.network);
    this.raids.secure(this.state,this.garrisons);
    this.stepCosts.terrainIntel=performance.now()-phase;phase=performance.now();
    stepSupport(this.state,this.terrain);
    reconcileSupplyDemands(this.state);
    this.stepCosts.support=performance.now()-phase;this.stepCosts.total=performance.now()-started;
  }

  issueMove(squadIds: number[], target: Vec2, enemyOrder = false): void {
    if(this.commandsLocked)return;
    this.cancelPrepared(squadIds,false);
    const building=this.terrain.buildingAt(target);
    if(building!==undefined){this.issueBuilding(squadIds,building,0,enemyOrder);return;}
    const clamped = this.terrain.clampToWorld(target);
    const selected = this.state.squads.filter(squad => squad.soldierIds.length>0&&squadIds.includes(squad.id) && (enemyOrder || factionOf(squad) === 'player'));
    const columns = Math.ceil(Math.sqrt(selected.length));
    for (const [index, squad] of selected.entries()) {
      this.pauseConstruction(squad);
      const destination = this.navigation.freeDestination({x:clamped.x + (index % columns - (columns-1)/2)*24,z:clamped.z + (Math.floor(index/columns)-(Math.ceil(selected.length/columns)-1)/2)*24});
      squad.order = { type: 'move', target: destination, issuedAt: this.state.elapsed };
      squad.formationHeading = Math.atan2(destination.x-squad.x,destination.z-squad.z);
      this.planSquadRoute(squad,destination);
      this.clearTrenchAssignments(squad);
    }
  }

  issueBuilding(squadIds:number[],id:number,floor:0|1=0,enemyOrder=false):void {
    if(this.commandsLocked||!this.terrain.buildings[id])return;
    this.issueHold(squadIds,enemyOrder);
    for(const q of this.state.squads.filter(q=>squadIds.includes(q.id)&&(enemyOrder||factionOf(q)==='player'))){
      this.pauseConstruction(q);this.clearTrenchAssignments(q);
      q.order={type:'hold',issuedAt:this.state.elapsed,building:{id,floor}};
      q.movementState='idle';q.orderNote='Enter through doors; occupy temporary firing positions';
    }
  }

  issueTactical(squadIds:number[],intent:TacticalIntent,target:Vec2,releasing=false):void {
    if(this.commandsLocked||!Number.isFinite(target.x)||!Number.isFinite(target.z))return;
    if(intent==='assault'&&!releasing){
      const known=knownTrenchNetworks(this.state).find(n=>n.sections.some(s=>distance(target,{x:(s.points[0].x+s.points[1].x)/2,z:(s.points[0].z+s.points[1].z)/2})<12));
      this.prepareOrder(squadIds,intent,target,known?.id);return;
    }
    if(intent==='observe'||intent==='suppress')this.issueHold(squadIds);else this.issueMove(squadIds,target);
    for(const q of this.state.squads.filter(q=>squadIds.includes(q.id)&&factionOf(q)==='player')){
      q.order.intent=intent;q.order.target={...target};
      if(intent==='observe')for(const s of this.soldiersFor(q))s.heading=Math.atan2(target.x-s.x,target.z-s.z);
    }
  }
  setPushThrough(squadIds:number[]):void {
    if(this.commandsLocked)return;
    for(const q of this.state.squads.filter(q=>squadIds.includes(q.id)&&factionOf(q)==='player'))q.order.pushThrough=!q.order.pushThrough;
  }

  issueHold(squadIds: number[], enemyOrder=false): void {
    if(this.commandsLocked)return;
    this.cancelPrepared(squadIds,false);
    for (const squad of this.state.squads) {
      if (!squad.soldierIds.length||!squadIds.includes(squad.id) || !enemyOrder && factionOf(squad) === 'enemy') continue;
      const garrison=this.state.living!.garrisons.find(g=>g.squadIds.includes(squad.id));
      if(garrison){
        // Hold clears a tactical override, not the standing defense assignment.
        // Preserve actual entry/duty routes, relief, deliveries and weapon crews.
        // Replacing the order object also invalidates stale navigation callbacks.
        squad.order={type:'occupy-trench',trenchId:squad.order.trenchId??garrison.trenchId,issuedAt:this.state.elapsed};
        squad.route=[];squad.routeIndex=0;squad.movementState='entrenching';squad.orderNote=undefined;
        continue;
      }
      this.pauseConstruction(squad);
      squad.orderNote=undefined;
      squad.order = { type: 'hold', issuedAt: this.state.elapsed };
      squad.route = [];
      squad.routeIndex = 0;
      squad.movementState = 'idle';
      this.clearTrenchAssignments(squad);
    }
  }

  issueOccupyNearest(squadIds: number[],trenchId?:number): number | undefined {
    if(this.commandsLocked)return;
    squadIds = squadIds.filter(id => this.state.squads.some(s => s.id === id && factionOf(s) === 'player'));
    const squads=this.state.squads.filter(s=>squadIds.includes(s.id));if(!squads.length)return;
    this.garrisons.network.sync(this.state.trenches);
    const proximity=(id:number)=>{const component=this.garrisons.network.component(id);return component===undefined?Infinity:this.garrisons.network.nearest(squads[0],component)?.distance??Infinity;};
    const candidates=this.state.trenches.filter(t=>trenchId===undefined||t.id===trenchId).sort((a,b)=>proximity(a.id)-proximity(b.id));
    for(const t of candidates)if(this.garrisons.assign(squadIds,t.id)){this.cancelPrepared(squadIds,false);for(const squad of squads)this.pauseConstruction(squad);return t.id;}
    return undefined;
  }

  createTrench(points: Vec2[], engineerSquadId?: number): number | undefined {
    if(this.commandsLocked)return;
    if (points.length < 2||points.length>4096||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z))) return undefined;
    const bounded = points.map((point) => this.terrain.clampToWorld(point));
    const validEngineer = this.state.squads.find((squad) => squad.id === engineerSquadId && squadHasEquipment(this.state,squad,'tools') && factionOf(squad) === 'player');
    if(validEngineer&&reservedConstructionTeam(this.state,validEngineer.id))return undefined;
    for(let i=1;i<bounded.length;i++){
      const a=bounded[i-1],b=bounded[i],n=Math.max(1,Math.ceil(distance(a,b)/2));
      for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,z=a.z+(b.z-a.z)*j/n;if(this.terrain.obstacleAt(x,z,4)||this.terrain.groundTypeAt(x,z)==='river')return undefined;}
    }
    if(polylineLength(bounded)<MIN_TRENCH_LENGTH)return undefined;
    const id=this.trenches.request({kind:'trench',points:bounded,engineerSquadId:validEngineer?.id})!;
    const trench = this.state.trenches.find(t=>t.id===id)!;
    // Smoothing is also checked: an inside corner must not cut through a footprint.
    for(let d=0;d<=polylineLength(trench.points);d+=2){const p=atDistance(trench.points,d);if(this.terrain.obstacleAt(p.x,p.z,4)||this.terrain.groundTypeAt(p.x,p.z)==='river'){this.state.trenches.pop();return undefined;}}
    this.terrain.syncModifications();
    if (validEngineer) {
      if(validEngineer.order.type==='construct-trench'){
        (validEngineer.constructionQueue??=[]).push(trench.id);trench.status='planned';trench.progress=0;
      }else this.startConstruction(validEngineer,trench.id);
    }
    return trench.id;
  }

  assignGarrison(squadIds:number[],networkId:number):boolean{return this.issueOccupyNearest(squadIds,networkId)!==undefined;}
  defendArea(squadIds:number[],frontage:Vec2[]):number|undefined {
    if(this.commandsLocked||frontage.length<2||frontage.length>4096||frontage.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z))||polylineLength(frontage)<5)return;
    this.garrisons.network.sync(this.state.trenches);
    const center=atDistance(frontage,polylineLength(frontage)/2),hit=this.garrisons.network.nearest(center);
    if(!hit||hit.distance>40)return;
    const edge=this.garrisons.network.edges[hit.edge],trench=this.state.trenches.find(t=>this.garrisons.network.component(t.id)===this.garrisons.network.nodes[edge.a].component);
    if(!trench||!this.assignGarrison(squadIds,trench.id))return;
    const g=this.state.living!.garrisons.find(g=>g.squadIds.some(id=>squadIds.includes(id)))!;
    g.frontage=frontage.map(p=>({...p}));g.name=`Defensive area ${g.id}`;g.nextDecision=0;
    return g.id;
  }
  requestConstruction(request:ConstructionRequest):number|undefined {
    if(this.commandsLocked)return;
    if(request.kind==='trench')return this.createTrench(request.points,request.engineerSquadId);
    return this.garrisons.requestFacility(request.garrisonId,request.facilityKind,request.position,request.origin,request.facing,request.explicit??true,request.guns);
  }

  createCrater(point: Vec2, radius = 24, depth = 5): number {
    const bounded = this.terrain.clampToWorld(point);
    const id = this.state.nextEntityId++;
    this.state.craters.push({ id, ...bounded, radius, depth });
    this.terrain.syncModifications();
    return id;
  }

  spawnStressSoldiers(targetTotal = 240): number {
    while (this.state.soldiers.length < targetTotal) {
      const index = this.state.squads.length + 1;
      const column = index % 8;
      const row = Math.floor(index / 8) % 8;
      addSquad(this.state, 'rifle', Math.min(10, targetTotal - this.state.soldiers.length), -900 + column * 72, -650 + row * 78, `Reserve ${index}`);
    }
    return this.state.soldiers.length;
  }

  private updateOrders(dt: number): void {
    this.formationWalker.begin(this.state);
    const soldiersById = new Map(this.state.soldiers.map((soldier) => [soldier.id, soldier]));
    for (const squad of this.state.squads) {
      const soldiers = squad.soldierIds.map((id) => soldiersById.get(id)).filter((soldier): soldier is SoldierState => Boolean(soldier)&&!soldier!.personalArea&&!detachedFromFormation(this.state,soldier!)&&(!soldier!.needs||soldier!.needs.life==='active'));
      if (soldiers.length === 0) continue;
      if (squad.order.type === 'move') this.updateMovingSquad(squad, soldiers, dt);
      else if (squad.order.type === 'occupy-trench') squad.movementState='entrenching';
      else if (squad.order.type === 'construct-trench') this.updateEngineerSquad(squad, soldiers, dt);
      else {
        squad.movementState = 'idle';
        soldiers.forEach((soldier) => {
          if(!ownsAction(soldier,'order'))return;
          soldier.action = 'holding';
          soldier.cover = this.terrain.coverAt(soldier.x, soldier.z);
        });
      }
    }
    for(const o of this.state.preparedOrders??[]){
      const a=o.assault,q=this.state.squads.find(q=>q.id===o.squadId);if(!a?.march||a.phase==='secured'||o.releasedAt===undefined||!q)continue;
      const people=this.state.soldiers.filter(s=>a.participantIds.includes(s.id)&&s.needs?.life==='active');if(!people.length)continue;
      const detached=assaultSquad(q,a);detached.x=people.reduce((n,s)=>n+s.x,0)/people.length;detached.z=people.reduce((n,s)=>n+s.z,0)/people.length;
      if(detached.order.type==='move')this.updateMovingSquad(detached,people,dt);
      else for(const s of people)if(ownsAction(s,'order'))s.action='holding assault objective';
      a.march={x:detached.x,z:detached.z,order:detached.order,route:detached.route,routeIndex:detached.routeIndex,movementState:detached.movementState,orderNote:detached.orderNote,tactics:detached.tactics};
      if(detached.order.type==='hold')a.phase='holding';
    }
  }

  private updateMovingSquad(squad: SquadState, soldiers: SoldierState[], dt: number): void {
    if(this.raids.step(this.state,squad,soldiers,dt))return;
    if(squad.movementState==='planning'||!squad.route.length&&!squad.order.drawnPath)return;
    if(squad.order.drawnPath){this.followDrawnPath(squad,soldiers,dt);return;}
    if (this.formationWalker.step(this.state,squad,soldiers,dt)) {
      squad.order = { type: 'hold', issuedAt: this.state.elapsed };
      squad.route = [];
      squad.routeIndex = 0;
      squad.movementState = 'forming';
    }
  }

  private updateEngineerSquad(squad: SquadState, soldiers: SoldierState[], dt: number): void {
    if(!this.state.trenches.some(t=>t.id===squad.order.trenchId)){this.issueHold([squad.id]);return;}
    this.engineers.step(squad,soldiers,dt,(s,target,seconds,action)=>this.moveSoldier(s,target,seconds,action));
  }

  private moveSoldier(soldier: SoldierState, target: Vec2, dt: number, action: string): void {
    if(!ownsAction(soldier,'order'))return;
    if(distance(soldier,target)<.12){soldier.cover=this.terrain.coverAt(soldier.x,soldier.z);return;}
    this.formationWalker.walk(soldier,target,dt);
    if(soldier.action==='advancing')soldier.action=action;
  }

  private updateSquadCenters(): void {
    const soldiersById = new Map(this.state.soldiers.map((soldier) => [soldier.id, soldier]));
    for (const squad of this.state.squads) {
      // Casualties stay where they fell; they cannot anchor the survivors' route or flag.
      let soldiers = squad.soldierIds.map((id) => soldiersById.get(id)).filter((soldier): soldier is SoldierState => Boolean(soldier) && !soldier!.personalArea && soldier!.health > 0 && (!soldier!.needs || soldier!.needs.life === 'active'));
      const home=soldiers.filter(s=>!detachedFromFormation(this.state,s));if(home.length)soldiers=home;
      if (soldiers.length === 0) continue;
      squad.x = soldiers.reduce((sum, soldier) => sum + soldier.x, 0) / soldiers.length;
      squad.z = soldiers.reduce((sum, soldier) => sum + soldier.z, 0) / soldiers.length;
    }
  }

  private soldiersFor(squad: SquadState): SoldierState[] {
    const ids = new Set(squad.soldierIds);
    return this.state.soldiers.filter((soldier) => ids.has(soldier.id));
  }

  private clearTrenchAssignments(squad: SquadState): void {
    this.garrisons.release(squad.id);
    for (const soldier of this.soldiersFor(squad)) {
      delete soldier.assaultHold;
      delete soldier.formationTravel;
      if(soldier.combat?.careTask){delete soldier.combat.careTask;soldier.combat.nextCareReview=this.state.elapsed+15;}
      delete soldier.trenchId;
      delete soldier.trenchSlot;
      delete soldier.trenchTravel;
      delete soldier.trenchAlong;
      delete soldier.pathTravel;
    }
  }
  resumeConstruction(squadIds:number[],requestedTrenchId?:number):number {
    if(this.commandsLocked)return 0;
    this.lastResumeReason='Select a fit formation with tools';
    let count=0;
    for(const squad of this.state.squads.filter(s=>squadIds.includes(s.id)&&(squadHasEquipment(this.state,s,'tools')||requestedTrenchId!==undefined)&&factionOf(s)==='player')){
      if(squad.order.type==='construct-trench'){this.lastResumeReason='Already working · inspect Construction for its current fronts';continue;}
      const {candidates,reason}=this.previewResume(squad.id,requestedTrenchId);this.lastResumeReason=reason||'Local worksite has no safe approach';
      for(const {trench:target} of candidates)if(this.startConstruction(squad,target.id)){
        squad.constructionQueue=candidates.filter(c=>c.trench.id!==target.id&&c.trench.engineerSquadId===squad.id).map(c=>c.trench.id);
        this.lastResumeReason=`Resume local trench ${target.id} · ${Math.round(distance(squad,candidates.find(c=>c.trench.id===target.id)!.point))} m to work face`;
        count++;break;
      }
    }
    return count;
  }
  private pauseConstruction(squad:SquadState):void {
    const stillWorking=(id:number)=>this.state.squads.some(q=>q!==squad&&q.order.type==='construct-trench'&&(q.order.trenchId===id||q.engineerWork?.crews.some(c=>c.trenchId===id)));
    for(const job of [squad.order.type==='construct-trench'?squad.order.trenchId:undefined,...(squad.constructionQueue??[])]){const id=typeof job==='number'?job:job?.kind==='trench'?job.id:undefined;const trench=this.state.trenches.find(t=>t.id===id);if(trench&&trench.status!=='complete'&&!stillWorking(trench.id))trench.status='planned';}
    for(const t of this.state.trenches)if(t.engineerSquadId===squad.id&&t.status==='building'&&!stillWorking(t.id))t.status='planned';
    squad.constructionQueue=[];squad.workStarted=false;delete squad.engineerWork;squad.orderNote=undefined;
  }
  private startConstruction(squad:SquadState,trenchId:number,preservePreview=false):boolean {
    const trench=this.state.trenches.find(t=>t.id===trenchId);if(!trench||trench.status==='complete')return false;
    if(!this.engineers.start(squad,trench)){trench.status='planned';return false;}
    if(!preservePreview)this.cancelPrepared([squad.id],false);
    this.clearTrenchAssignments(squad);
    return true;
  }
  issueDrawnPath(squadIds:number[],points:Vec2[],append=false):boolean {
    if(this.commandsLocked)return false;
    if(points.length<2||points.length>4096||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))return false;
    const path=simplifyRoute(points.map(p=>this.terrain.clampToWorld(p)),.6);
    if(polylineLength(path)<2)return false;
    for(let i=1;i<path.length;i++)if(!this.navigation.segmentClear(path[i-1],path[i],1.3))return false;
    const selected=this.state.squads.filter(s=>s.soldierIds.length>0&&squadIds.includes(s.id)&&factionOf(s)==='player');if(!selected.length)return false;
    for(const squad of selected){const prior=append?squad.order.drawnPath:undefined;if(prior&&!this.navigation.segmentClear(prior.at(-1)!,path[0],1.3))return false;}
    let endOffset=0;
    this.cancelPrepared(squadIds,false);
    for(const squad of selected){
      const prior=append&&squad.order.drawnPath?squad.order.drawnPath:undefined;
      if(prior){squad.order.drawnPath=[...prior,...path];squad.order.target=path.at(-1);squad.route=squad.movementState==='planning'?[]:squad.order.drawnPath;continue;}
      this.pauseConstruction(squad);
      this.clearTrenchAssignments(squad);
      // The drawn corridor itself is never simplified by global pathfinding.
      squad.order={type:'move',target:path.at(-1),drawnPath:path.map(p=>({...p})),pathEndOffset:endOffset,issuedAt:this.state.elapsed};
      endOffset+=Math.ceil(squad.soldierIds.length/2)*2.5+4;
      this.soldiersFor(squad).forEach(s=>delete s.pathTravel);
      this.planDrawnApproach(squad);
    }
    return true;
  }
  private planDrawnApproach(squad:SquadState):void {
    const order=squad.order,start={x:squad.x,z:squad.z},worldRevision=this.worldRevision;
    this.routeRevision.set(squad.id,(this.routeRevision.get(squad.id)??0)+1);
    squad.route=[];squad.routeIndex=0;squad.movementState='planning';squad.orderNote=undefined;
    const done=(approach:Vec2[])=>{
      if(this.commandsLocked||worldRevision!==this.worldRevision||squad.order!==order||!this.state.squads.includes(squad))return;
      if(!approach.length){squad.order={type:'hold',issuedAt:this.state.elapsed};squad.movementState='idle';squad.orderNote='No reachable approach · draw another start';return;}
      order.drawnPath=[start,...approach,...order.drawnPath!.slice(1)];squad.route=order.drawnPath;squad.movementState='moving';
    };
    if(this.scheduleNavigation)this.scheduleNavigation(start,order.drawnPath![0],done);else done(this.navigation.plan(start,order.drawnPath![0]));
  }
  private followDrawnPath(squad:SquadState,soldiers:SoldierState[],dt:number):void {
    const path=squad.order.drawnPath!,total=polylineLength(path);let finished=true;
    soldiers.forEach((s,i)=>{
      if(!ownsAction(s,'order')){finished=false;return;}
      const end=Math.max(0,total-(squad.order.pathEndOffset??0)-Math.floor(i/2)*2.5);
      let along=Math.min(s.pathTravel??routeJoin(path,s,(a,b)=>this.navigation.segmentClear(a,b,.65))?.along??0,end);
      const center=atDistance(path,along),ahead=atDistance(path,Math.min(total,along+.5));
      const heading=Math.atan2(ahead.x-center.x,ahead.z-center.z),lateral=(i%2?1:-1)*.75;
      const target={x:center.x+Math.cos(heading)*lateral,z:center.z-Math.sin(heading)*lateral};
      const maxAdvance=end;
      if(distance(s,target)<1.1)along=Math.min(end,maxAdvance,along+dt*1.8);
      s.pathTravel=along;
      const p=atDistance(path,along);p.x+=Math.cos(heading)*lateral;p.z-=Math.sin(heading)*lateral;
      if(along<end-.01||distance(s,p)>.5){finished=false;this.moveSoldier(s,p,dt,'following drawn path');}else{s.action='holding';s.cover=this.terrain.coverAt(s.x,s.z);}
    });
    if(finished){squad.order={type:'hold',issuedAt:this.state.elapsed};squad.route=[];squad.movementState='idle';}else squad.movementState='moving';
  }
  private planSquadRoute(squad:SquadState,destination:Vec2):void {
    const order=squad.order,worldRevision=this.worldRevision;squad.orderNote=undefined;
    const revision=(this.routeRevision.get(squad.id)??0)+1;this.routeRevision.set(squad.id,revision);
    squad.route=[];squad.routeIndex=0;squad.movementState='planning';
    const done=(route:Vec2[])=>{
      if(this.commandsLocked||worldRevision!==this.worldRevision||this.routeRevision.get(squad.id)!==revision||!this.state.squads.includes(squad)||squad.order!==order)return;
      squad.route=route.map(p=>this.terrain.clampToWorld(p));squad.routeIndex=0;
      if(route.length)squad.movementState='moving';
      else{squad.movementState='idle';squad.orderNote='Route blocked · destination retained; draw another approach';}
    };
    if(this.scheduleNavigation)this.scheduleNavigation(squad,destination,done);else done(this.navigation.planFormation(squad,destination));
  }
}
