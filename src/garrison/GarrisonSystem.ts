import { distance, type BattlefieldState, type SoldierState, type Vec2 } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import type { SquadNavigation } from '../navigation/SquadNavigation';
import type { TrenchSystem } from '../construction/TrenchSystem';
import { TrenchNetwork } from './TrenchNetwork';
import { initializeLiving, LogisticsSystem } from './LogisticsSystem';
import { CAMPAIGN_HOURS_PER_SECOND, dropCargo, freshNeeds, updateNeeds } from './NeedsSystem';
import { consume, localInventory, total, transfer, transferBounded,carrierCapacity } from './Inventory';
import { observation, RulePolicy } from './GarrisonPolicy';
import { effectiveReadiness, inventory, RESOURCES, type DutyKind, type Facility, type Garrison, type Readiness, type Resource, type PersonalOrder } from './types';
import { GarrisonJobBoard } from './GarrisonJobBoard';
import { firstAvailablePoint } from './DutyReservations';
import {trenchEntrance} from '../core/TrenchGeometry';
import {bankPoint,defensivePost} from './DefensivePositions';
import {ownsAction} from '../combat/Reactions';
import {facilitySiteReason,SUPPORT_WORKS} from '../construction/ConstructionReadout';
import {positionOperator,type WeaponPositionKind} from '../combat/WeaponPositions';
import {facilityFrame,facilityPoint} from '../terrain/SupportGeometry';
import {equipmentOf,hasEquipment,squadHasEquipment} from '../combat/Equipment';
import {postureSpeed} from '../combat/Posture';

