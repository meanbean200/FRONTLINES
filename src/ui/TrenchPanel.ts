import {distance,polylineLength,pointAlongPolyline,type Vec2,type TrenchState,type SoldierState} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {StrategyCamera} from '../render/StrategyCamera';
import type {PersonalOrder,Facility,Readiness} from '../garrison/types';
import {friendlyTrenches,connectedName,networkRepresentatives,trenchPeople,distanceToPolyline} from './TrenchReadout';
import {fieldIcon} from './FieldSymbols';
import {facilityName,WEAPON_POSITIONS} from '../construction/PositionDefinitions';
import {positionReadiness,crewAt,crewOperator,carriesPositionWeapon,type WeaponPositionKind} from '../combat/WeaponPositions';
import {equipmentOf} from '../combat/Equipment';
import {workReadout,networkSupply,trenchWorkReadout,shipmentReadout} from './PositionReadout';
import {SUPPLY_LABELS} from './PositionReadout';
import {claimed,unfulfilled} from '../garrison/SupplyDemand';
import {supportReadiness} from '../combat/SupportWeapons';
import {placeMapLabels} from './MapLabels';
import {buildingReadout} from './BuildingReadout';
import {knownTrenchNetworks,type KnownTrenchNetwork} from '../operations/TrenchIntelligence';
import {preparedStatus} from '../operations/PreparedOrders';
import {clippedPaths} from './ProjectedPaths';
import {networkCapacity} from '../garrison/NetworkCapacity';
import {updateLiveContent} from './LiveContent';
import {raidEligibility} from '../operations/RaidEligibility';
import {deathDescription} from '../simulation/DeathRecord';
import {manpowerPools} from '../garrison/Manpower';
import {readyDefender} from '../garrison/PersonnelRoles';
import {activeSupportMission,supportPositionStatus} from './WeaponReadout';

interface Actions {defend:(id:number)=>void;resume:(id:number)=>void;area:(id:number)=>void;move:(watch?:boolean)=>void;cancel:()=>void;notify:(text:string)=>void;place:(id:number,kind:Facility['kind'])=>void;fire:(id:number,kind:'mortarHE'|'mortarSmoke',battery?:boolean)=>void;person:()=>void}
type Page='overview'|'personnel'|'weapons'|'construction'|'supplies';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** One contextual inspector. Inventory is read-only; explicit buttons call simulation commands. */
export class TrenchPanel {
  readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private readonly overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private readonly labels=document.createElement('div');
  private trenchId=0;private personId=0;private facilityId=0;private truckId=0;private page:Page='overview';private last=0;private key='';private assign:'crew'|'worker'|undefined;
  private buildingId=-1;private buildingSquad=0;private buildingFloor:0|1=0;
  private cachedTrenches:TrenchState[]=[];private cachedFacilities:Facility[]=[];private hovered=0;private pointer?:{x:number;y:number};private watchMove=false;
  private readonly hint=document.createElement('div');
  private readonly signal=document.createElement('button');
  private enemy?:KnownTrenchNetwork;
  private includeWeaponCrews=false;
  private workParty?:{ids:number[];name:string};
  private partyTarget=false;
  private projectedPerson?:SoldierState;
  private hoverFacility?:Facility;
  private lines:TrenchState[]=[];
  private entries:{id:number;type:string;point:Vec2;name:string}[]=[];
  get showRoutes(){return !this.element.hidden&&this.page==='supplies';}
  get inspectedBuilding(){return !this.element.hidden&&this.buildingId>=0?this.buildingId:undefined;}
  get inspectedFloor(){return this.buildingFloor;}
  constructor(private sim:BattlefieldSimulation,private camera:StrategyCamera,private selected:ReadonlySet<number>,private actions:Actions){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.signal.id='signal-orders';this.signal.hidden=true;this.signal.onclick=()=>{this.sim.signalPrepared();this.actions.notify(this.sim.lastSignalReason);};root.append(this.signal);
    this.button.id='trenches-command';this.button.innerHTML=fieldIcon('defend')+'Positions';this.button.setAttribute('aria-expanded','false');root.querySelector('.hud-tools summary')!.after(this.button);
    this.element.id='trench-panel';this.element.className='trench-panel position-inspector';this.element.hidden=true;this.element.setAttribute('aria-label','Position management');
    this.element.innerHTML='<header><div><small>POSITION / TRENCH NETWORK</small><h2>Position</h2></div><button data-close aria-label="Close position management">×</button></header><label class="position-picker">Trench<select id="trench-choice" aria-label="Trench"></select></label><nav class="position-tabs" aria-label="Position pages">'+(['overview','personnel','weapons','construction','supplies'] as Page[]).map(p=>'<button data-page="'+p+'">'+({overview:'Overview',personnel:'People',weapons:'Weapons',construction:'Build',supplies:'Supplies'}[p])+'</button>').join('')+'</nav><div class="position-content"></div>';
    root.append(this.element);this.overlay.classList.add('trench-inspection-overlay');this.overlay.setAttribute('aria-hidden','true');this.labels.className='position-labels';this.hint.className='position-hover';this.hint.hidden=true;root.append(this.labels,this.hint);document.querySelector('#app')!.append(this.overlay);
    this.button.onclick=()=>this.element.hidden?this.open():this.close();this.element.addEventListener('click',e=>this.click(e));
    this.element.querySelector('#trench-choice')!.addEventListener('change',e=>{this.trenchId=Number((e.target as HTMLSelectElement).value);this.facilityId=this.personId=this.truckId=0;this.clearPerson();this.assign=undefined;this.update(true);this.focus();});
    this.element.addEventListener('change',e=>{
      const select=e.target as HTMLSelectElement;if(this.locked())return;
      if(select.hasAttribute('data-raid-release-crews')){this.includeWeaponCrews=(select as unknown as HTMLInputElement).checked;this.update(true);return;}
      if(select.hasAttribute('data-artillery-front')){this.actions.notify(this.sim.garrisons.setArtilleryFacing(this.facilityId,Number(select.value)).reason);this.update(true);return;}
      const id=Number(select.dataset.network),network=this.sim.garrisons.network,root=this.sim.state.living!.garrisons.find(g=>g.id===id),component=root&&network.component(root.trenchId);
      for(const g of this.sim.state.living!.garrisons.filter(g=>g.faction!=='enemy'&&component!==undefined&&network.component(g.trenchId)===component)){
        if(select.id==='garrison-readiness')this.sim.garrisons.setReadiness(g.id,select.value as Readiness);
        if(select.id==='garrison-front')this.sim.garrisons.setFront(g.id,Number(select.value));
      }
    });
    this.labels.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(b?.dataset.trench)this.open(Number(b.dataset.trench));if(b?.dataset.facility)this.chooseFacility(Number(b.dataset.facility));});
    window.addEventListener('pointermove',e=>{this.pointer=e.target instanceof HTMLCanvasElement?{x:e.clientX,y:e.clientY}:undefined;});
    window.addEventListener('frontlines-menu',()=>this.close());
    root.addEventListener('click',e=>{if((e.target as Element).closest('#build-command,#support-command,[data-hud-panel]'))this.close();});
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.element.hidden){this.close();e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  private locked(){return this.sim.commandsLocked||Boolean(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.replay);}
  open(id?:number):void {window.dispatchEvent(new Event('frontlines-menu'));this.enemy=knownTrenchNetworks(this.sim.state).find(n=>n.id===id&&!friendlyTrenches(this.sim.state,this.sim.garrisons.network).some(t=>t.id===id));this.buildingId=-1;this.trenchId=id??this.trenchId;this.facilityId=this.personId=this.truckId=0;this.assign=undefined;this.page='overview';this.element.hidden=false;document.documentElement.dataset.positionOpen='true';this.button.setAttribute('aria-expanded','true');this.update(true);this.element.scrollTop=0;}
  openConstruction(id?:number):void{this.open(id);this.page='construction';this.update(true);}
  close():void{this.element.hidden=true;this.personId=0;this.workParty=undefined;this.partyTarget=false;this.projectedPerson=undefined;this.overlay.replaceChildren();this.labels.replaceChildren();delete this.labels.dataset.key;this.button.setAttribute('aria-expanded','false');delete document.documentElement.dataset.personSelected;delete document.documentElement.dataset.positionOpen;this.actions.cancel();}
  clearPerson():void{this.personId=0;this.workParty=undefined;this.partyTarget=false;delete document.documentElement.dataset.personSelected;this.actions.cancel();this.update(true);}
  private focus():void{const f=this.sim.state.living!.facilities.find(f=>f.id===this.facilityId),t=this.sim.state.trenches.find(t=>t.id===this.trenchId);if(f)this.camera.focus(f,55);else if(t)this.camera.focus(pointAlongPolyline(t.points,.5),Math.max(80,Math.min(600,polylineLength(t.points)*1.5)));}
  inspectFacility(id:number):boolean{const f=this.sim.state.living!.facilities.find(f=>f.id===id),g=this.sim.state.living!.garrisons.find(g=>g.id===f?.garrisonId);if(!f||!g||g.faction==='enemy')return false;this.open(f.trenchAnchor?.trenchId??g.trenchId);this.facilityId=id;this.page=f.progress<1?'construction':['emplacement','mortar'].includes(f.kind)?'weapons':'overview';this.update(true);return true;}
  inspectPerson(id:number):boolean{
    const s=this.sim.state.soldiers.find(s=>s.id===id);if(!s||this.sim.state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')return false;
    const choices=friendlyTrenches(this.sim.state,this.sim.garrisons.network).sort((a,b)=>distanceToPolyline(s,a.points).distance-distanceToPolyline(s,b.points).distance);
    this.open(choices[0]?.id);this.personId=id;this.page='personnel';document.documentElement.dataset.personSelected='true';this.actions.person();this.update(true);return true;
  }
  inspectAt(point:Vec2):boolean{
    const building=this.sim.terrain.buildingAt(point);if(building!==undefined){this.open();this.buildingId=building;this.buildingSquad=0;this.buildingFloor=0;this.update(true);return true;}
    const f=this.cachedFacilities.find(f=>distance(f,point)<(f.trenchAnchor?2.2:4));if(f)return this.chooseFacility(f.id);
    const truck=this.sim.state.living!.trucks.find(t=>t.faction!=='enemy'&&distance(t,point)<4);if(truck){const g=this.sim.state.living!.garrisons.find(g=>g.id===truck.garrisonId);this.open(g?.trenchId);this.truckId=truck.id;this.page='supplies';this.update(true);return true;}
    const t=this.cachedTrenches.find(t=>distanceToPolyline(point,t.points).distance<Math.max(3,t.width/2));if(t){this.open(t.id);return true;}
    const known=knownTrenchNetworks(this.sim.state).find(n=>n.sections.some(s=>distanceToPolyline(point,s.points).distance<s.width/2+1));if(!known)return false;this.open(known.id);return true;
  }
  private chooseFacility(id:number):boolean{
    const f=this.cachedFacilities.find(f=>f.id===id);
    if(this.personId&&f&&['emplacement','mortar'].includes(f.kind)){
      if(this.locked())return false;
      this.actions.notify(this.sim.garrisons.assignCrew(this.personId,f.id).reason);this.update(true);return true;
    }return this.inspectFacility(id);
  }
  movePerson(point:Vec2):boolean{
    if(this.locked()||this.element.hidden)return false;
    if(this.workParty&&this.partyTarget){
      const personIds=this.workParty.ids.slice(),ids=[...new Set(this.sim.state.soldiers.filter(s=>personIds.includes(s.id)).map(s=>s.squadId))];
      const known=knownTrenchNetworks(this.sim.state).find(n=>n.sections.some(s=>distanceToPolyline(point,s.points).distance<s.width/2+1));
      const n=this.sim.prepareOrder(ids,'assault',point,known?.id,false,undefined,{includeWorkers:true,personIds});
      this.actions.notify(n?'Work party preview · review actual people before GO':'Selected people are unavailable or already committed');
      if(n)this.close();return n>0;
    }
    const result=this.sim.garrisons.orderPerson(this.personId,this.watchMove?'watch':'move',point);this.actions.notify(result.reason);this.update(true);return result.accepted;
  }
  private click(e:Event):void{
    const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
    if(b.hasAttribute('data-close')){this.close();return;}if(b.dataset.page){this.page=b.dataset.page as Page;this.assign=undefined;this.update(true);return;}
    if(b.dataset.person){this.inspectPerson(Number(b.dataset.person));return;}if(b.dataset.position){this.inspectFacility(Number(b.dataset.position));return;}
    if(b.dataset.locate){const truck=this.sim.state.living!.trucks.find(t=>t.id===Number(b.dataset.locate));if(truck)this.camera.focus(truck,80);return;}
    if(b.hasAttribute('data-focus')){this.focus();return;}
    if(b.dataset.trenchJob){this.open(Number(b.dataset.trenchJob));this.page='construction';this.update(true);this.focus();return;}
    if(this.locked())return;
    if(b.dataset.selectPool){
      const t=this.sim.state.trenches.find(t=>t.id===this.trenchId);if(!t)return;
      const pools=manpowerPools(this.sim.state,trenchPeople(this.sim.state,this.sim.garrisons.network,t)),pool=b.dataset.selectPool==='workers'?'workers':'available';
      this.workParty={ids:pools[pool].slice(),name:pool==='workers'?'Work party':'Available personnel'};this.personId=0;this.partyTarget=false;this.page='personnel';
      document.documentElement.dataset.personSelected='true';this.actions.person();this.actions.cancel();this.update(true);return;
    }
    if(b.hasAttribute('data-party-clear')){this.clearPerson();return;}
    if(b.hasAttribute('data-party-assault')&&this.workParty){this.partyTarget=true;this.actions.move();this.actions.notify('Click the assault destination · only this selected group will be reviewed. No orders change before GO.');return;}
    if(this.enemy){
      const target=this.enemy.point,ids=[...this.selected];
      if(b.hasAttribute('data-enemy-locate'))this.camera.focus(target,140);
      if(b.hasAttribute('data-signal')){this.sim.signalPrepared();this.actions.notify(this.sim.lastSignalReason);}
      if(b.hasAttribute('data-cancel-prepared'))this.sim.cancelPrepared();
      if(b.hasAttribute('data-secure-network')){const taken=this.sim.assignGarrison(ids,this.enemy.id);this.actions.notify(taken?'Position secured · installed equipment and stores retained':this.sim.garrisons.lastAssignment.reason);if(taken)this.enemy=undefined;this.update(true);return;}
      const action=b.dataset.enemyAction;
      if(action){const intent=(action==='approach'?'move':action==='stage'?'assault':action==='stage-support'?'suppress':action) as 'move'|'observe'|'suppress'|'assault';
        if(!ids.length)this.actions.notify('Select the formations first · Shift-click adds squads');
        else if(action.startsWith('stage')||action==='assault'){const n=this.sim.prepareOrder(ids,intent,target,this.enemy.id,this.includeWeaponCrews);this.actions.notify(n?'Review personnel and consequences · current duties continue until GO':'No eligible personnel · protected roles remain at their posts');this.includeWeaponCrews=false;if(intent==='assault')this.close();}
        else this.sim.issueTactical(ids,intent,target);
      }
      this.update(true);return;
    }
    if(this.buildingId>=0){
      const picker=this.element.querySelector<HTMLSelectElement>('[data-building-squad]');this.buildingSquad=Number(picker?.value??0);
      const ids=this.buildingSquad?[this.buildingSquad]:[...this.selected];
      if(b.dataset.viewFloor!==undefined)this.buildingFloor=Number(b.dataset.viewFloor) as 0|1;
      if(b.dataset.floor!==undefined){if(!ids.length)this.actions.notify('Choose a formation to occupy this building.');else{this.buildingFloor=Number(b.dataset.floor) as 0|1;this.sim.issueBuilding(ids,this.buildingId,this.buildingFloor);this.actions.notify('Occupy ordered · enter through the doorway.');}}
      if(b.hasAttribute('data-building-exit')){const inside=buildingReadout(this.sim.state,this.sim.terrain,this.buildingId)!.people;this.sim.issueHold(ids.length?ids:[...new Set(inside.map(s=>s.squadId))]);this.actions.notify('Exit ordered · troops leave through the doorway.');}
      if(b.hasAttribute('data-building-locate'))this.camera.focus(this.sim.terrain.buildings[this.buildingId],65);
      this.update(true);return;
    }
    const f=this.sim.state.living!.facilities.find(f=>f.id===this.facilityId);
    if(b.dataset.order){const order=b.dataset.order as PersonalOrder;if(order==='move'||order==='watch'){this.watchMove=order==='watch';this.actions.move(this.watchMove);this.actions.notify('Click excavated trench floor · only this person moves.');}else this.actions.notify(this.sim.garrisons.orderPerson(this.personId,order).reason);}
    if(b.dataset.place){this.actions.place(-this.trenchId,b.dataset.place as Facility['kind']);this.close();}
    if(b.hasAttribute('data-defend'))this.actions.defend(this.trenchId);
    if(b.hasAttribute('data-resume'))this.actions.resume(this.trenchId);
    if(b.dataset.assign){this.assign=b.dataset.assign as 'crew'|'worker';}
    if(b.dataset.choose&&f){this.actions.notify((this.assign==='crew'?this.sim.garrisons.assignCrew(Number(b.dataset.choose),f.id):this.sim.garrisons.assignWorker(f.id,Number(b.dataset.choose))).reason);if(this.assign==='crew'&&f.weaponCrewIds?.length===2)this.assign=undefined;}
    if(b.hasAttribute('data-auto-crew')&&f)this.actions.notify(this.sim.garrisons.autoCrew(f.id).reason);
    if(b.hasAttribute('data-replace-crew')&&f){f.autoReplaceCrew=!f.autoReplaceCrew;this.actions.notify(f.autoReplaceCrew?'Local crew replacement enabled · unavailable people are not recruited':'Crew replacement is manual');}
    if(b.hasAttribute('data-auto-workers')&&f)this.actions.notify(this.sim.garrisons.autoWorkers(f.id).reason);
    if(b.hasAttribute('data-cancel-work')&&f)this.actions.notify(this.sim.garrisons.cancelWork(f.id).reason);
    if(b.dataset.reviewSupply)this.sim.garrisons.reopenEmergency(Number(b.dataset.reviewSupply));
    if(b.dataset.remove&&f)this.sim.garrisons.removeCrew(f.id,Number(b.dataset.remove));
    if(b.hasAttribute('data-remove-all')&&f)this.sim.garrisons.removeCrew(f.id);
    if(b.dataset.removeWorker&&f?.workOrder){const id=Number(b.dataset.removeWorker);this.actions.notify(this.sim.garrisons.orderPerson(id,'auto').reason);}
    if(b.dataset.fire&&f){this.actions.fire(f.id,b.dataset.fire as 'mortarHE'|'mortarSmoke',b.hasAttribute('data-battery'));this.close();}
    this.update(true);
  }
  update(force=false):void{
    const state=this.sim.state,network=this.sim.garrisons.network;this.button.disabled=this.locked();
    const prepared=state.preparedOrders?.filter(o=>o.releasedAt===undefined)??[];this.signal.hidden=!prepared.length||prepared.some(o=>o.assault)||this.locked();this.signal.textContent=`GO · ${prepared.length} prepared`;this.signal.disabled=prepared.every(o=>o.signalAt!==undefined);
    // The existing emergency decision owns the right drawer until it is answered.
    if(!this.element.hidden&&state.living!.garrisons.some(g=>g.faction!=='enemy'&&g.cutoff==='decision'))this.close();
    if(force||performance.now()-this.last>250){
      this.last=performance.now();this.cachedTrenches=friendlyTrenches(state,network);this.cachedFacilities=state.living!.facilities.filter(f=>state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction!=='enemy');
      this.hovered=0;const p=this.pointer?this.camera.groundPoint(this.pointer.x,this.pointer.y):undefined;
      const hover=p?this.cachedFacilities.find(f=>distance(f,p)<(f.trenchAnchor?2.2:4)):undefined;
      this.hoverFacility=hover;this.projectedPerson=state.soldiers.find(s=>s.id===this.personId);
      if(p&&!hover)this.hovered=this.cachedTrenches.find(t=>distanceToPolyline(p,t.points).distance<3)?.id??0;
      const house=p?this.sim.terrain.buildingAt(p):undefined;
      this.hint.hidden=(!hover&&house===undefined)||this.locked();if(hover){this.hint.textContent=facilityName(state,hover)+'\n'+(hover.progress<1?workReadout(state,hover).status:['emplacement','mortar'].includes(hover.kind)?positionReadiness(state,hover)||'READY':'COMPLETE')+' · Click to manage';}else if(house!==undefined)this.hint.textContent=buildingReadout(state,this.sim.terrain,house)!.name+' · Click to occupy / inspect';
      if(!this.element.hidden)this.renderContent();
      const component=network.component(this.hovered||this.trenchId);
      this.lines=this.cachedTrenches.filter(t=>t.id===(this.hovered||this.trenchId)||component!==undefined&&network.component(t.id)===component).slice(0,60);
      this.entries=[...networkRepresentatives(this.cachedTrenches,network).slice(0,60).map(t=>({id:t.id,type:'trench',point:pointAlongPolyline(t.points,.5),name:connectedName(state,network,t.id)})),...this.cachedFacilities.filter(f=>this.lines.some(t=>t.id===f.connectorId)||f.id===this.facilityId).slice(0,60).map(f=>({id:f.id,type:'facility',point:f,name:facilityName(state,f)}))];
    }
    this.project();
  }
  private renderContent():void{
    const state=this.sim.state,network=this.sim.garrisons.network;
    if(this.enemy){const current=knownTrenchNetworks(state).find(n=>n.id===this.enemy!.id);if(current)this.enemy=current;else if(friendlyTrenches(state,network).some(t=>t.id===this.enemy!.id))this.enemy=undefined;}
    if(this.enemy){
      this.element.querySelector('header small')!.textContent='OBSERVED TERRAIN / NOT LIVE INTELLIGENCE';this.element.querySelector('h2')!.textContent=this.enemy.name;
      for(const e of this.element.querySelectorAll<HTMLElement>('.position-picker,.position-tabs'))e.hidden=true;
      const eligibility=raidEligibility(state,[...this.selected],this.includeWeaponCrews);
      const orders=(state.preparedOrders??[]).filter(o=>o.networkId===this.enemy!.id),html='<p>'+Math.round(this.enemy.length)+' m known · occupants unknown</p><p>Orders target remembered ground. Unseen extensions and current strength are not reported.</p><div class="position-actions">'+[['observe','Observe'],['suppress','Suppress'],['approach','Approach'],['assault','Assault'],['stage','Prepare assault'],['stage-support','Prepare support']].map(([id,label])=>'<button data-enemy-action="'+id+'" '+(!this.selected.size?'disabled':'')+'>'+label+'</button>').join('')+'<button data-enemy-locate>Locate</button><button data-secure-network '+(!this.selected.size?'disabled':'')+'>Secure & defend</button></div>'+orders.map(o=>'<p>'+esc(state.squads.find(q=>q.id===o.squadId)?.name)+' · '+esc(o.intent)+'<small>'+preparedStatus(state,o)+'</small></p>').join('')+(orders.length?'<div class="position-actions"><button data-signal>GO · signal all</button><button data-cancel-prepared>Cancel prepared orders</button></div>':'');
      const view=`<p>${eligibility.people} eligible individuals in ${eligibility.eligible.length} formations. Normal assault preserves station crews and workers without holding the rest of their squads.</p><label><input type="checkbox" data-raid-release-crews ${this.includeWeaponCrews?'checked':''}> Preview ALL IN · review crew/work consequences before GO</label>`+html;
      if(this.key!==view){this.key=view;updateLiveContent(this.element.querySelector('.position-content')!,view);}return;
    }
    const house=this.buildingId>=0?buildingReadout(state,this.sim.terrain,this.buildingId):undefined;
    this.element.querySelector('header small')!.textContent=house?'BUILDING / OCCUPATION':'POSITION / TRENCH NETWORK';
    for(const e of this.element.querySelectorAll<HTMLElement>('.position-picker,.position-tabs'))e.hidden=Boolean(house);
    if(house){
      this.element.querySelector('h2')!.textContent=house.name;
      const old=this.element.querySelector<HTMLSelectElement>('[data-building-squad]');if(old)this.buildingSquad=Number(old.value);
      const floors=house.floors.map(f=>'<article class="position-job"><h3>'+(f.floor?'Upper floor':'Ground floor')+'</h3><p>'+f.ready+' / '+f.capacity+' firing places · '+f.inside+' indoors · '+f.incoming+' approaching'+(f.casualties?' · '+f.casualties+' wounded':'')+'</p><div class="position-actions"><button data-floor="'+f.floor+'" '+(f.reserved>=f.capacity?'disabled':'')+'>'+(f.reserved>=f.capacity?'Firing places full':'Occupy '+(f.floor?'upper':'ground')+' floor')+'</button><button data-view-floor="'+f.floor+'" aria-pressed="'+(f.floor===this.buildingFloor)+'">View floor</button></div></article>').join('');
      const html='<strong class="position-status">'+house.condition.toUpperCase()+'</strong><p>Troops use doors and stairs. Supply breaks retain their original floor and window.</p><label>Formation<select data-building-squad><option value="0">'+(this.selected.size?'Selected formations ('+this.selected.size+')':'Choose formation')+'</option>'+house.squads.map(q=>'<option value="'+q.id+'" '+(q.id===this.buildingSquad?'selected':'')+'>'+esc(q.name)+'</option>').join('')+'</select></label>'+floors+'<div class="position-actions"><button data-building-exit '+(!house.people.length?'disabled':'')+'>Exit building</button><button data-building-locate>Locate occupants</button></div><h3>Assigned personnel</h3>'+house.people.map(s=>'<p>'+esc(state.squads.find(q=>q.id===s.squadId)?.name)+' '+String(state.squads.find(q=>q.id===s.squadId)!.soldierIds.indexOf(s.id)+1).padStart(2,'0')+' · '+esc(s.needs?.life==='active'?s.action:s.needs?.life)+'<small>'+esc(s.survivalReason??s.combat?.pauseReason??'')+'</small><small>Energy '+Math.round(s.needs?.energy??0)+' · hunger '+Math.round(s.needs?.hunger??0)+' · thirst '+Math.round(s.needs?.thirst??0)+'</small></p>').join('');
      const key='building:'+html;if(key!==this.key){this.key=key;updateLiveContent(this.element.querySelector('.position-content')!,html);}
      if(this.locked())for(const b of this.element.querySelectorAll<HTMLButtonElement>('.position-content button:not([data-building-locate])'))b.disabled=true;
      return;
    }
    if(!this.cachedTrenches.some(t=>t.id===this.trenchId))this.trenchId=this.cachedTrenches[0]?.id??0;
    const representatives=networkRepresentatives(this.cachedTrenches,network),representative=representatives.find(t=>network.anchor(t.id)===network.anchor(this.trenchId));
    const choice=this.element.querySelector<HTMLSelectElement>('#trench-choice')!,options=representatives.map(t=>'<option value="'+t.id+'">'+connectedName(state,network,t.id)+'</option>').join('');if(choice.dataset.key!==options){choice.innerHTML=options;choice.dataset.key=options;}choice.value=String(representative?.id??this.trenchId);
    const t=this.cachedTrenches.find(t=>t.id===this.trenchId),component=t?network.component(t.id):undefined,groups=component===undefined?[]:state.living!.garrisons.filter(g=>g.faction!=='enemy'&&network.component(g.trenchId)===component),groupIds=new Set(groups.map(g=>g.id));
    const connected=this.cachedTrenches.filter(o=>component!==undefined&&network.component(o.id)===component),facilities=this.cachedFacilities.filter(f=>groupIds.has(f.garrisonId)),supply=networkSupply(state,groups),people=t?trenchPeople(state,network,t):[];
    const f=facilities.find(f=>f.id===this.facilityId),person=state.soldiers.find(s=>s.id===this.personId),personName=(id:number)=>{const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);return q?q.name+' '+String(q.soldierIds.indexOf(id)+1).padStart(2,'0'):'Person '+id;};
    this.element.querySelector('h2')!.textContent=f?facilityName(state,f):t?connectedName(state,network,t.id):'Positions';
    for(const b of this.element.querySelectorAll<HTMLButtonElement>('[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===this.page));
    let html='';
    const btn=(attrs:string,label:string)=>'<button '+attrs+'>'+label+'</button>';
    const line=(name:string,value:string|number)=>'<dt>'+name+'</dt><dd>'+value+'</dd>';
    const job=(p:Facility)=>{const r=workReadout(state,p);return '<article class="position-job">'+btn('data-position="'+p.id+'"',facilityName(state,p))+'<strong>'+r.status+'</strong><p>'+esc(r.reason)+'</p><dl>'+line('Location',Math.round(p.x)+', '+Math.round(p.z))+line('Materials delivered',Math.floor(r.delivered)+' / '+p.materialCost)+line('Reserved in stores',Math.floor(r.reserved))+line('Inbound',Math.floor(r.inbound))+line('Still needed',Math.ceil(r.remaining))+line('Workers',r.workers)+line('Structure',Math.floor(p.progress*100)+'%')+'</dl></article>';};
    if(this.page==='overview'){
      const space=networkCapacity(state,network,this.trenchId);
      html='<div class="position-manpower"><strong>'+space.present+' <small>HERE</small></strong><span>'+space.inbound+' INBOUND</span><span>'+space.free+' FREE</span></div><p>'+space.assigned+' assigned · '+space.reserved+' reserved / '+space.capacity+' usable places</p><dl>'+line('Excavated',Math.round(network.edges.filter(e=>network.nodes[e.a].component===component&&!e.portal).reduce((n,e)=>n+e.length,0))+' m · '+connected.length+' connected sections')+line('Equipment',facilities.filter(f=>f.installation).length+' installed · '+facilities.filter(f=>f.progress<1).length+' work orders')+line('Combat',groups.some(g=>(g.underFireUntil??0)>state.elapsed)?'UNDER FIRE':'Quiet')+'</dl><div class="position-actions">'+btn('data-focus','Locate')+btn('data-defend '+(!this.selected.size?'disabled':''),'Assign selected squads')+(t&&t.progress<1?btn('data-resume','Add selected workers'):'')+'</div><h3>Build here</h3><div class="position-actions">'+btn('data-place="emplacement"','MG position')+btn('data-place="mortar"','Field gun')+'</div>';
    }
    if(this.page==='overview'){
      const g=groups[0];
      const pools=manpowerPools(state,people);
      html+='<h3>Manpower</h3><dl>'+([['stationCrew','STATION CREW'],['workers','WORKERS'],['available','AVAILABLE'],['recovering','RESTING / RECOVERING'],['assault','ASSAULT']] as const).map(([key,label])=>line(label,pools[key].length)).join('')+'</dl><p>Each person counted once. A resting gunner keeps their station assignment but is not ready.</p>';
      html+='<dl>'+line('Assigned here',people.filter(s=>groupIds.has(s.garrisonId!)).length)+line('Combat-ready here',people.filter(s=>groupIds.has(s.garrisonId!)&&readyDefender(state,s)).length)+line('Operational weapons',facilities.filter(f=>['mortar','emplacement'].includes(f.kind)&&!positionReadiness(state,f)).length)+'</dl><div class="position-actions">'+btn('data-select-pool="workers" '+(!pools.workers.length?'disabled':''),'Select workers · '+pools.workers.length)+btn('data-select-pool="available" '+(!pools.available.length?'disabled':''),'Select available · '+pools.available.length)+'</div>';
      if(g){
        const mixedReadiness=groups.some(area=>area.readiness!==g.readiness),mixedFront=groups.some(area=>area.front!==g.front);
        html+='<h3>Defense orders</h3><p>'+groups.reduce((n,g)=>n+g.watchPresent,0)+' / '+groups.reduce((n,g)=>n+g.watchRequired,0)+' watching · '+people.filter(s=>s.action==='sleeping').length+' resting</p><label>Readiness<select id="garrison-readiness" data-network="'+g.id+'">'+(mixedReadiness?'<option disabled selected>Mixed · choose network readiness</option>':'')+(['routine','alert','stand-to'] as const).map(v=>'<option '+(!mixedReadiness&&g.readiness===v?'selected':'')+' value="'+v+'">'+({routine:'Routine · 25% watch',alert:'Alert · 50% watch','stand-to':'Stand-to · 90% watch'}[v])+'</option>').join('')+'</select></label><label>Front<select id="garrison-front" data-network="'+g.id+'">'+(mixedFront?'<option disabled selected>Mixed · choose network facing</option>':'')+[[0,'South'],[Math.PI/2,'East'],[Math.PI,'North'],[-Math.PI/2,'West']].map(([v,n])=>'<option '+(!mixedFront&&g.front===v?'selected':'')+' value="'+v+'">'+n+'</option>').join('')+'</select></label><p>Squads rotate watch, rest and supplies. Move or Withdraw leaves this network.</p>'+(['hold','recover'].includes(g.cutoff)?'<p>'+ (g.cutoff==='hold'?'Holding and rationing.':'Recovery parties authorized.')+'</p>'+btn('data-review-supply="'+g.id+'"','Review supply response'):'');
      }
    }
    if(this.page==='personnel'){
      const pools=manpowerPools(state,people);
      html='<div class="position-actions"><button data-select-pool="workers" '+(!pools.workers.length?'disabled':'')+'>Select workers · '+pools.workers.length+'</button><button data-select-pool="available" '+(!pools.available.length?'disabled':'')+'>Select available · '+pools.available.length+'</button></div>';
      if(this.workParty){
        const ids=this.workParty.ids,chosen=state.soldiers.filter(s=>ids.includes(s.id)),formations=[...new Set(chosen.map(s=>state.squads.find(q=>q.id===s.squadId)?.name??'Unknown'))];
        html+='<section class="work-party-selection" aria-label="Selected work party"><small>PERSONNEL GROUP</small><h3>'+esc(this.workParty.name)+' · '+chosen.length+'</h3><p>'+formations.map(esc).join(' / ')+'<br>Selected people only. Original squad membership is unchanged.</p><div class="position-actions">'+btn('data-party-assault '+(!chosen.length?'disabled':''),'Prepare assault')+btn('data-party-clear','Clear group')+'</div><details><summary>Selected people</summary>'+chosen.map(s=>'<p>'+esc(personName(s.id))+' · '+esc(s.survivalReason??s.duty?.reason??s.action)+'</p>').join('')+'</details></section>';
      }
      if(person){const equipment=equipmentOf(state,person);html='<section class="trench-person-detail"><small>PERSON SELECTED</small><h3>'+esc(personName(person.id))+'</h3><p>'+esc(person.action)+' · '+esc(person.needs?.life??'active')+' · '+esc(equipment.weapon)+'</p><p>'+esc(deathDescription(person)||person.survivalReason||person.combat?.pauseReason||person.duty?.reason||'Formation order')+'</p><p>Energy '+Math.round(person.needs?.energy??0)+' · hunger '+Math.round(person.needs?.hunger??0)+' · thirst '+Math.round(person.needs?.thirst??0)+'</p><div class="person-orders">'+[['move','Move here'],['watch','Watch here'],['rest','Rest'],['meal','Eat / drink'],['auto','Automatic duties']].map(([id,label])=>btn('data-order="'+id+'" '+(person.needs?.life!=='active'?'disabled':''),label)).join('')+'</div><p>Click a completed weapon position to man it.</p></section>';}
      html+='<h3>Local personnel · '+people.length+'</h3><div class="trench-person-list">'+people.map(s=>btn('data-person="'+s.id+'" aria-pressed="'+(s.id===this.personId||Boolean(this.workParty?.ids.includes(s.id)))+'"','<strong>'+esc(personName(s.id))+'</strong><span>'+esc(equipmentOf(state,s).tools?'TOOLS':equipmentOf(state,s).mortar?'MORTAR':equipmentOf(state,s).weapon)+' · '+esc(s.needs?.life==='active'?s.action:s.needs?.life)+'</span>')).join('')+'</div>';
      const fallen=state.soldiers.filter(s=>s.needs?.life==='dead'&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')&&(groupIds.has(s.garrisonId!)||connected.some(t=>distanceToPolyline(s,t.points).distance<t.width/2+3)));
      if(fallen.length)html+='<details><summary>Fallen here · '+fallen.length+'</summary><div class="trench-person-list">'+fallen.map(s=>btn('data-person="'+s.id+'"','<strong>'+esc(personName(s.id))+'</strong><span>'+esc(deathDescription(s))+'</span>')).join('')+'</div></details>';
    }
    if(this.page==='weapons'){
      if(f&&['emplacement','mortar'].includes(f.kind)){
        const crew=crewAt(state,f),kind=f.kind as WeaponPositionKind,operator=crewOperator(state,f),ammo=f.stock.ammo,he=f.stock.mortarHE,smoke=f.stock.mortarSmoke;
        html='<strong class="position-status">'+esc(supportPositionStatus(state,f,positionReadiness(state,f)||'READY'))+'</strong><p>Crew '+crew.length+' / '+WEAPON_POSITIONS[kind].crew+' · Facing '+Math.round((f.facing??0)*180/Math.PI)+'°</p><div class="crew-slots">'+Array.from({length:WEAPON_POSITIONS[kind].crew},(_,i)=>crew[i]?'<div>'+esc(personName(crew[i].id))+' · '+(crew[i]===operator?'Gunner':'Assistant')+btn('data-remove="'+crew[i].id+'" aria-label="Return '+esc(personName(crew[i].id))+' to area duties"','Remove')+'</div>':'<div>Empty crew slot</div>').join('')+'</div><div class="position-actions">'+btn('data-assign="crew"','Assign person')+btn('data-auto-crew','Auto assign crew')+btn('data-remove-all','Remove crew')+btn('data-focus','Locate')+'</div>';
        if(f.artillery){const facing=f.facing??0,directions:[number,string][]=[[0,'South'],[Math.PI/2,'East'],[Math.PI,'North'],[-Math.PI/2,'West']];if(!directions.some(([angle])=>angle===facing))directions.unshift([facing,'Current · '+Math.round(facing*180/Math.PI)+'°']);html+='<label>Gun facing<select data-artillery-front>'+directions.map(([value,label])=>'<option value="'+value+'" '+(facing===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';}
        html+='<dl>'+line('Weapon',f.installation?'Installed · stays when crew leave':'Awaiting existing mobile weapon')+(kind==='mortar'?line('Ready at position',he+' HE / '+smoke+' smoke')+line('Local stores',Math.floor(supply.local.mortarHE)+' HE / '+Math.floor(supply.local.mortarSmoke)+' smoke'):line('Ready at position',ammo+' rounds')+line('Local stores',Math.floor(supply.local.ammo)+' rounds'))+'</dl>';
        html+='<dl>'+line('Construction',f.progress===1?'COMPLETE':Math.floor(f.progress*100)+'%')+line('Activity',esc(activeSupportMission(state,f)?supportPositionStatus(state,f,''):operator?.action??'Awaiting crew'))+line('Target',activeSupportMission(state,f)?'Ordered ground area':operator?.duty?.kind==='watch'&&operator.action!=='sleeping'&&operator.aimTargetId!==undefined?'Tracking observed enemy':'No current target')+'</dl>'+btn('data-replace-crew aria-pressed="'+Boolean(f.autoReplaceCrew)+'"','Local crew replacement: '+(f.autoReplaceCrew?'automatic':'manual'));
        for(const demand of state.living!.supplyDemands?.filter(d=>d.consumer==='weapon'&&d.consumerId===f.id)??[])html+='<p>'+SUPPLY_LABELS[demand.resource]+' refill target '+demand.target+' · '+Math.floor(claimed(demand))+' reserved / inbound · '+Math.ceil(unfulfilled(demand))+' still needed</p>';
        if(kind==='mortar'){
          const mission=state.operation?.supportMissions?.filter(m=>m.positionId===f.id).at(-1);
          if(mission)html+='<p class="weapon-blocker">'+esc(mission.stage==='preparing'?'Preparing · '+Math.ceil(Math.max(0,mission.launchAt-state.elapsed))+' s to launch':mission.stage==='flight'?'Round away · '+Math.ceil(Math.max(0,mission.impactAt-state.elapsed))+' s to impact':mission.stage==='cancelled'?'Cancelled · '+mission.reason:'Last mission complete · '+(mission.ammoConsumed??0)+' round consumed')+'</p>';
          const choices=(['mortarHE','mortarSmoke'] as const).map(kind=>({kind,reason:operator?supportReadiness(state,kind,operator.squadId,this.sim.terrain,true,f.id).reason:'No gunner assigned'}));
          html+='<div class="position-actions">'+choices.map(c=>btn('data-fire="'+c.kind+'" title="'+esc(c.reason||'Choose target area for this position')+'" '+(c.reason?'disabled':''),c.kind==='mortarHE'?'Fire HE':'Fire smoke')).join('')+'</div>'+[...new Set(choices.map(c=>c.reason).filter(Boolean))].map(reason=>'<p class="weapon-blocker">'+esc(reason)+'</p>').join('');
          if(f.artillery)html+='<p>Field gun · 100–1600 m · forward 120° sector</p>'+(f.artillery.size>1?btn('data-fire="mortarHE" data-battery','Battery salvo · ready guns'):'');
        }else html+='<p class="weapon-blocker">'+esc(positionReadiness(state,f)||operator?.combat?.pauseReason||'Watching for a target in the firing sector')+'</p><p>Automatically engages observed enemies in its firing sector. It cannot fire through cover.</p>';
      }else html='<h3>Weapon positions</h3>'+facilities.filter(p=>['emplacement','mortar'].includes(p.kind)).map(p=>btn('class="position-row" data-position="'+p.id+'"',facilityName(state,p)+'<small>'+esc(positionReadiness(state,p)||'READY')+'</small>')).join('');
      html+='<div class="position-actions">'+btn('data-place="emplacement"','Build MG position')+btn('data-place="mortar"','Build field gun')+'</div>';
    }
    if(this.page==='construction'){
      if(f&&f.progress<1){html=job(f)+'<div class="position-actions">'+(f.workOrder?.cancelledAt===undefined?btn('data-auto-workers','Auto workers')+btn('data-assign="worker"','Choose worker')+btn('data-cancel-work','Cancel work order'):'')+btn('data-focus','Locate worksite')+'</div>'+(f.workOrder?.workerIds??[]).map(id=>'<p>'+esc(personName(id))+btn('data-remove-worker="'+id+'"','Return to duties')+'</p>').join('');}
      else html=facilities.filter(p=>p.progress<1).map(job).join('');
      const trenches=this.cachedTrenches.filter(t=>t.progress<1&&(t.id===this.trenchId||component!==undefined&&network.component(t.id)===component)&&!this.cachedFacilities.some(f=>!f.trenchAnchor&&f.connectorId===t.id));
      html+='<h3>Excavation work orders</h3>'+trenches.map(t=>{const r=trenchWorkReadout(state,t);return '<article class="position-job">'+btn('data-trench-job="'+t.id+'"',r.name)+'<strong>'+r.status+'</strong><p>'+esc(r.reason)+'</p><dl>'+line('Location',Math.round(r.location.x)+', '+Math.round(r.location.z))+line('Progress',Math.floor(r.progress*100)+'%')+line('Workers',r.workers+' assigned / '+r.working+' working')+line('Materials',r.materials)+'</dl>'+(t.id===this.trenchId?btn('data-resume','Assign digging crew'):'')+'</article>';}).join('');
      if(!trenches.length&&!facilities.some(p=>p.progress<1))html+='<p>No unfinished work orders.</p>';
      html+='<h3>New work order</h3><div class="position-actions">'+[['emplacement','MG position'],['mortar','Field gun'],['aid','Aid post'],['ammo','Ammo store'],['store','Supply store'],['rest','Rest dugout'],['meal','Meal bay']].map(([id,label])=>btn('data-place="'+id+'"',label)).join('')+'</div>';
    }
    if(this.page==='supplies'){
      html='<p class="supply-chain">Depot → truck → foot delivery → this position</p><p>Here means local stores. Inbound is not yet usable. Requested includes crew needs and the reserve stock for this network.</p><table class="supply-table"><thead><tr><th>Supply</th><th>Here</th><th>Requested</th><th>Inbound</th></tr></thead><tbody>'+supply.rows.filter(r=>r.key!=='fuel').map(r=>'<tr><th>'+r.label+'</th><td>'+Math.floor(r.local)+'</td><td>'+Math.ceil(r.requested)+'</td><td>'+Math.floor(r.inbound)+'</td></tr><tr class="supply-note"><td colspan="4">'+esc(r.reason)+(r.missing>0?' · '+Math.ceil(r.missing)+' not yet dispatched':'')+'</td></tr>').join('')+'</tbody></table><p>'+supply.allocated+' materials delivered or assigned to works · '+supply.required+' still to deliver</p><details><summary>Personal packs</summary>'+supply.rows.filter(r=>r.carried>0).map(r=>'<p>'+r.label+' '+Math.floor(r.carried)+'</p>').join('')+'</details>';
      const trucks=this.truckId?state.living!.trucks.filter(t=>t.id===this.truckId):state.living!.trucks.filter(t=>t.faction!=='enemy'&&(supply.trucks.includes(t)||t.role==='convoy'&&t.state!=='idle'));html+=trucks.map(t=>{const r=shipmentReadout(state,t);return '<article><h3>Supply truck '+t.id+'</h3><dl>'+line('Source',esc(r.source))+line('Destination',esc(r.destination))+line('Cargo',r.cargo.map(esc).join('<br>')||'Empty')+line('Status',r.status)+line('Travel ETA',esc(r.eta))+'</dl>'+r.jobs.map(j=>'<p>Materials '+j.amount+' reserved for '+esc(j.name)+'</p>').join('')+(r.note?'<p>'+esc(r.note)+'</p>':'')+btn('data-locate="'+t.id+'"','Locate truck')+'</article>';}).join('');
    }
    if(this.assign&&f){
      const side=state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction??'player',eligible=state.soldiers.filter(s=>s.needs?.life==='active'&&(state.squads.find(q=>q.id===s.squadId)?.faction??'player')===side&&(distance(s,f)<180||groupIds.has(s.garrisonId!))).sort((a,b)=>(f.installation?0:Number(carriesPositionWeapon(state,b,f.kind as WeaponPositionKind))-Number(carriesPositionWeapon(state,a,f.kind as WeaponPositionKind)))||distance(a,f)-distance(b,f)||a.id-b.id);
      html+='<h3>Choose '+(this.assign==='crew'?'crew':'worker')+'</h3><div class="trench-person-list">'+eligible.map(s=>btn('data-choose="'+s.id+'"',esc(personName(s.id))+'<span>'+esc(equipmentOf(state,s).mortar?'MORTAR':equipmentOf(state,s).tools?'TOOLS':equipmentOf(state,s).weapon)+'</span>')).join('')+'</div>';
    }
    const key=this.page+':'+html;if(key!==this.key){this.key=key;updateLiveContent(this.element.querySelector('.position-content')!,html);}
    if(this.locked())for(const b of this.element.querySelectorAll<HTMLButtonElement>('.position-content button:not([data-focus]):not([data-person]):not([data-position]):not([data-locate])'))b.disabled=true;
  }
  private project():void{
    const hidden=this.locked()||Boolean(document.documentElement.dataset.fieldMap);
    if(this.pointer&&!this.hint.hidden){this.hint.style.left=Math.min(this.pointer.x+16,window.innerWidth-240)+'px';this.hint.style.top=Math.min(this.pointer.y+16,window.innerHeight-100)+'px';}
    const house=this.inspectedBuilding===undefined?undefined:this.sim.terrain.buildings[this.inspectedBuilding];
    this.overlay.style.display=hidden?'none':'';this.labels.style.display=hidden||this.element.hidden||house||this.enemy?'none':'';if(hidden)return;
    const paths:Vec2[][]=this.element.hidden?[]:house?[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z])=>({x:house.x+x*(house.width/2+.5),z:house.z+z*(house.depth/2+.5)}))]:this.lines.map(t=>excavatedPoints(t));
    const f=this.hoverFacility??(!this.element.hidden?this.cachedFacilities.find(f=>f.id===this.facilityId):undefined);
    if(f){const r=f.trenchAnchor?1.7:3.2;paths.push(Array.from({length:17},(_,i)=>({x:f.x+Math.sin(i*Math.PI/8)*r,z:f.z+Math.cos(i*Math.PI/8)*r})));}
    if(!this.element.hidden&&this.projectedPerson){const s=this.projectedPerson;paths.push(Array.from({length:17},(_,i)=>({x:s.x+Math.sin(i*Math.PI/8)*.9,z:s.z+Math.cos(i*Math.PI/8)*.9})));}
    if(this.enemy&&!this.element.hidden){paths.length=0;paths.push(...this.enemy.sections.map(s=>s.points));}
    const screens=paths.flatMap(path=>clippedPaths(path.map(p=>this.camera.project(p,.3)),window.innerWidth,window.innerHeight));
    const pathCount=screens.length;
    if(!this.element.hidden&&!this.enemy){
      const entries=this.entries,projected=entries.map(e=>({...e,screen:this.camera.project(e.point,1)}));
      // Bounded label set only; no army queries or DOM measurements in the frame loop.
      const arranged=placeMapLabels(projected.filter(e=>e.screen.visible).map(e=>({text:e.name,x:e.screen.x,y:e.screen.y,width:e.name.length*7.3+14,height:25,priority:e.type==='facility'?(e.id===this.facilityId?5:3):e.id===this.trenchId?4:1,font:'',color:''})),window.innerWidth,window.innerHeight);
      const positions=new Map(arranged.map(p=>[p.text,p]));
      const key=entries.map(e=>e.type+e.id).join('|');if(this.labels.dataset.key!==key){this.labels.dataset.key=key;this.labels.replaceChildren();for(const e of entries){const b=document.createElement('button');b.dataset[e.type]=String(e.id);b.textContent=e.name;this.labels.append(b);}}
      projected.forEach((e,i)=>{const b=this.labels.children[i] as HTMLElement,p=positions.get(e.name);if(!b)return;b.hidden=!p;if(!p)return;
        b.style.transform='translate('+p.left+'px,'+p.top+'px)';b.classList.toggle('selected',e.type==='facility'?e.id===this.facilityId:e.id===this.trenchId);
        if(Math.abs(p.top+25-e.screen.y)>3)screens.push([e.screen,{...e.screen,x:p.left+p.width/2,y:p.top+12}]);
      });
    }
    while(this.overlay.children.length<screens.length){const line=document.createElementNS(this.overlay.namespaceURI,'polyline');this.overlay.append(line);}
    for(const [i,child] of [...this.overlay.children].entries()){child.setAttribute('class',i<pathCount?'inspection-built':'inspection-label');child.setAttribute('points',screens[i]?.map(p=>p.x+','+p.y).join(' ')??'');}
  }
}