const WATCH={routine:.25,alert:.5,'stand-to':.9};
const NIGHT=(hours:number)=>hours%24>=20||hours%24<6;
export class GarrisonSystem {
  readonly network=new TrenchNetwork();
  readonly logistics:LogisticsSystem;
  readonly rulePolicy=new RulePolicy();
  readonly jobBoard=new GarrisonJobBoard();
  /** Only normalized outputs cross this boundary. The simulation always validates assignments. */
  policyActions=new Map<number,{at:number;action:number[];modelId:string}>();
  requestPolicy?: (garrison:Garrison,observation:number[])=>void;
  private cells=new Map<string,SoldierState[]>();
  private approachCache=new Map<string,Vec2[]>();
  private approachRevision='';
  private stepMovementBound=0;
  constructor(private state:BattlefieldState,private terrain:TerrainSystem,private navigation:SquadNavigation,private construction:TrenchSystem){
    initializeLiving(state);this.logistics=new LogisticsSystem(state,terrain);this.network.sync(state.trenches);
  }
  replaceState(state:BattlefieldState):void{this.state=state;initializeLiving(state);this.logistics.replaceState(state);this.network.sync(state.trenches);this.policyActions.clear();this.approachCache.clear();}
  people(g:Garrison):SoldierState[]{return this.state.soldiers.filter(s=>s.garrisonId===g.id);}
  assign(squadIds:number[],trenchId:number):boolean {
    this.network.sync(this.state.trenches);const component=this.network.component(trenchId),trench=this.state.trenches.find(t=>t.id===trenchId);
    if(component===undefined||!trench)return false;
    const chosen=this.state.soldiers.filter(s=>squadIds.includes(s.squadId)&&s.needs?.life!=='dead');if(!chosen.length)return false;
    const side=this.state.squads.find(q=>q.id===chosen[0].squadId)?.faction??'player';
    if(chosen.some(s=>(this.state.squads.find(q=>q.id===s.squadId)?.faction??'player')!==side))return false;
    const w=this.state.living!,existing=w.garrisons.filter(g=>this.network.component(g.trenchId)===component);
    if(existing.some(g=>(g.faction??'player')!==side&&this.people(g).some(s=>s.needs?.life!=='dead')))return false;
    const occupied=this.state.soldiers.filter(s=>s.needs?.life!=='dead'&&existing.some(g=>s.garrisonId===g.id)&&!squadIds.includes(s.squadId)).length;
    const inbound=this.state.operation?.campaign?.replacements?.manifests.filter(m=>!m.returning&&m.stage!=='arrived'&&existing.some(g=>g.squadIds.includes(m.squadId))&&!squadIds.includes(m.squadId)).length??0;
    if(this.network.capacity(component)<occupied+chosen.length+inbound)return false;
    const entrance=trenchEntrance(trench);
    // Validate the whole order before releasing any existing assignments. Only
    // this explicit player order authorizes crossing between separate networks.
    const relocations=new Map<number,NonNullable<ReturnType<GarrisonSystem['relocationRoute']>>>();
    for(const s of chosen){
      if(this.network.corridorContains(s)&&this.componentAt(s)!==component){
        const route=this.relocationRoute(s,component,entrance);if(!route)return false;relocations.set(s.id,route);
      }else if(this.network.corridorContains(s)?!this.network.route(s,entrance,component).length:!this.entryApproach(s,component,entrance))return false;
    }
    let g=existing[0];
    if(!g){g={id:this.state.nextEntityId++,name:`Garrison ${w.garrisons.length+1}`,trenchId,squadIds:[],entrance:{...entrance},forward:this.logistics.forwardPoint(entrance),front:0,readiness:'routine',cache:inventory(),forwardStock:inventory(),nextDecision:0,nextSupport:0,policy:'rules',policyStatus:'Rule-based coordinator',scores:[],cutoff:'clear',watchRequired:0,watchPresent:0,capacity:this.network.capacity(component)};w.garrisons.push(g);}
    if((g.faction??'player')!==side)for(const id of [...g.squadIds])this.release(id);
    if(side==='enemy'||g.faction!==undefined)g.faction=side;
    for(const id of squadIds){const squad=this.state.squads.find(s=>s.id===id);if(!squad)continue;this.release(id);g.squadIds.push(id);squad.order={type:'occupy-trench',trenchId,issuedAt:this.state.elapsed};squad.route=[];squad.routeIndex=0;squad.movementState='entrenching';}
    for(const s of chosen){s.garrisonId=g.id;s.trenchId=trenchId;delete s.trenchAlong;delete s.trenchSlot;delete s.trenchTravel;this.ensureNeeds(s);const relocation=relocations.get(s.id);if(relocation)this.beginRelocation(s,relocation);}
    if(g.cutoff==='withdraw')g.cutoff='clear';g.nextDecision=0;return true;
  }
  release(squadId:number):void {
    for(const f of this.state.living!.facilities)if(f.weaponSquadId===squadId)delete f.weaponSquadId;
    for(const g of this.state.living!.garrisons)g.squadIds=g.squadIds.filter(id=>id!==squadId);
    for(const s of this.state.soldiers.filter(s=>s.squadId===squadId)){
      if(s.duty?.kind==='sleep'&&s.duty.arrivedAt!==undefined)s.needs!.interruptedSleep++;
      delete s.garrisonId;delete s.duty;
    }
  }
  setReadiness(id:number,readiness:Readiness):void{const g=this.state.living!.garrisons.find(g=>g.id===id);if(g){g.readiness=readiness;g.nextDecision=0;}}
  orderPerson(id:number,order:PersonalOrder,point?:Vec2):{accepted:boolean;reason:string}{
    const reject=(reason:string)=>({accepted:false,reason});
    const s=this.state.soldiers.find(s=>s.id===id),g=this.state.living!.garrisons.find(g=>g.id===s?.garrisonId);
    if(!s||!g||g.faction==='enemy'||this.state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')return reject('Assign this person’s squad to a friendly trench first.');
    if(this.state.operation&&this.state.operation.status!=='active')return reject('Operation ended.');
    if(s.health<=0||s.needs?.life!=='active')return reject('This person is not fit for duty.');
    if(g.cutoff==='withdraw')return reject('Area withdrawal takes priority.');
    if(s.duty?.relocationExit||s.duty?.kind==='haul'||s.combat?.careTask||['reaction','casualty','support'].includes(s.combat?.owner??''))return reject('Finish the current delivery, rescue, reaction or support task first.');
    if(order==='auto'){if(s.duty){delete s.duty.playerOrdered;s.duty.until=this.state.elapsed;}g.nextDecision=0;return {accepted:true,reason:'Returned to area duties; occupied watch posts await relief.'};}
    this.network.sync(this.state.trenches);const component=this.network.component(g.trenchId);
    if(component===undefined)return reject('No connected, excavated trench available.');
    const people=this.people(g);let destination:Vec2|undefined,kind:DutyKind='rest',reason='',facility:Facility|undefined;
    if(order==='watch'){
      destination=defensivePost(this.network,this.terrain,component,g.front,s,people,g.entrance,this.state.living!.facilities.filter(f=>f.garrisonId===g.id).map(f=>f),g.threatSector,g.frontage);kind='watch';reason='Player: take watch';
    }else if(order==='rest'){
      facility=this.facility(g,'rest',people);destination=facility?this.facilityDestination(facility,s):this.localMealPoint(g,s);kind='sleep';reason='Player: rest and recover';
    }else if(order==='meal'){
      const packed=(s.carried?.food??0)>0||(s.carried?.water??0)>0,stock=localInventory(this.state,g);
      if(!packed&&stock.food<=0&&stock.water<=0)return reject('No food or water available here.');
      const source=this.supplySource(g,s.needs.thirst>=s.needs.hunger?'water':'food');
      destination=packed?this.localMealPoint(g,s):this.supplyPoint(g,s,source.storeId);kind='meal';reason='Player: eat and drink';
      if(!this.assignDuty(s,g,kind,destination,reason,15))return reject('No reachable meal position.');
      s.duty!.stage=packed?'deliver':'pickup';s.duty!.pickupStoreId=source.storeId;s.duty!.playerOrdered=true;g.nextDecision=0;
      return {accepted:true,reason};
    }else if(order==='move'){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)||!this.network.corridorContains(point)||this.componentAt(point)!==component)return reject('Choose excavated floor in this connected trench.');
      if(people.some(other=>other!==s&&other.needs?.life!=='dead'&&(distance(other,point)<.7||other.duty&&distance(other.duty.destination,point)<.7)))return reject('That space is occupied; choose nearby trench floor.');
      destination=point;reason='Player: hold this trench position';
    }else return reject('Unknown personnel order.');
    if(!this.assignDuty(s,g,kind,destination,reason,150))return reject('No reachable, usable position for this duty.');
    s.duty!.playerOrdered=true;if(facility)s.duty!.facilityId=facility.id;if(kind==='watch')s.duty!.watchPost={...s.duty!.destination};g.nextDecision=0;
    return {accepted:true,reason};
  }
  private personalDuty(s:SoldierState):boolean {
    return Boolean(s.duty?.playerOrdered&&this.state.elapsed<s.duty.until&&s.needs!.energy>10&&s.needs!.hunger<85&&s.needs!.thirst<85)||this.weaponDuty(s);
  }
  private weaponDuty(s:SoldierState):boolean {
    return Boolean(s.duty?.kind==='watch'&&this.state.living!.facilities.some(f=>f.id===s.duty!.facilityId&&f.weaponSquadId===s.squadId)&&s.needs!.energy>35&&s.needs!.hunger<65&&s.needs!.thirst<65&&(s.carried?.ammo??0)>0);
  }
  assignWeapon(squadId:number,facilityId:number):{accepted:boolean;reason:string}{
    const f=this.state.living!.facilities.find(f=>f.id===facilityId),q=this.state.squads.find(q=>q.id===squadId),g=this.state.living!.garrisons.find(g=>g.id===f?.garrisonId);
    const reject=(reason:string)=>({accepted:false,reason});
    if(!f||!q||!g||!['emplacement','mortar'].includes(f.kind)||(q.faction??'player')!==(g.faction??'player'))return reject('Choose a friendly weapon position.');
    if(this.state.operation&&this.state.operation.status!=='active')return reject('Operation ended.');
    if(f.progress<1||!f.paid)return reject('Builders must finish this position first.');
    if(f.weaponSquadId!==undefined&&f.weaponSquadId!==squadId)return reject('Position already assigned to another formation.');
    const operator=positionOperator(this.state,q.id,f.kind as WeaponPositionKind);
    if(!operator)return reject('This formation does not carry the required weapon.');
    if(this.state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active').length<2)return reject('Need two fit personnel in this formation.');
    if(!g.squadIds.includes(q.id)&&!this.assign([q.id],g.trenchId))return reject('No reachable space for this formation in the position’s trench.');
    for(const old of this.state.living!.facilities)if(old.weaponSquadId===q.id&&old.kind===f.kind)delete old.weaponSquadId;
    f.weaponSquadId=q.id;
    // A direct crew order supersedes this carrier's routine building job, but
    // never abandons a loaded delivery, medical task or personal override.
    if(operator.duty?.kind==='construct'&&!operator.duty.playerOrdered)delete operator.duty;
    for(const s of this.people(g).filter(s=>s.squadId===q.id))if(s.duty&&!s.duty.playerOrdered&&['watch','rest','patrol'].includes(s.duty.kind))delete s.duty;
    g.nextDecision=0;return {accepted:true,reason:`${q.name}: crew ordered to ${SUPPORT_WORKS[f.kind].name}. Others continue area duties.`};
  }
  private coordinateWeapons(g:Garrison,active:SoldierState[]):void {
    for(const f of this.state.living!.facilities.filter(f=>f.garrisonId===g.id&&['emplacement','mortar'].includes(f.kind)&&f.progress===1)){
      const kind=f.kind as WeaponPositionKind;
      if(f.weaponSquadId===undefined&&g.faction==='enemy'){
        const q=this.state.squads.find(q=>g.squadIds.includes(q.id)&&positionOperator(this.state,q.id,kind)&&!this.state.living!.facilities.some(other=>other.kind===kind&&other.weaponSquadId===q.id));
        if(q)f.weaponSquadId=q.id;
      }
      if(f.weaponSquadId===undefined)continue;
      const operator=positionOperator(this.state,f.weaponSquadId,kind);
      const fit=(s:SoldierState)=>active.includes(s)&&s.squadId===f.weaponSquadId&&!s.combat?.careTask&&!s.duty?.playerOrdered&&s.needs!.energy>(s.duty?.facilityId===f.id?35:55)&&s.needs!.hunger<60&&s.needs!.thirst<60&&(!s.duty||['watch','rest','patrol'].includes(s.duty.kind));
      if(!operator||!fit(operator))continue;
      const helper=active.filter(s=>s!==operator&&fit(s)&&(!this.weaponDuty(s)||s.duty?.facilityId===f.id)&&s.id!==positionOperator(this.state,s.squadId,kind==='mortar'?'emplacement':'mortar')?.id)
        .sort((a,b)=>Number(b.duty?.facilityId===f.id)-Number(a.duty?.facilityId===f.id)||Number(hasEquipment(this.state,a,'medicalKit'))-Number(hasEquipment(this.state,b,'medicalKit'))||a.id-b.id)[0];
      if(!helper)continue;
      const t=this.state.trenches.find(t=>t.id===f.connectorId);if(!t||t.progress<1)continue;
      const a=t.points[t.points.length-2],b=t.points[t.points.length-1],len=distance(a,b)||1,dx=(b.x-a.x)/len,dz=(b.z-a.z)/len;
      for(const [i,s] of [operator,helper].entries()){
        if(s.duty?.facilityId===f.id&&this.weaponDuty(s))continue;
        // Both positions are inside the excavated end, never on the surface outside it.
        const p={x:f.x-dx*.8+dz*(i===0?-.7:.7),z:f.z-dz*.8-dx*(i===0?-.7:.7)};
        if(this.assignDuty(s,g,'watch',p,`Crew ${SUPPORT_WORKS[kind].name}`,150)){
          s.duty!.facilityId=f.id;s.duty!.watchPost={...p};
        }
      }
    }
  }
  setFront(id:number,front:number):void {
    const g=this.state.living!.garrisons.find(g=>g.id===id);if(!g||!Number.isFinite(front)||Math.abs(g.front-front)<.001)return;
    g.front=front;g.nextDecision=0;
    for(const s of this.people(g))if(s.duty?.kind==='watch')delete s.duty;
  }
  reopenEmergency(id:number):boolean {
    const w=this.state.living!,g=w.garrisons.find(g=>g.id===id);
    if(!g||this.state.operation&&this.state.operation.status!=='active'||!['hold','recover'].includes(g.cutoff))return false;
    // Reviewing a response suspends existing trips; it does not cancel or move them.
    // The first outstanding decision owns the exact resume speed, including pause.
    if(!w.garrisons.some(other=>other.cutoff==='decision'))w.emergencyResumeSpeed=this.state.simSpeed;
    g.cutoff='decision';this.state.simSpeed=0;return true;
  }
  resolveEmergency(id:number,choice:'hold'|'recover'|'withdraw'):void {
    const w=this.state.living!,g=w.garrisons.find(g=>g.id===id);if(!g||this.state.operation&&this.state.operation.status!=='active')return;
    const wasPending=g.cutoff==='decision';g.cutoff=choice;
    if(wasPending&&!w.garrisons.some(g=>g.cutoff==='decision'))this.state.simSpeed=[0,1,2,5].includes(w.emergencyResumeSpeed)?w.emergencyResumeSpeed:1;
    if(choice==='withdraw'){
      const people=this.people(g),columns=Math.ceil(Math.sqrt(people.length));
      people.forEach((s,i)=>{const point=this.navigation.freeDestination({x:g.forward.x+(i%columns-(columns-1)/2)*1.2,z:g.forward.z+(Math.floor(i/columns)-(Math.ceil(people.length/columns)-1)/2)*1.2});this.assignDuty(s,g,'rest',point,'Player-authorized withdrawal to supply apron',300,true);});
    }g.nextDecision=0;
  }
  private ensureNeeds(s:SoldierState):void {
    if(s.needs)return;s.needs=freshNeeds(s.fatigue);s.carried=inventory({food:2,water:3});this.state.living!.ledger.initial.food+=2;this.state.living!.ledger.initial.water+=3;
  }
  step(dt:number):void {
    this.stepMovementBound=dt*2.1;
    const w=this.state.living!;w.campaignHours+=dt*CAMPAIGN_HOURS_PER_SECOND;
    // Quantized geometry revisions are checked every fixed step so save/load has no hidden timer phase.
    if(this.network.sync(this.state.trenches)){
      for(const g of w.garrisons)g.nextDecision=0;
      for(const s of this.state.soldiers){const d=s.duty;if(!d||!d.networkBound&&!d.relocationExit||d.arrivedAt!==undefined||!d.routeBlocked&&!d.routeTrenches?.some(id=>this.network.changedTrenches.has(id)))continue;
        const remaining=[s,...d.route.slice(d.routeIndex)];if(remaining.every((p,i)=>i===0||this.network.segmentInside(remaining[i-1],p)))continue;
        const g=w.garrisons.find(g=>g.id===s.garrisonId);
        if(d.relocationExit&&g){this.replanRelocation(s,g);continue;}
        const route=this.network.route(s,d.exitPending&&g?(d.exitPoint??g.entrance):d.destination);d.routeBlocked=!route.length;
        if(route.length&&d.exitPending&&g)route.push(...this.openApproach(route.at(-1)!,d.destination,g.entrance,d.exitPoint));
        if(route.length){d.route=[...route,d.destination];d.routeIndex=0;delete d.detourWaypoints;}
      }
    }
    this.logistics.step(dt);
    this.cells.clear();for(const s of this.state.soldiers){
      this.ensureNeeds(s);
      // Also release stale reservations in older saves, without changing needs or cargo.
      if(s.needs!.life!=='active')delete s.duty;
      const key=`${Math.floor(s.x/2)},${Math.floor(s.z/2)}`,bucket=this.cells.get(key)??[];bucket.push(s);this.cells.set(key,bucket);
    }
    for(const g of w.garrisons){
      if(g.underFireUntil!==undefined&&this.state.elapsed>=g.underFireUntil){delete g.underFireUntil;delete g.threatSector;g.nextDecision=0;}
      const people=this.people(g),alive=people.filter(s=>s.needs!.life!=='dead');if(!alive.length)continue;
      g.capacity=this.network.capacity(this.network.component(g.trenchId)??-1);
      g.watchRequired=g.cutoff==='withdraw'?0:Math.ceil(alive.length*WATCH[effectiveReadiness(g,this.state.elapsed)]);
      g.reserveRequired=g.threatSector&&alive.length>=8?Math.max(1,Math.floor(alive.length*.15)):0;
      g.watchPresent=alive.filter(s=>s.needs!.life==='active'&&s.combat?.owner!=='casualty'&&s.combat?.owner!=='reaction'&&s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&s.duty.rationUntil===undefined).length;
      g.lossRate=(people.length-alive.length)/Math.max(1,people.length);
      g.watchEffectiveness=alive.filter(s=>s.needs!.life==='active'&&s.combat?.owner!=='casualty'&&s.combat?.owner!=='reaction'&&s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&s.duty.rationUntil===undefined).reduce((sum,s)=>sum+.5+s.morale*.005,0);
      w.metrics.watchGapHours+=Math.max(0,g.watchRequired-g.watchPresent)*dt*CAMPAIGN_HOURS_PER_SECOND;
      if(this.state.elapsed>=g.nextDecision){const phase=(g.id%10)*.5;g.nextDecision=(Math.floor((this.state.elapsed-phase)/5)+1)*5+phase;this.coordinate(g,people);}
      for(const s of people)this.execute(s,g,dt);
      const local=localInventory(this.state,g),noSupply=local.food<1||local.water<1;
      const criticalAccess=alive.some(s=>s.needs!.hungryHours>8||s.needs!.thirstyHours>3);
      g.supplyIssue=noSupply?'Local food or water exhausted':criticalAccess?'Stocks exist, but supplies are not reaching critical personnel':undefined;
      if((criticalAccess||noSupply&&alive.some(s=>s.needs!.hunger>65||s.needs!.thirst>65))&&g.cutoff==='clear')g.cutoff='warning';
      // A token delivery must not reset an acknowledged incident and pause again.
      if(!criticalAccess&&local.food>=alive.length*.5&&local.water>=alive.length*.5){
        g.recoveredSince??=this.state.elapsed;
        if(this.state.elapsed-g.recoveredSince>=75&&['warning','hold','recover'].includes(g.cutoff))g.cutoff='clear';
      }else delete g.recoveredSince;
      if(criticalAccess&&g.cutoff==='warning'){
        if(g.faction==='enemy'){g.cutoff='hold';g.nextDecision=0;continue;}
        // Several networks can raise an incident in this fixed step. Only the first
        // owns the resume speed; later incidents must not replace it with zero.
        if(!w.garrisons.some(other=>other.cutoff==='decision'))w.emergencyResumeSpeed=this.state.simSpeed;
        g.cutoff='decision';this.state.simSpeed=0;
      }
    }
    for(const s of this.state.soldiers){const before=s.needs!.life;updateNeeds(this.state,s,dt);if(before==='active'&&s.needs!.life!=='active'){dropCargo(this.state,s);delete s.duty;}}
  }
  private coordinate(g:Garrison,people:SoldierState[]):void {
    const w=this.state.living!,component=this.network.component(g.trenchId);if(component===undefined)return;
    if(g.cutoff==='withdraw')return;
    const active=people.filter(s=>s.needs!.life==='active'&&!s.duty?.relocationExit&&s.combat?.owner!=='reaction'&&s.combat?.owner!=='casualty'&&s.combat?.owner!=='support'),local=localInventory(this.state,g),readiness=effectiveReadiness(g,this.state.elapsed);
    g.scores=this.rulePolicy.decide(observation(this.state,g,people));
    g.policyStatus=g.policy==='rules'?'Deterministic needs-based coordinator':'Deterministic coordinator · previous experimental policy retired';
    g.policy='rules';
    const points=this.network.samples(component,5);if(!points.length)return;
    this.coordinateWeapons(g,active);
    const freePoint=(s:SoldierState,front=false):Vec2=>{
      const source=front&&readiness==='stand-to'?this.network.samples(component,2.5):points;
      // Occupy nearby usable frontage, rather than marching every new guard to one end.
      const candidates=[...source].sort((a,b)=>distance(a,s)-distance(b,s));
      for(let i=0;i<candidates.length;i++){
        const p=candidates[i],offset=bankPoint(this.network,p,g.front,front);
        if(distance(offset,g.entrance)<14||w.facilities.some(f=>f.garrisonId===g.id&&distance(f,offset)<6)||this.network.nodes.some(n=>n.edges.length>2&&distance(n,offset)<3))continue;
        if(!people.some(other=>other!==s&&other.needs?.life!=='dead'&&(distance(other,offset)<.7||other.duty&&distance(other.duty.destination,offset)<1.1)))return offset;
      }return bankPoint(this.network,candidates[s.id%candidates.length],g.front,false);
    };
    // A guard remains until its named relief physically arrives.
    for(const relief of active.filter(s=>s.duty?.kind==='watch'&&s.duty.arrivedAt!==undefined&&s.duty.relieving!==undefined)){
      const duty=relief.duty;if(duty?.kind!=='watch'||duty.relieving===undefined)continue;
      const old=people.find(s=>s.id===duty.relieving);
      if(old?.duty?.kind==='watch'&&this.state.elapsed<old.duty.until&&old.needs!.hunger<=65&&old.needs!.thirst<=65)continue;
      if(old?.duty?.kind==='watch')delete old.duty;
      duty.until=this.state.elapsed+150;delete duty.relieving;
    }
    // Lower readiness retires surplus posts, including their named incoming reliefs.
    // No handover is needed for a post the player no longer requires.
    const posts=active.filter(s=>s.duty?.kind==='watch'&&s.duty.relieving===undefined);
    const excess=Math.max(0,posts.length-g.watchRequired);
    posts.sort((a,b)=>a.needs!.energy-b.needs!.energy||b.needs!.watchHours-a.needs!.watchHours||a.id-b.id);
    for(const outgoing of posts.filter(s=>!this.personalDuty(s)).slice(0,excess)){
      for(const relief of active)if(relief.duty?.relieving===outgoing.id)delete relief.duty;
      delete outgoing.duty;
    }
    const watch=active.filter(s=>s.duty?.kind==='watch'),reservedReliefs=new Set(watch.map(s=>s.duty?.relieving));
    let needed=Math.max(0,g.watchRequired-watch.length);
    const urgency=(s:SoldierState)=>Math.max(s.needs!.hunger,s.needs!.thirst,100-s.needs!.energy)+(this.state.elapsed-s.duty!.until)/75;
    const overdue=watch.filter(s=>s.duty!.relieving===undefined&&s.duty!.arrivedAt!==undefined&&(this.state.elapsed>=s.duty!.until-45||s.needs!.hunger>65||s.needs!.thirst>65||this.state.operation&&(s.carried?.ammo??0)<8)&&!reservedReliefs.has(s.id)).sort((a,b)=>urgency(b)-urgency(a)||a.id-b.id);
    const recruits=active.filter(s=>!hasEquipment(this.state,s,'medicalKit')&&!hasEquipment(this.state,s,'mortar')&&s.duty?.kind!=='watch'&&s.needs!.energy>45&&s.needs!.hunger<55&&s.needs!.thirst<55&&(!s.duty||['rest','patrol'].includes(s.duty.kind)||(readiness!=='routine'&&needed>0&&s.duty.patientId===undefined)||(needed>0||overdue.length>0)&&s.duty.kind==='sleep'&&s.needs!.energy>75&&(needed>0||s.duty.arrivedAt!==undefined&&this.state.elapsed-s.duty.arrivedAt>=75)))
      .sort((a,b)=>{const score=(s:SoldierState)=>s.needs!.energy-s.needs!.watchHours*3-(s.duty?.kind==='sleep'?80:0)-(this.isEngineer(s)?15:0);return score(b)-score(a)||a.id-b.id;});
    for(const s of recruits){
      if(this.personalDuty(s))continue;
      const old=needed>0?undefined:overdue.shift();if(needed<=0&&!old)break;
      // Preserve routine posts elsewhere; additional guards reinforce the threatened sector.
      const sector=watch.length>=Math.ceil(active.length*.25)?g.threatSector:undefined;
      const destination=old?this.reliefPoint(old,s):defensivePost(this.network,this.terrain,component,sector?.front??g.front,s,people,g.entrance,w.facilities.filter(f=>f.garrisonId===g.id).map(f=>f),sector,g.frontage);if(!destination)continue;
      if(this.assignDuty(s,g,'watch',destination,old?'Relieving guard':(g.underFireUntil??0)>this.state.elapsed?'Under fire: man defensive watch':'Required watch coverage',150)){
        const post=old?.duty?.watchPost??old?.duty?.destination??destination;
        s.duty!.watchPost={x:post.x,z:post.z};
        if(old)s.duty!.relieving=old.id;else needed--;
      }
    }
    // Allocate scarce service reservations by need, not soldier-array order.
    // Otherwise distant early IDs continually reserve every berth and starve
    // later IDs despite full stores. Stable ID is only the deterministic tie-break.
    for(const s of this.jobBoard.rankPeople(active)){
      if(this.personalDuty(s))continue;
      const n=s.needs!;let d=s.duty;
      // Older saves can contain a pickup projected onto the wrong component.
      // Release only empty, failed crate trips; never discard cargo in transit.
      if(d?.kind==='haul'&&d.stage==='pickup'&&d.crateId!==undefined&&d.routeBlocked&&total(s.carried??inventory())===0){delete s.duty;d=undefined;}
      if(d?.kind==='watch'){
        if(d.arrivedAt===undefined&&n.energy<15){
          // An incoming relief is not an occupied post. Release its claim and
          // recover locally; the outgoing guard remains until a fit relief arrives.
          this.assignDuty(s,g,'sleep',this.localMealPoint(g,s),'Incoming relief exhausted; local recovery',150,!this.network.corridorContains(s));
        }continue;
      }
      if(d?.rationUntil!==undefined)continue;
      if(d&&d.arrivedAt===undefined){
        if(d.kind==='patrol'&&d.blockedFor>20){this.assignDuty(s,g,'rest',freePoint(s),'Patrol yielded its blocked destination',35);continue;}
        if(n.energy<8&&d.kind!=='sleep'){
          const outside=!this.network.corridorContains(s);
          this.assignDuty(s,g,'sleep',outside?{x:s.x,z:s.z}:this.localMealPoint(g,s),'Emergency recovery where stopped',150,outside);
        }
        continue;
      }
      if(d&&this.state.elapsed<d.until&&!(Math.max(n.hunger,n.thirst)>85&&d.kind!=='meal')&&!(n.energy<10&&d.kind!=='sleep'&&d.kind!=='meal'))continue;
      if(d?.kind==='haul'&&total(s.carried??inventory())>0)continue;
      const patient=people.filter(p=>p.needs!.life==='incapacitated'&&(p.needs!.hunger>45||p.needs!.thirst>40)||p.needs!.life==='active'&&p.duty?.kind==='watch'&&p.duty.arrivedAt!==undefined&&(p.needs!.hunger>70&&(p.carried?.food??0)<1||p.needs!.thirst>70&&(p.carried?.water??0)<1||this.state.operation&&(p.carried?.ammo??0)<8)).filter(p=>!people.some(c=>c.duty?.patientId===p.id)).sort((a,b)=>(a.needs!.life==='incapacitated'?-1:0)-(b.needs!.life==='incapacitated'?-1:0)||Math.max(b.needs!.hunger,b.needs!.thirst)-Math.max(a.needs!.hunger,a.needs!.thirst))[0];
      const aidKey=patient&&this.state.operation&&patient.needs!.life==='active'&&(patient.carried?.ammo??0)<8?'ammo':patient&&patient.needs!.thirst>=patient.needs!.hunger?'water':'food',aidPacked=(s.carried?.[aidKey]??0)>=(aidKey==='ammo'?8:1);
      if(patient&&n.energy>45&&n.hunger<55&&n.thirst<55&&people.filter(p=>p.duty?.patientId!==undefined).length<2&&(aidPacked||local[aidKey]>=1)){
        const source=this.supplySource(g,aidKey);
        const destination=aidPacked?patient:this.supplyPoint(g,s,source.storeId);
        const reason=patient.needs!.life==='incapacitated'?'Deliver aid to incapacitated comrade':'Replenish occupied watch post';
        if(this.assignDuty(s,g,'haul',destination,reason,120,aidPacked&&!this.network.corridorContains(patient))){s.duty!.stage=aidPacked?'deliver':'pickup';s.duty!.patientId=patient.id;s.duty!.pickupStoreId=source.storeId;}continue;
      }
      const rationed=['warning','hold','recover','decision'].includes(g.cutoff),threshold=rationed?55:35,portion=rationed?.5:1;
      const rearm=Boolean(this.state.operation&&(s.carried?.ammo??0)<12&&local.ammo>0);
      if(rearm||(n.hunger>threshold||n.thirst>threshold)&&(local.food>=portion||local.water>=portion||(s.carried?.food??0)>0||(s.carried?.water??0)>0)&&(g.scores[3]>.35||n.hunger>65||n.thirst>65)){
        const meal=this.facility(g,'meal',people),packed=(s.carried?.food??0)>=portion&&(s.carried?.water??0)>=portion,source=this.supplySource(g,n.thirst>=n.hunger?'water':'food');
        const refill=rearm?this.supplySource(g,'ammo'):source,usePack=packed&&!rearm;
        if(this.assignDuty(s,g,'meal',usePack?this.localMealPoint(g,s):this.supplyPoint(g,s,refill.storeId),rearm?'Rearm at a physical supply point':rationed?'Reduced ration during shortage':packed?'Eat carried rations':'Collect meal and water',15)){s.duty!.stage=usePack?'deliver':'pickup';s.duty!.pickupStoreId=refill.storeId;if(meal&&!usePack)s.duty!.facilityId=meal.id;continue;}
      }
      if(g.reserveRequired&&n.energy>45&&active.filter(p=>p.duty?.reason==='Sheltered defensive reserve').length<g.reserveRequired){this.assignDuty(s,g,'rest',freePoint(s),'Sheltered defensive reserve',30);continue;}
      if(n.energy<40||(NIGHT(w.campaignHours)&&n.sleepHours<8&&g.scores[2]>.25)){
        const rest=n.energy<15?undefined:this.facility(g,'rest',people);
        const p=n.energy<15?this.localMealPoint(g,s):rest?this.facilityDestination(rest,s):freePoint(s);
        if(this.assignDuty(s,g,'sleep',p,rest?'Sleep in rest dugout':'Sleep on trench floor',Math.max(150,Math.min(600,(8-n.sleepHours)*75)))&&rest)s.duty!.facilityId=rest.id;
        continue;
      }
      // Keep scarce tool carriers at a funded worksite. Ordinary personnel can
      // deliver its materials; routine shuttle unloading must not steal every builder.
      const work=w.facilities.find(f=>f.garrisonId===g.id&&f.progress<1&&f.paid);
      const unpaid=w.facilities.find(f=>f.garrisonId===g.id&&!f.paid);
      if(work&&this.isEngineer(s)&&g.scores[5]>.05&&this.state.squads.find(q=>q.id===s.squadId)?.constructionQueue?.some(j=>typeof j!=='number'&&j.kind==='facility'&&j.id===work.id)&&local.water>active.length*.5&&local.food>active.length*.5){
        const connector=this.state.trenches.find(t=>t.id===work.connectorId)!;
        const target=this.workPoint(connector.points[0],work,connector.progress,s);
        if(this.assignDuty(s,g,'construct',target,'Engineer support works',20)){s.duty!.facilityId=work.id;continue;}
      }
      if(unpaid&&local.materials>0&&active.filter(p=>p.duty?.kind==='haul'&&p.duty.facilityId===unpaid.id).length<2){
        const source=this.supplySource(g,'materials');
        if(this.assignDuty(s,g,'haul',this.supplyPoint(g,s,source.storeId),'Collect support construction materials',90)){s.duty!.stage='pickup';s.duty!.facilityId=unpaid.id;s.duty!.pickupStoreId=source.storeId;continue;}
      }
      const haulers=active.filter(p=>p.duty?.kind==='haul').length;
      const ammoTarget=Math.min(300,active.length*6);
      const forwardDemand=local.food<active.length*2&&g.forwardStock.food>0||local.water<active.length*2&&g.forwardStock.water>0||local.materials<32&&g.forwardStock.materials>0||this.state.operation&&(local.ammo<ammoTarget&&g.forwardStock.ammo>0||(['medical','mortarHE','mortarSmoke','smokeGrenades'] as const).some(key=>local[key]<6&&g.forwardStock[key]>0));
      if(forwardDemand&&haulers<Math.max(2,Math.ceil(active.length*.15))&&(g.scores[4]>.1||local.materials<32||this.state.operation&&local.ammo<ammoTarget)){
        const loading=this.forwardServicePoint(g,s);
        if(loading&&this.assignDuty(s,g,'haul',loading,'Collect physical forward shipment',180,true))s.duty!.stage='pickup';continue;
      }
      if(haulers<2){
        const crates=w.crates.filter(c=>total(c.stock)>0&&(g.cutoff==='clear'&&distance(c,g.entrance)<80||g.cutoff==='recover')&&!active.some(p=>p.duty?.crateId===c.id))
          .sort((a,b)=>distance(a,g.entrance)-distance(b,g.entrance)||a.id-b.id);
        // A failed candidate must not monopolize this person's decision. Try
        // reachable alternatives, then allow normal duties if none can be used.
        const crate=crates.find(c=>this.assignDuty(s,g,'haul',c,'Recover dropped supplies',180,!this.network.corridorContains(c)));
        if(crate){s.duty!.stage='pickup';s.duty!.crateId=crate.id;continue;}
      }
      if(work&&this.isEngineer(s)&&g.scores[5]>.05&&this.state.squads.find(q=>q.id===s.squadId)?.constructionQueue?.some(j=>typeof j!=='number'&&j.kind==='facility'&&j.id===work.id)){
        const connector=this.state.trenches.find(t=>t.id===work.connectorId)!;
        const target=this.workPoint(connector.points[0],work,connector.progress,s);
        if(this.assignDuty(s,g,'construct',target,'Engineer support works',20))s.duty!.facilityId=work.id;continue;
      }
      if(!d||this.state.elapsed>=d.until){
        const patrol=g.scores[1]>.12&&s.id%5===Math.floor(this.state.elapsed/90)%5;
        if(d?.kind==='rest'&&!patrol){d.until=this.state.elapsed+35;continue;}
        const localPatrol=points.filter(p=>distance(p,s)>5&&distance(p,s)<15&&distance(p,g.entrance)>14).map(p=>this.bermPoint(p,-1)).filter(p=>!people.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,p)<.7||o.duty&&distance(o.duty.destination,p)<1.1)));
        const canPatrol=patrol&&localPatrol.length>0;
        this.assignDuty(s,g,canPatrol?'patrol':'rest',canPatrol?localPatrol[s.id%localPatrol.length]:freePoint(s),canPatrol?'Short local trench patrol':'Off-duty recovery',canPatrol?60:35);
      }
    }
    if(this.state.elapsed>=g.nextSupport){g.nextSupport=this.state.elapsed+15;this.planSupport(g,people);}
    this.jobBoard.publish(g,active);
  }
  private isEngineer(s:SoldierState):boolean{return hasEquipment(this.state,s,'tools');}
  private facility(g:Garrison,kind:Facility['kind'],people:SoldierState[]):Facility|undefined {
    return this.state.living!.facilities.find(f=>f.garrisonId===g.id&&f.kind===kind&&f.progress===1&&people.filter(s=>s.duty?.facilityId===f.id).length<f.capacity);
  }
  private bermPoint(p:Vec2,side:number):Vec2 {
    const hit=this.network.nearest(p);if(!hit)return p;const e=this.network.edges[hit.edge],a=this.network.nodes[e.a],b=this.network.nodes[e.b],d=distance(a,b)||1;
    return {x:p.x+(b.z-a.z)/d*Math.min(1.15,e.width*.27)*side,z:p.z-(b.x-a.x)/d*Math.min(1.15,e.width*.27)*side};
  }
  private openApproach(from:Vec2,to:Vec2,entrance:Vec2,exit?:Vec2):Vec2[]{
    // External routes respect trench walls too; a local avoidance search cannot
    // repair a global route that cuts straight through another branch.
    const revision=`${this.network.revision}:${this.terrain.revision}`;
    if(revision!==this.approachRevision){this.approachRevision=revision;this.approachCache.clear();}
    const key=`${from.x},${from.z}:${to.x},${to.z}:${entrance.x},${entrance.z}:${exit?.x},${exit?.z}`,cached=this.approachCache.get(key);
    if(cached)return cached.map(p=>({...p}));
    const avoid=(p:Vec2)=>this.network.corridorContains(p)&&distance(p,entrance)>3&&(!exit||distance(p,exit)>3);
    let route=this.navigation.plan(from,to,avoid);
    // Squad navigation may move a requested endpoint away from a footprint.
    // A physical delivery cannot append an unchecked hop back into that obstacle.
    if(route.length&&!this.navigation.segmentClear(route.at(-1)!,to,.4,avoid))route=[];
    if(this.approachCache.size>=256)this.approachCache.delete(this.approachCache.keys().next().value!);
    this.approachCache.set(key,route);return route.map(p=>({...p}));
  }
  private retracePickupApproach(s:SoldierState,entrance:Vec2):Vec2[]{
    const d=s.duty;
    if(d?.kind!=='haul'||d.stage!=='pickup'||d.arrivedAt===undefined)return [];
    let index=d.route.length-1;while(index>=0&&distance(d.route[index],entrance)>.15)index--;
    if(index<0)return [];
    const route=d.route.slice(index).reverse().map(p=>({x:p.x,z:p.z}));route[route.length-1]={...entrance};
    const avoid=(p:Vec2)=>this.network.corridorContains(p)&&distance(p,entrance)>3;
    // The outward route is serialized, but may no longer be clear after new
    // excavation. Revalidate every return segment, including the current position.
    if(!route.every((p,i)=>this.navigation.segmentClear(i?route[i-1]:s,p,2,avoid)))return [];
    return route;
  }
  private entryApproach(from:Vec2,component:number,fallback:Vec2,exit?:Vec2):{point:Vec2;route:Vec2[]}|undefined {
    const nearest=this.network.nearest(from,component);if(!nearest)return;
    // Only completed geometry participates. If the closest edge is obstructed, try nearby
    // junctions/endpoints, then the established entrance; never jump across a closed branch.
    const points=[nearest.point,...this.network.nodes.filter(n=>n.component===component).sort((a,b)=>distance(a,from)-distance(b,from)).slice(0,8),fallback];
    for(const point of points){const route=this.openApproach(from,point,point,exit);if(route.length)return {point:{x:point.x,z:point.z},route};}
    return;
  }
  private componentAt(p:Vec2):number|undefined {
    if(!this.network.corridorContains(p))return;
    const near=this.network.nearest(p);return near?this.network.nodes[this.network.edges[near.edge].a].component:undefined;
  }
  private relocationRoute(s:SoldierState,component:number,entrance:Vec2):{route:Vec2[];exit:Vec2;entry:Vec2;inside:boolean}|undefined {
    const source=this.componentAt(s);
    if(source===undefined){
      const exit=s.duty?.relocationExit??{x:s.x,z:s.z},entry=this.entryApproach(s,component,entrance,exit);
      return entry?{route:entry.route,exit,entry:entry.point,inside:false}:undefined;
    }
    const near=this.network.nearest(s,source);if(!near)return;
    const exits=[near.point,...this.network.nodes.filter(n=>n.component===source).sort((a,b)=>distance(s,a)-distance(s,b)).slice(0,8)];
    for(const exit of exits){
      const inside=this.network.route(s,exit,source);if(!inside.length)continue;
      const entry=this.entryApproach(exit,component,entrance,exit);
      if(entry)return {route:[...inside,...entry.route],exit:{x:exit.x,z:exit.z},entry:entry.point,inside:true};
    }
    return;
  }
  private beginRelocation(s:SoldierState,plan:NonNullable<ReturnType<GarrisonSystem['relocationRoute']>>,replanning=false):void {
    const rationUntil=s.duty?.rationUntil;
    if(!replanning)s.needs!.taskChanges++;
    const route=plan.route.filter((p,i)=>i===0||distance(p,plan.route[i-1])>.05).map(p=>({x:p.x,z:p.z}));
    s.duty={kind:'patrol',destination:{...plan.entry},route,routeIndex:0,since:this.state.elapsed,until:this.state.elapsed,reason:'Player order: relocate to the new trench',blockedFor:0,relocationExit:{...plan.exit},entryPoint:{...plan.entry},networkBound:plan.inside,exitPending:plan.inside,entryPending:!plan.inside};
    if(rationUntil!==undefined)s.duty.rationUntil=rationUntil;
    s.duty.routeTrenches=[...new Set(route.flatMap(p=>{const h=this.network.nearest(p);return h?this.network.edges[h.edge].trenches:[];}))];
  }
  private replanRelocation(s:SoldierState,g:Garrison):void {
    const component=this.network.component(g.trenchId),plan=component===undefined?undefined:this.relocationRoute(s,component,g.entrance);
    if(plan)this.beginRelocation(s,plan,true);else if(s.duty)s.duty.routeBlocked=true;
  }
  private assignDuty(s:SoldierState,g:Garrison,kind:DutyKind,destination:(Vec2&{pickupQueued?:boolean})|undefined,reason:string,duration:number,outside=false):boolean {
    if(!destination||this.terrain.obstacleAt(destination.x,destination.z,.4))return false;
    const component=this.network.component(g.trenchId);if(component===undefined)return false;
    let route:Vec2[]=[],entryPoint:Vec2|undefined,exitPoint:Vec2|undefined;const near=this.network.nearest(s,component),target=this.network.nearest(destination,component);
    if(!near||!target)return false;
    if(!outside){
      const actualTarget=this.network.nearest(destination);
      if(!actualTarget||!this.network.corridorContains(destination)||this.network.nodes[this.network.edges[actualTarget.edge].a].component!==component)return false;
    }
    const actual=this.network.nearest(s);
    if(!outside&&actual&&this.network.corridorContains(s)&&this.network.nodes[this.network.edges[actual.edge].a].component!==component)return false;
    if(distance(s,destination)<.15){route=[];}
    else if(outside){
      const source=actual&&this.network.corridorContains(s)?this.network.nodes[this.network.edges[actual.edge].a].component:undefined;
      if(source!==undefined&&source!==component){exitPoint=actual!.point;route=this.network.route(s,exitPoint,source);}
      else if(source!==undefined&&distance(s,g.entrance)>3)route=this.network.route(s,g.entrance,component);
      const approach=this.openApproach(route.at(-1)??s,destination,g.entrance,exitPoint);if(!approach.length)return false;route.push(...approach);
    }else{
      if(!this.network.corridorContains(s)){
        let approach:Vec2[]=[];
        if(kind==='haul'){
          entryPoint=g.entrance;approach=this.retracePickupApproach(s,g.entrance);
          if(!approach.length)approach=this.openApproach(s,g.entrance,g.entrance);
        }else{
          const entry=this.entryApproach(s,component,g.entrance);if(entry){entryPoint=entry.point;approach=entry.route;}
        }
        if(!approach.length)return false;route.push(...approach);
      }
      // Keep the first centreline projection. Skipping it cuts across a dugout
      // wall when the soldier starts near the side of a wide connector.
      const inside=this.network.route(route.at(-1)??s,destination,component);if(!inside.length)return false;route.push(...inside);
    }
    route.push({x:destination.x,z:destination.z});route=route.filter((p,i)=>i===0||distance(p,route[i-1])>.05).map(p=>({x:p.x,z:p.z}));
    if(s.duty?.kind==='sleep'&&s.duty.arrivedAt!==undefined&&this.state.elapsed<s.duty.until)s.needs!.interruptedSleep++;
    s.needs!.taskChanges++;s.duty={kind,destination:{x:destination.x,z:destination.z},route,routeIndex:0,since:this.state.elapsed,until:this.state.elapsed+duration,reason,blockedFor:0};
    if(destination.pickupQueued)s.duty.pickupQueued=true;
    if(!outside){
      if(this.network.corridorContains(s))s.duty.networkBound=true;else {s.duty.entryPending=true;if(entryPoint)s.duty.entryPoint={...entryPoint};}
    }else if(this.network.corridorContains(s)&&distance(s,exitPoint??g.entrance)>3){s.duty.networkBound=true;s.duty.exitPending=true;}
    if(exitPoint)s.duty.exitPoint={...exitPoint};
    s.duty.routeTrenches=[...new Set(route.flatMap(p=>{const h=this.network.nearest(p);return h?this.network.edges[h.edge].trenches:[];}))];return true;
  }
  private execute(s:SoldierState,g:Garrison,dt:number):void {
    if(!ownsAction(s,'duty'))return;
    const w=this.state.living!;if(s.needs!.life!=='active'){s.action=s.needs!.life;return;}
    const d=s.duty;if(!d){s.action='waiting for duty';return;}
    const passageRadius=(p:Vec2)=>{const hit=this.network.nearest(p);return Math.max(3,hit?this.network.edges[hit.edge].width/2+.5:3);};
    // Arrival in the destination network releases the temporary travel duty.
    // Routine scheduling must not recruit a traveller back to its old trench.
    if(d.relocationExit&&this.componentAt(s)===this.network.component(g.trenchId)){delete s.duty;g.nextDecision=0;return;}
    if(d.routeBlocked){s.action='waiting · disconnected trench';return;}
    if(d.exitPending&&distance(s,d.relocationExit??d.exitPoint??g.entrance)<passageRadius(d.relocationExit??d.exitPoint??g.entrance)){delete d.networkBound;delete d.exitPending;if(d.relocationExit)d.entryPending=true;}
    if(d.entryPending&&this.network.corridorContains(s)&&(!d.relocationExit||this.componentAt(s)===this.network.component(g.trenchId))){d.networkBound=true;delete d.entryPending;}
    // A travelling carrier does not starve while holding usable personal rations.
    // Preserve its exact route and shipment assignment across a real timed break.
    const carried=s.carried!,n=s.needs!;
    if(d.rationUntil===undefined&&d.kind!=='meal'&&((n.hunger>75&&carried.food>0)||(n.thirst>75&&carried.water>0)))d.rationUntil=this.state.elapsed+6;
    if(d.rationUntil!==undefined){
      s.action='eating';
      if(this.state.elapsed>=d.rationUntil){
        const portion=['warning','hold','recover','decision','withdraw'].includes(g.cutoff)?.5:1;
        if(n.hunger>55)n.hunger=Math.max(0,n.hunger-40*consume(this.state,carried,'food',Math.min(portion,carried.food)));
        if(n.thirst>55)n.thirst=Math.max(0,n.thirst-50*consume(this.state,carried,'water',Math.min(portion,carried.water)));
        delete d.rationUntil;
      }
      return;
    }
    if(d.arrivedAt===undefined){
      // Aid is handed over at arm's reach, not by touching every centreline
      // waypoint first. A casualty can occupy that waypoint. Still require a
      // clear, continuous passage so this never delivers through a wall.
      const patient=d.kind==='haul'&&d.stage==='deliver'?this.state.soldiers.find(p=>p.id===d.patientId):undefined;
      if(patient&&distance(s,patient)<1.3&&this.navigation.segmentClear(s,patient,.4)&&(!d.networkBound||this.network.segmentInside(s,patient)))d.routeIndex=d.route.length;
      const target=d.route[d.routeIndex];if(!target){d.arrivedAt=this.state.elapsed;d.until=Math.max(d.until,this.state.elapsed+(d.kind==='watch'?150:d.kind==='sleep'?75:10));return;}
      const distanceLeft=distance(s,target);
      const last=d.routeIndex===d.route.length-1;
      const detouring=d.routeIndex<(d.detourWaypoints??0);
      // Rest is a use of free floor, not ownership of an exact standing point.
      // If already safely on the berm, accept a nearby stop instead of circling
      // another body for minutes to close the final few centimetres.
      const nearbyFloorRest=last&&d.blockedFor>3&&!d.facilityId&&(d.kind==='rest'||d.kind==='sleep')&&(this.network.nearest(s)?.distance??0)>.85;
      const arrival=last?(d.patientId!==undefined||d.crateId!==undefined?1.3:nearbyFloorRest?.55:.15):detouring?.15:.6;
      if(distanceLeft<arrival){d.routeIndex++;return;}
      const entering=d.entryPending&&distance(s,d.entryPoint??g.entrance)<4;
      const movement=Math.min(distanceLeft,dt*2.1*postureSpeed(s)*(.6+s.needs!.energy*.004)*(.75+s.morale*.0025)*(entering?.55:1)*(this.state.operation?Math.max(.15,1-s.suppression/115):1)),dx=(target.x-s.x)/distanceLeft,dz=(target.z-s.z)/distanceLeft;
      // Right-side lanes inside the corridor; destinations remain on the berm, clear of through traffic.
      const final=d.routeIndex===d.route.length-1,offset=final||detouring?0:.42;
      const aim={x:target.x+dz*offset,z:target.z-dx*offset};const ad=distance(s,aim)||1;
      const next={x:s.x+(aim.x-s.x)/ad*movement,z:s.z+(aim.z-s.z)/ad*movement};
      let blocked=false;
      for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(const other of this.cells.get(`${Math.floor(next.x/2)+x},${Math.floor(next.z/2)+z}`)??[]){
        if(other===s||other.needs?.life==='dead')continue;
        if(distance(next,other)<.55&&distance(s,other)>.1&&distance(next,other)<distance(s,other))blocked=true;
      }
      if(this.terrain.obstacleAt(next.x,next.z,.4))blocked=true;
      const entryRadius=passageRadius(d.entryPoint??g.entrance),exitRadius=passageRadius(d.exitPoint??g.entrance);
      const corridorMove=(p:Vec2)=>d.entryPending?(!this.network.corridorContains(p)||distance(p,d.entryPoint??g.entrance)<entryRadius||!!d.relocationExit&&distance(p,d.relocationExit)<passageRadius(d.relocationExit)):!d.networkBound?(d.exitPoint===undefined||!this.network.corridorContains(p)||distance(p,d.exitPoint)<exitRadius||distance(p,g.entrance)<passageRadius(g.entrance)):this.network.corridorContains(p)||(this.network.corridorClearance(s)>0&&this.network.corridorClearance(p)<this.network.corridorClearance(s));
      if(!corridorMove(next))blocked=true;
      if(blocked){d.blockedFor+=dt;s.action='yielding';w.metrics.blockedHours+=dt*CAMPAIGN_HOURS_PER_SECOND;
        if(d.blockedFor>2&&Math.floor(d.blockedFor/3)>Math.floor((d.blockedFor-dt)/3)){
          if(d.relocationExit){this.replanRelocation(s,g);return;}
          // Yielding can carry a walker into a side bay. Rejoin its actual graph
          // branch instead of greedily pushing toward a waypoint across a wall.
          if(d.networkBound&&!this.network.segmentInside(s,target)){
            const route=this.network.route(s,d.exitPending?(d.exitPoint??g.entrance):d.destination);
            if(route.length&&d.exitPending)route.push(...this.openApproach(route.at(-1)!,d.destination,g.entrance,d.exitPoint));
            if(route.length){d.route=[...route,d.destination];d.routeIndex=0;delete d.detourWaypoints;d.blockedFor=0;d.routeTrenches=[...new Set(route.flatMap(p=>{const h=this.network.nearest(p);return h?this.network.edges[h.edge].trenches:[];}))];return;}
            d.routeBlocked=true;return;
          }
          // An obsolete short avoidance waypoint may now be occupied. Rejoin
          // the onward route instead of permanently trying to touch that point.
          let resume=d.routeIndex;
          while(resume<d.route.length-1&&distance(s,d.route[resume])<2)resume++;
          const detour=this.localDetour(s,d.route[resume],corridorMove);
          if(detour.length){d.route=[...detour,...d.route.slice(resume)];d.detourWaypoints=detour.length;d.routeIndex=0;d.blockedFor=0;return;}
        }
        // Local detours retain body clearance and stay inside excavated corridor width.
        const candidates:Vec2[]=[];
        for(const angle of [.5,-.5,1,-1,1.5,-1.5,2,-2]){
          const vx=dx*Math.cos(angle)-dz*Math.sin(angle),vz=dx*Math.sin(angle)+dz*Math.cos(angle),p={x:s.x+vx*movement,z:s.z+vz*movement};
          const corridor=corridorMove(p);
          if(corridor&&!this.terrain.obstacleAt(p.x,p.z,.4)&&!this.nearby(p,.5).some(o=>o!==s&&o.needs?.life!=='dead'&&distance(o,p)<.5))candidates.push(p);
        }
        candidates.sort((a,b)=>distance(a,aim)-distance(b,aim));const alternative=candidates[0];if(alternative){s.x=alternative.x;s.z=alternative.z;w.metrics.distance+=movement;}
        return;}
      d.blockedFor=0;s.x=next.x;s.z=next.z;s.heading=Math.atan2(dx,dz);s.action=entering?'walking · entering trench':'walking · '+d.kind;s.cover=this.terrain.coverAt(s.x,s.z);w.metrics.distance+=movement;
      if(distanceLeft<movement+arrival)d.routeIndex++;
      return;
    }
    s.action=d.kind==='sleep'?'sleeping':d.kind==='meal'?'eating':d.kind==='rest'?'resting':d.kind==='construct'?'digging':d.kind==='haul'?'carrying supplies':d.kind==='watch'?'watching':'patrolling';
    if(d.pickupQueued){
      s.action='waiting for supply service';
      if(d.stage==='deliver'&&!d.patientId&&!d.facilityId){
        const store=w.facilities.find(f=>f.id===d.dropStoreId),stock=store?.stock??g.cache;
        if(total(stock)>=(store?w.logistics!.storeCapacity:w.logistics!.cacheCapacity))return;
      }
      const point=this.supplyPoint(g,s,d.stage==='deliver'?d.dropStoreId:d.pickupStoreId,true);
      if(point&&this.assignDuty(s,g,d.kind,point,'Supply queue called forward',30)){
        s.duty!.stage=d.stage;s.duty!.facilityId=d.facilityId;s.duty!.patientId=d.patientId;s.duty!.pickupStoreId=d.pickupStoreId;s.duty!.dropStoreId=d.dropStoreId;
      }return;
    }
    if(g.cutoff==='withdraw'){
      if(distance(s,g.forward)<10&&this.state.elapsed-d.arrivedAt>=6){
        const carried=s.carried??=inventory();
        // Take only the ration needed now. Early arrivals must not fill reserve
        // packs while the rest of the withdrawing column is still walking here.
        if(n.hunger>55)transferBounded(g.forwardStock,carried,'food',Math.max(0,.5-carried.food),carrierCapacity(carried,w.logistics!.carrierCapacity));
        if(n.thirst>55)transferBounded(g.forwardStock,carried,'water',Math.max(0,.5-carried.water),carrierCapacity(carried,w.logistics!.carrierCapacity));
        if(n.hunger>55&&carried.food>0||n.thirst>55&&carried.water>0){d.rationUntil=this.state.elapsed+6;s.action='eating';}
      }return;
    }
    if(d.kind==='watch'){if(!this.state.operation||s.aimTargetId===undefined)s.heading=this.state.living!.facilities.find(f=>f.id===d.facilityId)?.facing??g.front;return;}
    if(d.kind==='meal'&&this.state.elapsed-d.arrivedAt>=6){
      const carried=s.carried??=inventory();
      const portion=['warning','hold','recover','decision'].includes(g.cutoff)?.5:1;
      if(d.stage==='pickup'){
        const source=d.pickupStoreId?w.facilities.find(f=>f.id===d.pickupStoreId)?.stock:g.cache;
        // Collect a finite personal day pack, not one sip followed by another
        // round trip across the entire network. Rationing still governs use.
        if(source){const reserve=g.cutoff==='clear'?1:portion;
          if(this.state.operation)transfer(source,carried,'ammo',Math.max(0,60-carried.ammo));
          if(this.state.operation){const kit=equipmentOf(this.state,s);for(const key of ['medical','mortarHE','mortarSmoke','smokeGrenades'] as const){const target=key==='medical'?(kit.medicalKit?8:1):key==='smokeGrenades'?1:kit.mortar?4:0;transferBounded(source,carried,key,Math.max(0,target-carried[key]),carrierCapacity(carried,w.logistics!.carrierCapacity));}}
          s.ammunition=carried.ammo;
          transferBounded(source,carried,'water',Math.max(0,3*reserve-carried.water),carrierCapacity(carried,w.logistics!.carrierCapacity));
          transferBounded(source,carried,'food',Math.max(0,2*reserve-carried.food),carrierCapacity(carried,w.logistics!.carrierCapacity));
        }
        const facility=w.facilities.find(f=>f.id===d.facilityId&&f.progress===1);
        const nearbyFacility=facility&&distance(s,facility)<30?facility:undefined;
        const destination=(nearbyFacility?this.facilityDestination(nearbyFacility,s):undefined)??this.localMealPoint(g,s);
        if(this.assignDuty(s,g,'meal',destination,'Eating carried rations locally',12)){s.duty!.stage='deliver';s.duty!.facilityId=nearbyFacility?.id;}
      }else{
        if(s.needs!.hunger>20&&carried.food>0)s.needs!.hunger=Math.max(0,s.needs!.hunger-40*consume(this.state,carried,'food',Math.min(portion,carried.food)));
        if(s.needs!.thirst>20&&carried.water>0)s.needs!.thirst=Math.max(0,s.needs!.thirst-50*consume(this.state,carried,'water',Math.min(portion,carried.water)));
        delete s.duty;g.nextDecision=0;
      }
    }else if(d.kind==='haul'&&this.state.elapsed-d.arrivedAt>=3){
      const carried=s.carried??=inventory();
      if(d.stage==='pickup'){
        const source=d.patientId||d.facilityId?(d.pickupStoreId?w.facilities.find(f=>f.id===d.pickupStoreId)?.stock:g.cache):d.crateId?w.crates.find(c=>c.id===d.crateId)?.stock:g.forwardStock;
        const construction=w.facilities.find(f=>f.id===d.facilityId);
        if(construction&&source){const inTransit=this.people(g).filter(p=>p!==s&&p.duty?.facilityId===construction.id&&p.duty?.stage==='deliver').reduce((n,p)=>n+(p.carried?.materials??0),0);transfer(source,carried,'materials',Math.min(8-carried.materials,Math.max(0,construction.materialCost-construction.stock.materials-inTransit-carried.materials)));}
        else if(source){let space=Math.max(0,carrierCapacity(carried,w.logistics!.carrierCapacity)-total(carried));const local=localInventory(this.state,g),count=this.people(g).filter(p=>p.needs!.life!=='dead').length;
          if(!d.patientId)for(const key of ['medical','mortarHE','mortarSmoke','smokeGrenades'] as const)space-=transfer(source,carried,key,Math.min(space,Math.max(0,6-local[key])));
          const resources=this.state.operation&&local.ammo<count*2?['ammo','water','food','materials','fuel'] as const:local.food<local.water?['food','water','materials','ammo','fuel'] as const:['water','food','materials','ammo','fuel'] as const;
          for(const key of resources){const wanted=d.patientId?key==='food'||key==='water'?1:key==='ammo'&&this.state.operation?30:0:d.crateId?6:key==='materials'?Math.max(0,32-local.materials):key==='ammo'?Math.max(0,(this.state.operation?Math.min(300,count*6):5)-local.ammo):key==='fuel'?0:Math.max(0,count*2-local[key]);const amount=Math.min(space,wanted,key==='materials'?8:key==='ammo'?30:6);space-=transfer(source,carried,key,amount);}}
        const stores=w.facilities.filter(f=>f.garrisonId===g.id&&(f.kind==='store'||f.kind==='ammo')&&f.progress===1&&total(f.stock)<w.logistics!.storeCapacity);
        const store=stores.find(f=>f.kind==='ammo'&&carried.ammo>60)??stores.find(f=>f.kind==='store');
        const patient=this.state.soldiers.find(p=>p.id===d.patientId),destination=patient??(construction?this.state.trenches.find(t=>t.id===construction.connectorId)!.points[0]:this.supplyPoint(g,s,store?.id));
        if(this.assignDuty(s,g,'haul',destination,patient?'Delivering aid':construction?'Delivering construction materials':'Returning with supplies',180,Boolean(patient&&!this.network.corridorContains(patient)))){s.duty!.stage='deliver';s.duty!.patientId=d.patientId;s.duty!.facilityId=construction?.id;s.duty!.dropStoreId=store?.id;}
      }else{
        const patient=this.state.soldiers.find(p=>p.id===d.patientId);
        const construction=w.facilities.find(f=>f.id===d.facilityId);
        if(patient&&patient.needs?.life!=='dead'&&(distance(s,patient)>=1.3||!this.navigation.segmentClear(s,patient,.4)||d.networkBound&&!this.network.segmentInside(s,patient))){
          if(this.assignDuty(s,g,'haul',patient,'Following comrade to hand over supplies',180,!this.network.corridorContains(patient))){s.duty!.stage='deliver';s.duty!.patientId=patient.id;}
          return;
        }
        if(construction){transfer(carried,construction.stock,'materials',carried.materials);if(!construction.paid&&construction.stock.materials>=construction.materialCost){consume(this.state,construction.stock,'materials',construction.materialCost);construction.paid=true;}}
        else if(patient&&patient.needs?.life!=='dead'){
          if(patient.needs!.life==='active'){
            // An alert guard receives a real pack, then takes a timed break;
            // delivery itself does not magically remove hunger or thirst.
            if(this.state.operation){transfer(carried,patient.carried!,'ammo',Math.max(0,60-patient.carried!.ammo));patient.ammunition=patient.carried!.ammo;}
            transferBounded(carried,patient.carried!,'food',Math.max(0,2-patient.carried!.food),carrierCapacity(patient.carried!,w.logistics!.carrierCapacity));
            transferBounded(carried,patient.carried!,'water',Math.max(0,3-patient.carried!.water),carrierCapacity(patient.carried!,w.logistics!.carrierCapacity));
          }else{
            if(carried.food>=1){consume(this.state,carried,'food',1);patient.needs!.hunger=Math.max(0,patient.needs!.hunger-40);}
            if(carried.water>=1){consume(this.state,carried,'water',1);patient.needs!.thirst=Math.max(0,patient.needs!.thirst-50);}
          }
        }else {const store=d.dropStoreId?w.facilities.find(f=>f.id===d.dropStoreId):undefined,stock=store?.stock??g.cache,capacity=store?w.logistics!.storeCapacity:w.logistics!.cacheCapacity;
          const personalAmmo=this.state.operation?Math.min(60,carried.ammo):0;
          for(const key of RESOURCES)transferBounded(carried,stock,key,carried[key]-(key==='ammo'?personalAmmo:0),capacity);
          s.ammunition=carried.ammo;
          if(total(carried)-personalAmmo>.000001){
            // A full store must not let inbound haulers monopolize every loading
            // berth: consumers need those same berths to create storage space.
            const waiting=this.localMealPoint(g,s);
            if(this.assignDuty(s,g,'haul',{...waiting,pickupQueued:true},'Storage full; waiting aside with cargo',180)){s.duty!.stage='deliver';s.duty!.dropStoreId=d.dropStoreId;}
            return;
          }
        }
        // Mortality is scenario-controlled. A single successful delivery is not
        // evidence that the entire supply/recovery loop is safe at every scale.
        delete s.duty;g.nextDecision=0;
      }
    }else if(d.kind==='construct'){
      const f=w.facilities.find(f=>f.id===d.facilityId);if(!f||f.progress===1){delete s.duty;return;}
      const t=this.state.trenches.find(t=>t.id===f.connectorId)!;
      const workRate=.6+s.morale*.004;
      this.construction.applyWork({kind:'facility',id:f.id},dt,workRate);
      if(t.progress<1)d.until=Math.min(d.until,this.state.elapsed+2);
    }
  }
  private planSupport(g:Garrison,people:SoldierState[]):void {
    if(!people.some(s=>this.isEngineer(s)&&s.needs!.life==='active'))return;
    const w=this.state.living!,existing=w.facilities.filter(f=>f.garrisonId===g.id);
    if(existing.some(f=>f.progress<1)){
      for(const q of this.state.squads.filter(q=>squadHasEquipment(this.state,q,'tools')&&g.squadIds.includes(q.id)&&q.order.type==='occupy-trench'))for(const f of existing.filter(f=>f.progress<1)){
        if(!q.constructionQueue?.some(j=>typeof j!=='number'&&j.kind==='facility'&&j.id===f.id))(q.constructionQueue??=[]).push({kind:'facility',id:f.id});
      }return;
    }
    const weapons:Facility['kind'][]=g.faction==='enemy'?(['emplacement','mortar'] as const).filter(kind=>g.squadIds.some(id=>positionOperator(this.state,id,kind))):[];
    const kinds:Facility['kind'][]=[...weapons,...(this.state.operation?.casualtyRules?['aid','rest','meal','store'] as const:['rest','meal','store'] as const)];
    const kind=kinds.find(k=>!existing.some(f=>f.kind===k));if(!kind)return;
    if(localInventory(this.state,g).materials<SUPPORT_WORKS[kind].cost)return;
    this.requestFacility(g.id,kind);
  }
  requestFacility(garrisonId:number,kind:Facility['kind'],position?:Vec2,origin?:Vec2):number|undefined {
    const g=this.state.living!.garrisons.find(g=>g.id===garrisonId);if(!g)return;
    const existing=this.state.living!.facilities.filter(f=>f.garrisonId===g.id);
    const valid=(from:Vec2,to:Vec2)=>!facilitySiteReason(this.state,g,from,to,this.terrain,this.navigation,this.network);
    if(position&&origin)return valid(origin,position)?this.construction.request({kind:'facility',garrisonId:g.id,facilityKind:kind,origin,position}):undefined;
    const component=this.network.component(g.trenchId),points=component===undefined?[]:this.network.samples(component,10);if(!points.length)return;
    const from=points[Math.min(points.length-1,existing.length*2+1)];
    for(let attempt=0;attempt<8;attempt++){
      const angle=g.front+Math.PI+(attempt-3.5)*.2,to={x:from.x+Math.sin(angle)*12,z:from.z+Math.cos(angle)*12};
      if(!valid(from,to)||this.network.nearest(to)!.distance<5)continue;
      return this.construction.request({kind:'facility',garrisonId:g.id,facilityKind:kind,origin:from,position:to});
    }
  }
  private workPoint(origin:Vec2,head:Vec2,progress:number,s:SoldierState):Vec2|undefined {
    const length=distance(origin,head),dx=(head.x-origin.x)/length,dz=(head.z-origin.z)/length;
    for(let row=0;row<4;row++)for(const side of [-1,1]){
      const along=Math.max(0,Math.floor(length*progress)-row*1.2),p={x:origin.x+dx*along+dz*side*1.2,z:origin.z+dz*along-dx*side*1.2};
      if(!this.state.soldiers.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,p)<.7||o.duty&&distance(o.duty.destination,p)<1)))return p;
    }return undefined;
  }
  private servicePoint(g:Garrison,s:SoldierState):Vec2|undefined {
    const component=this.network.component(g.trenchId),points=component===undefined?[]:this.network.samples(component,1);
    const p=points.filter(p=>distance(p,g.entrance)<10&&distance(p,g.entrance)>2).sort((a,b)=>distance(a,g.entrance)-distance(b,g.entrance));
    for(const source of p)for(const side of [-1,1]){
      const candidate=this.bermPoint(source,side);
      if(!this.state.soldiers.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,candidate)<1.1||o.duty&&distance(o.duty.destination,candidate)<1.1)))return candidate;
    }
    // A full service area queues the request; never reserve an occupied fallback.
    return undefined;
  }
  private forwardServicePoint(g:Garrison,s:SoldierState):Vec2|undefined {
    const candidates:Vec2[]=[],side=Math.sign(g.entrance.z-g.forward.z)||1;
    for(let row=0;row<4;row++)for(let column=-3;column<=3;column++)candidates.push({x:g.forward.x+column*1.4,z:g.forward.z+side*(2+row*1.4)});
    candidates.sort((a,b)=>distance(s,a)-distance(s,b));
    const accessible=candidates.filter(p=>!this.terrain.obstacleAt(p.x,p.z,.5)&&this.terrain.groundTypeAt(p.x,p.z)!=='river');
    return firstAvailablePoint(accessible,s,this.state.soldiers,.8,1);
  }
  private localMealPoint(g:Garrison,s:SoldierState):Vec2 {
    const component=this.network.component(g.trenchId),points=component===undefined?[]:this.network.samples(component,1);
    const candidates=points.filter(p=>distance(p,s)<12&&distance(p,g.entrance)>11).map(p=>this.bermPoint(p,-1)).sort((a,b)=>distance(a,s)-distance(b,s));
    return candidates.find(p=>!this.state.soldiers.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,p)<.8||o.duty&&distance(o.duty.destination,p)<1)))??{x:s.x,z:s.z};
  }
  private facilityDestination(f:Facility,s:SoldierState):Vec2|undefined {
    const frame=facilityFrame(f,this.state.trenches.find(t=>t.id===f.connectorId));
    for(let i=0;i<9;i++){
      if(f.kind==='rest'&&i===4)continue;
      const spacing=f.kind==='rest'?1.8:1.4,p=facilityPoint(frame,(i%3-1)*spacing,(Math.floor(i/3)-1)*spacing);
      if(!this.state.soldiers.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,p)<.8||o.duty&&distance(o.duty.destination,p)<1)))return p;
    }return undefined;
  }
  private localDetour(s:SoldierState,target:Vec2,accessible:(point:Vec2)=>boolean):Vec2[] {
    // Open-ground approach/exit routes may detour around the entrance mouth.
    // Being within two metres of it does not turn an exterior walker into an
    // interior occupant and trap them outside the end cap.
    const neighbors=this.nearby(s,7).filter(o=>o!==s&&o.needs?.life!=='dead'&&distance(o,s)<7);
    const clear=(p:Vec2)=>accessible(p)&&!this.terrain.obstacleAt(p.x,p.z,.4)&&neighbors.every(o=>distance(o,p)>.58);
    const nodes=[{x:s.x,z:s.z,gx:0,gz:0,parent:-1}],visited=new Set(['0,0']);let best=-1,bestDistance=distance(s,target);
    for(let at=0;at<nodes.length&&at<220;at++){
      const n=nodes[at],remaining=distance(n,target);
      if(remaining<bestDistance-.15){best=at;bestDistance=remaining;if(remaining<.5)break;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const gx=n.gx+dx,gz=n.gz+dz,key=`${gx},${gz}`;if(Math.abs(gx)>7||Math.abs(gz)>7||visited.has(key))continue;visited.add(key);
        const p={x:s.x+gx*.55,z:s.z+gz*.55};
        if(clear(p)&&clear({x:(n.x+p.x)/2,z:(n.z+p.z)/2}))nodes.push({...p,gx,gz,parent:at});
      }
    }
    if(best<0||distance(s,target)-bestDistance<.8)return [];
    const path:Vec2[]=[];for(let i=best;i>0;i=nodes[i].parent)path.unshift({x:nodes[i].x,z:nodes[i].z});
    return path;
  }
  private nearby(point:Vec2,radius:number):SoldierState[]{
    // Buckets were built at the start of this step. Include the maximum movement
    // since then so this query also finds neighbors that have crossed a cell edge.
    const reach=Math.ceil((radius+this.stepMovementBound)/2),cx=Math.floor(point.x/2),cz=Math.floor(point.z/2),result:SoldierState[]=[];
    for(let x=cx-reach;x<=cx+reach;x++)for(let z=cz-reach;z<=cz+reach;z++)result.push(...this.cells.get(`${x},${z}`)??[]);
    return result;
  }
  private reliefPoint(old:SoldierState,relief:SoldierState):Vec2|undefined {
    const p=old.duty!.watchPost??old.duty!.destination,hit=this.network.nearest(p)! ,e=this.network.edges[hit.edge],a=this.network.nodes[e.a],b=this.network.nodes[e.b];
    for(const shift of [1.25,-1.25,2.5,-2.5]){
      const candidate={x:p.x+(b.x-a.x)/e.length*shift,z:p.z+(b.z-a.z)/e.length*shift},near=this.network.nearest(candidate);
      if(near&&near.distance<this.network.edges[near.edge].width*.4&&distance(old,candidate)>.9&&!this.state.soldiers.some(s=>s!==relief&&s!==old&&(distance(s,candidate)<.7||s.duty&&distance(s.duty.destination,candidate)<.9)))return candidate;
    }
    // Wait for a real berth instead of assigning an occupied fallback or drifting the post.
    return undefined;
  }
  private supplySource(g:Garrison,key:Resource):{storeId?:number} {
    if(g.cache[key]>0)return {};
    const store=this.state.living!.facilities.find(f=>f.garrisonId===g.id&&(f.kind==='store'||f.kind==='ammo')&&f.progress===1&&f.stock[key]>0);
    return {storeId:store?.id};
  }
  private supplyPoint(g:Garrison,s:SoldierState,storeId?:number,called=false):(Vec2&{pickupQueued?:boolean})|undefined {
    const store=this.state.living!.facilities.find(f=>f.id===storeId),base=store??g.entrance;
    // Do not reserve a loading berth during a minutes-long walk from the front.
    // Distant consumers first join a physical approach queue, then claim service.
    if(!called&&distance(s,base)>20){
      const component=this.network.component(g.trenchId),points=component===undefined?[]:this.network.samples(component,1);
      const candidates=points.filter(p=>distance(p,base)>12&&distance(p,base)<32).map(p=>this.bermPoint(p,-1)).sort((a,b)=>distance(s,a)-distance(s,b));
      const point=firstAvailablePoint(candidates,s,this.state.soldiers,.8,1.1);
      return point?{...point,pickupQueued:true}:undefined;
    }
    return store?this.facilityDestination(store,s):this.servicePoint(g,s);
  }
}
