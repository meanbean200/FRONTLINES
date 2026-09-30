import {distance,polylineLength,pointAlongPolyline,type Vec2,type TrenchState,type SoldierState} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {StrategyCamera} from '../render/StrategyCamera';
import type {PersonalOrder,Facility,Readiness} from '../garrison/types';
import {friendlyTrenches,connectedName,networkRepresentatives,trenchPeople,distanceToPolyline} from './TrenchReadout';
import {fieldIcon} from './FieldSymbols';
import {facilityName} from '../construction/PositionDefinitions';
import {positionReadiness,crewAt,crewOperator,carriesPositionWeapon,type WeaponPositionKind} from '../combat/WeaponPositions';
import {equipmentOf} from '../combat/Equipment';
import {workReadout,networkSupply,trenchWorkReadout,shipmentReadout,personnelActivity} from './PositionReadout';
import {WEAPONS} from '../combat/Weapons';
import {SUPPLY_LABELS} from './PositionReadout';
import {claimed,unfulfilled} from '../garrison/SupplyDemand';
import {supportReadiness} from '../combat/SupportWeapons';
import {placeMapLabels} from './MapLabels';
import {buildingReadout} from './BuildingReadout';
import {knownTrenchNetworks,type KnownTrenchNetwork} from '../operations/TrenchIntelligence';
import {preparedStatus} from '../operations/PreparedOrders';
import {clippedPaths} from './ProjectedPaths';
import {networkCapacity} from '../garrison/NetworkCapacity';
import {updateCommandSurface} from './CommandSurface';
import {raidEligibility} from '../operations/RaidEligibility';
import {deathDescription} from '../simulation/DeathRecord';
import {manpowerPools} from '../garrison/Manpower';
import {readyDefender} from '../garrison/PersonnelRoles';
import {activeSupportMission,supportPositionStatus} from './WeaponReadout';
import {crateVisible,crateAccess,crateAnchors,factionSeesStock,stockPiles,stockPileAnchors} from '../garrison/SupplyAccess';
import {controlReadout,controlZone} from '../operations/ObjectiveControl';
import {RESOURCES} from '../garrison/types';

interface Actions {defend:(id:number)=>void;resume:(id:number)=>void;area:(id:number)=>void;move:(watch?:boolean)=>void;cancel:()=>void;notify:(text:string)=>void;place:(id:number,kind:Facility['kind'])=>void;fire:(id:number,kind:'mortarHE'|'mortarSmoke',battery?:boolean)=>void;person:()=>void}
type Page='overview'|'personnel'|'weapons'|'construction'|'supplies';
type StockSelection={kind:'crate'|'truck'|'town'|'rear'|'cache'|'forward';id:number|string};
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
  private stockSelection?:StockSelection;
  private recoveryDestination=0;
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
    const back=document.createElement('button');back.dataset.positionBack='true';back.setAttribute('aria-label','Back to position');back.textContent='←';back.hidden=true;this.element.querySelector('header')!.prepend(back);
    this.button.onclick=()=>this.element.hidden?this.open():this.close();this.element.addEventListener('click',e=>this.click(e));
    this.element.querySelector('#trench-choice')!.addEventListener('change',e=>{this.trenchId=Number((e.target as HTMLSelectElement).value);this.facilityId=this.personId=this.truckId=0;this.clearPerson();this.assign=undefined;this.update(true);this.focus();});
    this.element.addEventListener('change',e=>{
      const select=e.target as HTMLSelectElement;if(this.locked())return;
      if(select.hasAttribute('data-raid-release-crews')){this.includeWeaponCrews=(select as unknown as HTMLInputElement).checked;this.update(true);return;}
      if(select.hasAttribute('data-artillery-front')){this.actions.notify(this.sim.garrisons.setArtilleryFacing(this.facilityId,Number(select.value)).reason);this.update(true);return;}
      if(select.hasAttribute('data-building-floor')){this.buildingFloor=Number(select.value) as 0|1;this.update(true);return;}
      const id=Number(select.dataset.network),network=this.sim.garrisons.network,root=this.sim.state.living!.garrisons.find(g=>g.id===id),component=root&&network.component(root.trenchId);
      for(const g of this.sim.state.living!.garrisons.filter(g=>g.faction!=='enemy'&&component!==undefined&&network.component(g.trenchId)===component)){
        if(select.id==='garrison-readiness')this.sim.garrisons.setReadiness(g.id,select.value as Readiness);
        if(select.id==='garrison-front')this.sim.garrisons.setFront(g.id,Number(select.value));
      }
    });
    this.labels.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(b?.dataset.trench)this.open(Number(b.dataset.trench));if(b?.dataset.facility)this.chooseFacility(Number(b.dataset.facility));});
    window.addEventListener('pointermove',e=>{this.pointer=e.target instanceof HTMLCanvasElement?{x:e.clientX,y:e.clientY}:undefined;});
    window.addEventListener('frontlines-menu',()=>{this.stockSelection=undefined;this.close();});
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
  inspectSupplyScreen(x:number,y:number):boolean {
    const state=this.sim.state,w=state.living!,hits:(StockSelection&{distance:number})[]=[];
    const add=(kind:StockSelection['kind'],id:number|string,p:Vec2,height:number)=>{const at=this.camera.project(p,height),d=Math.hypot(x-at.x,y-at.y);if(at.visible&&d<20)hits.push({kind,id,distance:d});};
    for(const p of stockPiles(state,this.sim.terrain))for(const anchor of stockPileAnchors(p))add(p.kind,p.id,anchor,.35);
    for(const c of w.crates)if(RESOURCES.some(k=>c.stock[k]>0)&&crateVisible(state,this.sim.terrain,c))for(const p of crateAnchors(state,c))add('crate',c.id,p,.5);
    for(const t of w.trucks)if(t.faction!=='enemy'||factionSeesStock(state,this.sim.terrain,t,'player',true))add('truck',t.id,t,1.2);
    for(const o of state.operation?.objectives??[])add('town',o.id,controlZone(state,o)?.center??o,7);
    hits.sort((a,b)=>a.distance-b.distance);if(!hits[0])return false;
    this.open();this.stockSelection={kind:hits[0].kind,id:hits[0].id};this.update(true);return true;
  }
  inspectTown(id:string):boolean{
    if(!this.sim.state.operation?.objectives.some(o=>o.id===id))return false;
    this.open();this.stockSelection={kind:'town',id};this.update(true);return true;
  }
  private renderSupply():void {
    const state=this.sim.state,w=state.living!,selection=this.stockSelection!;
    const pile=stockPiles(state,this.sim.terrain).find(p=>p.kind===selection.kind&&p.id===selection.id);
    const truck=selection.kind==='truck'?w.trucks.find(t=>t.id===selection.id):undefined;
    const objective=selection.kind==='town'?state.operation?.objectives.find(o=>o.id===selection.id):undefined;
    const crate=w.crates.find(c=>c.id===(objective?.cacheId??truck?.salvageId??(selection.kind==='crate'?selection.id:undefined)));
    const visible=Boolean(pile)||(truck?(truck.faction!=='enemy'||factionSeesStock(state,this.sim.terrain,truck,'player',true)):crate?crateVisible(state,this.sim.terrain,crate):false);
    this.element.querySelector('header small')!.textContent=objective?'TOWN / CONTROL & SUPPLY':'PHYSICAL LOGISTICS';
    this.element.querySelector('h2')!.textContent=pile?.name??objective?.name??(truck?truck.role==='convoy'?'Supply convoy':'Delivery truck':'Loose supplies');
    for(const e of this.element.querySelectorAll<HTMLElement>('.position-picker,.position-tabs'))e.hidden=true;
    const destinations=w.garrisons.filter(g=>g.faction!=='enemy'&&g.cutoff!=='withdraw');
    const select=this.element.querySelector<HTMLSelectElement>('[data-recovery-destination]');if(select)this.recoveryDestination=Number(select.value);
    if(!destinations.some(g=>g.id===this.recoveryDestination))this.recoveryDestination=destinations[0]?.id??0;
    const destination=destinations.find(g=>g.id===this.recoveryDestination),control=objective?controlReadout(state,objective):undefined;
    let primary=control?`<strong class="position-status">${control.status}</strong><p>${esc(control.reason)}</p>`:'';
    let html='';
    if(objective||visible&&crate){
      primary+=`<label>Supply position<select data-recovery-destination>${destinations.map(g=>`<option value="${g.id}" ${g.id===this.recoveryDestination?'selected':''}>${esc(connectedName(state,this.sim.garrisons.network,g.trenchId))}</option>`).join('')}</select></label>`;
      if(objective){
        const preview=this.sim.garrisons.logistics.previewSupplyPoint(this.recoveryDestination,objective.id);
        const pending=destination?.pendingSupplyPoint?.townId===objective.id,active=destination?.supplyTownId===objective.id&&!destination?.pendingSupplyPoint;
        primary+=`<div class="position-actions"><button data-set-supply-point="${esc(objective.id)}" ${!preview.accepted||this.locked()||pending||active?'disabled':''}>${pending?'Change queued':active?'Active supply point':'Set as supply point'}</button><button data-stock-locate>Locate town</button></div><p class="command-issue">${esc(destination?.supplyPointIssue??preview.reason)}</p>`;
        html+='<details><summary>Delivery details</summary><p>Uses the existing regional fleet. Current shipments finish before a change; old stock remains physically recoverable. This does not add transport or refill the town.</p></details>';
      }
      if(visible&&crate){
        const blocked=crateAccess(state,this.sim.terrain,crate,'player');
        primary+=`<div class="position-actions"><button data-recover-crate="${crate.id}" ${blocked||!destinations.length||this.locked()?'disabled':''}>Recover supplies</button>${!objective?'<button data-stock-locate>Locate stock</button>':''}</div>`;
        if(blocked)primary+=`<p class="command-issue">${esc(blocked)}</p>`;
        const carriers=state.soldiers.filter(s=>s.duty?.crateId===crate.id);
        if(carriers.length)html+=`<p>${carriers.filter(s=>s.duty?.stage==='pickup').length} approaching · ${carriers.filter(s=>s.duty?.stage==='deliver').length} returning</p>`;
        html+='<details><summary>Recovery details</summary><p>One carrier load per order. Stock transfers on physical arrival.</p></details>';
      }
    }else if(visible)primary+='<div class="position-actions"><button data-stock-locate>Locate</button></div>';
    if(!visible)html+='<p class="command-issue">STOCK UNOBSERVED</p>';
    else{
      if(truck)primary+=`<p class="position-status">${esc(truck.faction==='enemy'&&!truck.abandoned?'OBSERVED ENEMY TRANSPORT':truck.reason)}</p>`;
      const stock=(pile?.side==='player'?pile.stock:undefined)??crate?.stock??(truck?.faction!=='enemy'?truck?.cargo:undefined);
      if(stock)html='<div class="command-stats">'+RESOURCES.filter(k=>stock[k]>0).map(k=>`<span>${esc(SUPPLY_LABELS[k])}<b>${Math.floor(stock[k]*10)/10}</b></span>`).join('')+'</div>'+html;
      if(truck?.faction!=='enemy'&&truck)html+=`<details><summary>Shipment</summary><p>${esc(shipmentReadout(state,truck).destination)}</p><p>Fuel ${Math.floor(truck.fuel)} · cargo remains aboard until arrival.</p></details>`;
      if(pile)html+=`<details><summary>Store details</summary><p>${pile.side==='enemy'?'Opposing store · contents unknown':pile.kind==='rear'?'Finite rear stock · delivered by the shared truck fleet':pile.kind==='forward'?'Roadhead · foot carriers collect these deliveries':'Position store · available to assigned personnel'}</p></details>`;
    }
    html='<div data-command-primary>'+primary+'</div>'+html;
    if(html!==this.key){this.key=html;updateCommandSurface(this.element,html);}
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
    if(b.hasAttribute('data-position-back')){this.facilityId=0;this.personId=0;this.assign=undefined;this.update(true);return;}
    if(b.hasAttribute('data-close')){this.close();return;}if(b.dataset.page){this.page=b.dataset.page as Page;this.assign=undefined;this.update(true);return;}
    if(b.dataset.recoverCrate){if(!this.locked()){const id=Number(this.element.querySelector<HTMLSelectElement>('[data-recovery-destination]')?.value);this.actions.notify(this.sim.garrisons.recoverSupplies(Number(b.dataset.recoverCrate),id).reason);this.update(true);}return;}
    if(b.dataset.setSupplyPoint){if(!this.locked()){const id=Number(this.element.querySelector<HTMLSelectElement>('[data-recovery-destination]')?.value);this.actions.notify(this.sim.garrisons.logistics.setSupplyPoint(id,b.dataset.setSupplyPoint).reason);this.update(true);}return;}
    if(b.hasAttribute('data-stock-locate')&&this.stockSelection){const s=this.stockSelection,state=this.sim.state,o=state.operation?.objectives.find(o=>s.kind==='town'&&o.id===s.id),p=stockPiles(state,this.sim.terrain).find(p=>p.kind===s.kind&&p.id===s.id)?.point??(o?(controlZone(state,o)?.center??o):s.kind==='truck'?state.living!.trucks.find(t=>t.id===s.id&&(t.faction!=='enemy'||factionSeesStock(state,this.sim.terrain,t,'player',true))):state.living!.crates.find(c=>c.id===s.id&&crateVisible(state,this.sim.terrain,c)));if(p)this.camera.focus(p,95);return;}
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
    this.element.querySelector<HTMLButtonElement>('[data-position-back]')!.hidden=!this.facilityId&&!this.personId;
    if(this.stockSelection){this.renderSupply();return;}
    if(this.enemy){const current=knownTrenchNetworks(state).find(n=>n.id===this.enemy!.id);if(current)this.enemy=current;else if(friendlyTrenches(state,network).some(t=>t.id===this.enemy!.id))this.enemy=undefined;}
    if(this.enemy){
      this.element.querySelector('header small')!.textContent='OBSERVED TERRAIN / NOT LIVE INTELLIGENCE';this.element.querySelector('h2')!.textContent=this.enemy.name;
      for(const e of this.element.querySelectorAll<HTMLElement>('.position-picker,.position-tabs'))e.hidden=true;
      const eligibility=raidEligibility(state,[...this.selected],this.includeWeaponCrews);
      const orders=(state.preparedOrders??[]).filter(o=>o.networkId===this.enemy!.id),html='<p>'+Math.round(this.enemy.length)+' m known · occupants unknown</p><div class="position-actions" data-command-primary>'+[['observe','Observe'],['suppress','Suppress'],['approach','Approach'],['assault','Assault'],['stage','Prepare assault'],['stage-support','Prepare support']].map(([id,label])=>'<button data-enemy-action="'+id+'" '+(!this.selected.size?'disabled':'')+'>'+label+'</button>').join('')+'<button data-enemy-locate>Locate</button><button data-secure-network '+(!this.selected.size?'disabled':'')+'>Secure & defend</button></div>'+orders.map(o=>'<p>'+esc(state.squads.find(q=>q.id===o.squadId)?.name)+' · '+esc(o.intent)+'<small>'+preparedStatus(state,o)+'</small></p>').join('')+(orders.length?'<div class="position-actions"><button data-signal>GO · signal all</button><button data-cancel-prepared>Cancel prepared orders</button></div>':'');
      const view=`<p>${eligibility.people} available · ${eligibility.eligible.length} formations</p><label><input type="checkbox" data-raid-release-crews ${this.includeWeaponCrews?'checked':''}> Preview ALL IN · review crew/work consequences before GO</label>`+html;
      if(this.key!==view){this.key=view;updateCommandSurface(this.element,view);}return;
    }
    const house=this.buildingId>=0?buildingReadout(state,this.sim.terrain,this.buildingId):undefined;
    this.element.querySelector('header small')!.textContent=house?'BUILDING / OCCUPATION':'POSITION / TRENCH NETWORK';
    for(const e of this.element.querySelectorAll<HTMLElement>('.position-picker,.position-tabs'))e.hidden=Boolean(house);
    if(house){
      this.element.querySelector('h2')!.textContent=house.name;
      const old=this.element.querySelector<HTMLSelectElement>('[data-building-squad]');if(old)this.buildingSquad=Number(old.value);
      const floor=house.floors.find(f=>f.floor===this.buildingFloor)??house.floors[0];this.buildingFloor=floor.floor as 0|1;
      const html='<div data-command-primary><strong class="position-status">'+house.condition.toUpperCase()+'</strong><p>'+floor.ready+' / '+floor.capacity+' ready places · '+floor.inside+' indoors</p><label>Formation<select data-building-squad><option value="0">'+(this.selected.size?'Selected formations ('+this.selected.size+')':'Choose formation')+'</option>'+house.squads.map(q=>'<option value="'+q.id+'" '+(q.id===this.buildingSquad?'selected':'')+'>'+esc(q.name)+'</option>').join('')+'</select></label><label>Floor<select data-building-floor>'+house.floors.map(f=>'<option value="'+f.floor+'" '+(f.floor===this.buildingFloor?'selected':'')+'>'+(f.floor?'Upper floor':'Ground floor')+' · '+f.inside+' inside</option>').join('')+'</select></label><div class="position-actions"><button data-floor="'+floor.floor+'" '+(floor.reserved>=floor.capacity?'disabled':'')+'>Occupy floor</button><button data-building-exit '+(!house.people.length?'disabled':'')+'>Exit building</button><button data-building-locate>Locate</button></div></div><p>'+floor.incoming+' approaching · '+floor.casualties+' wounded · '+Math.max(0,floor.capacity-floor.reserved)+' free firing places</p><details><summary>Assigned personnel · '+house.people.length+'</summary>'+house.people.map(s=>'<p>'+esc(state.squads.find(q=>q.id===s.squadId)?.name)+' '+String(state.squads.find(q=>q.id===s.squadId)!.soldierIds.indexOf(s.id)+1).padStart(2,'0')+' · '+esc(s.needs?.life==='active'?s.action:s.needs?.life)+'<small>'+esc(s.survivalReason??s.combat?.pauseReason??'')+'</small></p>').join('')+'</details>';
      const key='building:'+html;if(key!==this.key){this.key=key;updateCommandSurface(this.element,html);}
      if(this.locked())for(const b of this.element.querySelectorAll<HTMLButtonElement>('.position-content button:not([data-building-locate]),.command-primary button:not([data-building-locate])'))b.disabled=true;
      return;
    }
    if(!this.cachedTrenches.some(t=>t.id===this.trenchId))this.trenchId=this.cachedTrenches[0]?.id??0;
    const representatives=networkRepresentatives(this.cachedTrenches,network),representative=representatives.find(t=>network.anchor(t.id)===network.anchor(this.trenchId));
    const choice=this.element.querySelector<HTMLSelectElement>('#trench-choice')!,options=representatives.map(t=>'<option value="'+t.id+'">'+connectedName(state,network,t.id)+'</option>').join('');if(choice.dataset.key!==options){choice.innerHTML=options;choice.dataset.key=options;}choice.value=String(representative?.id??this.trenchId);
    const t=this.cachedTrenches.find(t=>t.id===this.trenchId),component=t?network.component(t.id):undefined,groups=component===undefined?[]:state.living!.garrisons.filter(g=>g.faction!=='enemy'&&network.component(g.trenchId)===component),groupIds=new Set(groups.map(g=>g.id));
    const connected=this.cachedTrenches.filter(o=>component!==undefined&&network.component(o.id)===component),facilities=this.cachedFacilities.filter(f=>groupIds.has(f.garrisonId)),supply=networkSupply(state,groups),people=t?trenchPeople(state,network,t):[];
    const f=facilities.find(f=>f.id===this.facilityId),person=state.soldiers.find(s=>s.id===this.personId),personName=(id:number)=>{const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);return q?q.name+' '+String(q.soldierIds.indexOf(id)+1).padStart(2,'0'):'Person '+id;};
    this.element.querySelector('h2')!.textContent=person&&this.page==='personnel'?personName(person.id):f?facilityName(state,f):t?connectedName(state,network,t.id):'Positions';
    for(const b of this.element.querySelectorAll<HTMLButtonElement>('[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===this.page));
    let html='';
    const btn=(attrs:string,label:string)=>'<button '+attrs+'>'+label+'</button>';
    const line=(name:string,value:string|number)=>'<dt>'+name+'</dt><dd>'+value+'</dd>';
    const job=(p:Facility)=>{const r=workReadout(state,p);return '<article class="position-job">'+btn('data-position="'+p.id+'"',facilityName(state,p))+'<strong>'+r.status+'</strong><div class="command-stats"><span>'+Math.floor(p.progress*100)+'% built</span><span>'+r.working+' / '+r.workers+' working</span><span>Materials '+Math.floor(r.delivered)+' / '+p.materialCost+'</span><span>'+Math.floor(r.inbound)+' inbound</span></div>'+(r.remaining?'<p class="command-issue">'+Math.ceil(r.remaining)+' materials not yet dispatched</p>':'')+'<details><summary>Work details</summary><p>'+esc(r.reason)+'</p><dl>'+line('Reserved locally',Math.floor(r.reserved))+line('Coordinates',Math.round(p.x)+', '+Math.round(p.z))+'</dl></details></article>';};
    if(this.page==='overview'){
      const space=networkCapacity(state,network,this.trenchId);
      html='<div data-command-primary><strong class="position-status">'+(groups.some(g=>(g.underFireUntil??0)>state.elapsed)?'UNDER FIRE':'DEFENSIVE POSITION')+'</strong><p>'+space.assigned+' assigned · '+people.filter(s=>readyDefender(state,s)).length+' ready · '+space.free+' free places</p><div class="position-actions">'+btn('data-defend '+(!this.selected.size?'disabled':''),'Assign selected')+btn('data-focus','Locate')+(t&&t.progress<1?btn('data-resume','Add workers'):'')+btn('data-place="emplacement"','Build MG')+btn('data-place="mortar"','Build field gun')+'</div></div><div class="command-stats"><span>'+space.present+' here · '+space.inbound+' approaching</span><span>'+facilities.filter(f=>f.progress<1).length+' works</span><span>'+Math.round(network.edges.filter(e=>network.nodes[e.a].component===component&&!e.portal).reduce((n,e)=>n+e.length,0))+' m trench</span><span>'+facilities.filter(f=>["mortar","emplacement"].includes(f.kind)&&!positionReadiness(state,f)).length+' weapons ready</span></div>';
    }
    if(this.page==='overview'){
      const g=groups[0];
      const pools=manpowerPools(state,people);
      if(g){
        const mixedReadiness=groups.some(area=>area.readiness!==g.readiness),mixedFront=groups.some(area=>area.front!==g.front);
        html+='<div class="command-fields"><label>Readiness<select id="garrison-readiness" data-network="'+g.id+'">'+(mixedReadiness?'<option disabled selected>Mixed</option>':'')+(['routine','alert','stand-to'] as const).map(v=>'<option '+(!mixedReadiness&&g.readiness===v?'selected':'')+' value="'+v+'">'+({routine:'Routine · 25%',alert:'Alert · 50%','stand-to':'Stand-to · 90%'}[v])+'</option>').join('')+'</select></label><label>Front<select id="garrison-front" data-network="'+g.id+'">'+(mixedFront?'<option disabled selected>Mixed</option>':'')+[[0,'South'],[Math.PI/2,'East'],[Math.PI,'North'],[-Math.PI/2,'West']].map(([v,n])=>'<option '+(!mixedFront&&g.front===v?'selected':'')+' value="'+v+'">'+n+'</option>').join('')+'</select></label></div><p>'+groups.reduce((n,g)=>n+g.watchPresent,0)+' / '+groups.reduce((n,g)=>n+g.watchRequired,0)+' watching · '+pools.recovering.length+' recovering</p>'+(['hold','recover'].includes(g.cutoff)?'<p class="command-issue">'+ (g.cutoff==='hold'?'Holding and rationing.':'Recovery parties authorized.')+'</p>'+btn('data-review-supply="'+g.id+'"','Review supply response'):'');
      }
      html+='<details><summary>Manpower / duty details</summary><div class="command-stats">'+([['stationCrew','Crew'],['workers','Workers'],['available','Available'],['recovering','Recovering'],['assault','Assault']] as const).map(([key,label])=>'<span>'+label+' <b>'+pools[key].length+'</b></span>').join('')+'</div><p>Squads rotate watch, rest and supplies. Move or Withdraw leaves this position. Each person appears in one manpower pool; assignments remain attached during recovery.</p></details>';
    }
    if(this.page==='personnel'){
      const pools=manpowerPools(state,people);
      html='<div class="position-actions" data-command-primary><button data-select-pool="workers" '+(!pools.workers.length?'disabled':'')+'>Select workers · '+pools.workers.length+'</button><button data-select-pool="available" '+(!pools.available.length?'disabled':'')+'>Select available · '+pools.available.length+'</button></div>';
      if(this.workParty){
        const ids=this.workParty.ids,chosen=state.soldiers.filter(s=>ids.includes(s.id)),formations=[...new Set(chosen.map(s=>state.squads.find(q=>q.id===s.squadId)?.name??'Unknown'))];
        html+='<section class="work-party-selection" aria-label="Selected work party"><div data-command-primary><strong>'+esc(this.workParty.name)+' · '+chosen.length+'</strong><div class="position-actions">'+btn('data-party-assault '+(!chosen.length?'disabled':''),'Prepare assault')+btn('data-party-clear','Clear group')+'</div></div><details><summary>Selected people</summary><p>'+formations.map(esc).join(' / ')+'</p>'+chosen.map(s=>'<p>'+esc(personName(s.id))+' · '+esc(s.survivalReason??s.duty?.reason??s.action)+'</p>').join('')+'</details></section>';
      }
      if(person){const equipment=equipmentOf(state,person);html='<section class="trench-person-detail"><small>PERSON SELECTED</small><h3>'+esc(personName(person.id))+'</h3><p>'+esc(personnelActivity(person))+' · '+esc(WEAPONS[equipment.weapon].name)+'</p><p>'+esc(deathDescription(person)||person.survivalReason||person.combat?.pauseReason||person.duty?.reason||'Formation order')+'</p><p>Energy '+Math.round(person.needs?.energy??0)+' · hunger '+Math.round(person.needs?.hunger??0)+' · thirst '+Math.round(person.needs?.thirst??0)+'</p><div class="person-orders" data-command-primary>'+[['move','Move here'],['watch','Watch here'],['rest','Rest'],['meal','Eat / drink'],['auto','Automatic duties']].map(([id,label])=>btn('data-order="'+id+'" '+(person.needs?.life!=='active'?'disabled':''),label)).join('')+'</div><details><summary>Assignment</summary><p>Click a completed weapon position to man it.</p></details></section>';}
      html+='<h3>Local personnel · '+people.length+'</h3><div class="trench-person-list">'+people.map(s=>btn('data-person="'+s.id+'" aria-pressed="'+(s.id===this.personId||Boolean(this.workParty?.ids.includes(s.id)))+'"','<strong>'+esc(personName(s.id))+'</strong><span>'+esc(equipmentOf(state,s).tools?'Tools':equipmentOf(state,s).mortar?'Mortar kit':WEAPONS[equipmentOf(state,s).weapon].name)+' · '+esc(personnelActivity(s))+'</span>')).join('')+'</div>';
      const fallen=state.soldiers.filter(s=>s.needs?.life==='dead'&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')&&(groupIds.has(s.garrisonId!)||connected.some(t=>distanceToPolyline(s,t.points).distance<t.width/2+3)));
      if(fallen.length)html+='<details><summary>Fallen here · '+fallen.length+'</summary><div class="trench-person-list">'+fallen.map(s=>btn('data-person="'+s.id+'"','<strong>'+esc(personName(s.id))+'</strong><span>'+esc(deathDescription(s))+'</span>')).join('')+'</div></details>';
    }
    if(this.page==='weapons'){
      if(f&&['emplacement','mortar'].includes(f.kind)){
        const crew=crewAt(state,f),kind=f.kind as WeaponPositionKind,operator=crewOperator(state,f),status=supportPositionStatus(state,f,positionReadiness(state,f)||'READY');
        const rounds=kind==='mortar'?f.stock.mortarHE+' HE · '+f.stock.mortarSmoke+' smoke':f.stock.ammo+' rounds';
        let issue='',commands=btn('data-auto-crew '+(crew.length>=2?'disabled':''),'Staff crew')+btn('data-focus','Locate');
        if(kind==='mortar'){
          const choices=(['mortarHE','mortarSmoke'] as const).map(kind=>({kind,reason:operator?supportReadiness(state,kind,operator.squadId,this.sim.terrain,true,f.id).reason:'No gunner assigned'}));
          if(choices.every(c=>c.reason))issue=choices[0].reason;
          commands=choices.map(c=>btn('data-fire="'+c.kind+'" title="'+esc(c.reason||'Choose target area')+'" '+(c.reason?'disabled':''),c.kind==='mortarHE'?'Fire HE':'Fire smoke')).join('')+commands;
          if(f.artillery&&f.artillery.size>1)commands+=btn('data-fire="mortarHE" data-battery','Battery salvo');
        }
        html='<div data-command-primary><strong class="position-status">'+esc(status==='READY'&&issue?'UNAVAILABLE':status)+'</strong><p>'+rounds+' · '+crew.length+' / 2 crew</p><div class="position-actions">'+commands+'</div>'+(issue?'<p class="weapon-blocker">'+esc(issue)+'</p>':'')+'</div>';
        if(f.artillery){
          const facing=f.facing??0,directions:[number,string][]=[[0,'South'],[Math.PI/2,'East'],[Math.PI,'North'],[-Math.PI/2,'West']];
          if(!directions.some(([a])=>a===facing))directions.unshift([facing,'Current · '+Math.round(facing*180/Math.PI)+'°']);
          html+='<label>Facing<select data-artillery-front>'+directions.map(([v,n])=>'<option value="'+v+'" '+(facing===v?'selected':'')+'>'+n+'</option>').join('')+'</select></label>';
        }
        html+='<details><summary>Crew · '+crew.length+' / 2</summary><div class="crew-slots">'+crew.map(s=>'<div>'+esc(personName(s.id))+' · '+(s===operator?'Gunner':'Assistant')+btn('data-remove="'+s.id+'"','Remove')+'</div>').join('')+'</div><div class="position-actions">'+btn('data-assign="crew"','Choose person')+btn('data-remove-all','Release crew')+'</div>'+btn('data-replace-crew aria-pressed="'+Boolean(f.autoReplaceCrew)+'"','Replacement: '+(f.autoReplaceCrew?'automatic':'manual'))+'</details>';
        html+='<details><summary>Ammunition / weapon details</summary><dl>'+line('Installation',f.installation?'Installed':'Existing kit needed')+line('Local ammo',kind==='mortar'?Math.floor(supply.local.mortarHE)+' HE / '+Math.floor(supply.local.mortarSmoke)+' smoke':Math.floor(supply.local.ammo)+' rounds')+line('Activity',esc(activeSupportMission(state,f)?supportPositionStatus(state,f,''):operator?.action??'No crew'))+'</dl>';
        for(const d of state.living!.supplyDemands?.filter(d=>d.consumer==='weapon'&&d.consumerId===f.id)??[])html+='<p>'+SUPPLY_LABELS[d.resource]+' · '+Math.floor(claimed(d))+' reserved / inbound · '+Math.ceil(unfulfilled(d))+' needed</p>';
        html+='<p>'+(f.artillery?'Field gun · 100–1600 m · forward 120° sector':kind==='emplacement'?'Automatically engages observed enemies inside its traverse. Cover blocks fire.':'Legacy mortar · ordered area fire')+'</p></details>';
      }else{
        html='<div class="position-actions" data-command-primary>'+btn('data-place="emplacement"','Build MG')+btn('data-place="mortar"','Build field gun')+'</div>'+facilities.filter(p=>['emplacement','mortar'].includes(p.kind)).map(p=>btn('class="position-row" data-position="'+p.id+'"',facilityName(state,p)+'<small>'+esc(positionReadiness(state,p)||'READY')+'</small>')).join('');
        if(!facilities.some(p=>['emplacement','mortar'].includes(p.kind)))html+='<p>No weapon positions yet.</p>';
      }
    }
    if(this.page==='construction'){
      if(f&&f.progress<1){html=job(f)+'<div class="position-actions" data-command-primary>'+(f.workOrder?.cancelledAt===undefined?btn('data-auto-workers','Auto workers')+btn('data-assign="worker"','Choose worker')+btn('data-cancel-work','Cancel work order'):'')+btn('data-focus','Locate worksite')+'</div>'+(f.workOrder?.workerIds??[]).map(id=>'<p>'+esc(personName(id))+btn('data-remove-worker="'+id+'"','Return to duties')+'</p>').join('');}
      else html='<div class="position-actions" data-command-primary>'+btn('data-place="emplacement"','Build MG')+btn('data-place="mortar"','Build field gun')+'</div>'+facilities.filter(p=>p.progress<1).map(job).join('');
      const trenches=this.cachedTrenches.filter(t=>t.progress<1&&(t.id===this.trenchId||component!==undefined&&network.component(t.id)===component)&&!this.cachedFacilities.some(f=>!f.trenchAnchor&&f.connectorId===t.id));
      html+='<h3>Excavation work orders</h3>'+trenches.map(t=>{const r=trenchWorkReadout(state,t);return '<article class="position-job">'+btn('data-trench-job="'+t.id+'"',r.name)+'<strong>'+r.status+'</strong><p>'+esc(r.reason)+'</p><dl>'+line('Location',Math.round(r.location.x)+', '+Math.round(r.location.z))+line('Progress',Math.floor(r.progress*100)+'%')+line('Workers',r.workers+' assigned / '+r.working+' working')+line('Materials',r.materials)+'</dl>'+(t.id===this.trenchId?btn('data-resume','Assign digging crew'):'')+'</article>';}).join('');
      if(!trenches.length&&!facilities.some(p=>p.progress<1))html+='<p>No unfinished work orders.</p>';
      html+='<details><summary>More construction</summary><div class="position-actions">'+[['emplacement','MG position'],['mortar','Field gun'],['aid','Aid post'],['ammo','Ammo store'],['store','Supply store'],['rest','Rest dugout'],['meal','Meal bay']].map(([id,label])=>btn('data-place="'+id+'"',label)).join('')+'</div></details>';
    }
    if(this.page==='supplies'){
      html='<div class="position-actions" data-command-primary><button data-focus>Locate stores</button><button data-page="construction">Build storage</button></div><table class="supply-table"><thead><tr><th>Supply</th><th>Here</th><th>Requested</th><th>Inbound</th></tr></thead><tbody>'+supply.rows.filter(r=>r.key!=='fuel').map(r=>'<tr><th title="'+esc(r.reason)+'">'+r.label+'</th><td>'+Math.floor(r.local)+'</td><td>'+Math.ceil(r.requested)+'</td><td>'+Math.floor(r.inbound)+'</td></tr>').join('')+'</tbody></table><p>'+supply.allocated+' materials delivered or assigned to works · '+supply.required+' still to deliver</p><details><summary>Supply details</summary>'+supply.rows.filter(r=>r.missing>0).map(r=>'<p>'+r.label+' · '+Math.ceil(r.missing)+' needed · '+esc(r.reason)+'</p>').join('')+'<h3>Personal packs</h3>'+supply.rows.filter(r=>r.carried>0).map(r=>'<p>'+r.label+' '+Math.floor(r.carried)+'</p>').join('')+'</details>';
      const trucks=this.truckId?state.living!.trucks.filter(t=>t.id===this.truckId):state.living!.trucks.filter(t=>t.faction!=='enemy'&&(supply.trucks.includes(t)||t.role==='convoy'&&t.state!=='idle'));html+=trucks.map(t=>{const r=shipmentReadout(state,t);return '<article><h3>'+(t.role==='convoy'?'Supply convoy':'Delivery truck')+'</h3>'+btn('data-locate="'+t.id+'"','Locate')+'<p>'+esc(r.status)+' · '+esc(r.destination)+'</p><details><summary>Cargo / route</summary><dl>'+line('Source',esc(r.source))+line('Destination',esc(r.destination))+line('Cargo',r.cargo.map(esc).join('<br>')||'Empty')+line('Status',r.status)+line('Travel ETA',esc(r.eta))+'</dl>'+r.jobs.map(j=>'<p>Materials '+j.amount+' reserved for '+esc(j.name)+'</p>').join('')+(r.note?'<p>'+esc(r.note)+'</p>':'')+'</details></article>';}).join('');
    }
    if((this.page==='supplies'||this.page==='overview')&&supply.issue)html='<p class="command-issue" data-command-primary>'+esc(supply.issue)+'</p>'+html;
    if(this.assign&&f){
      const side=state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction??'player',eligible=state.soldiers.filter(s=>s.needs?.life==='active'&&(state.squads.find(q=>q.id===s.squadId)?.faction??'player')===side&&(distance(s,f)<180||groupIds.has(s.garrisonId!))).sort((a,b)=>(f.installation?0:Number(carriesPositionWeapon(state,b,f.kind as WeaponPositionKind))-Number(carriesPositionWeapon(state,a,f.kind as WeaponPositionKind)))||distance(a,f)-distance(b,f)||a.id-b.id);
      html+='<h3>Choose '+(this.assign==='crew'?'crew':'worker')+'</h3><div class="trench-person-list">'+eligible.map(s=>btn('data-choose="'+s.id+'"',esc(personName(s.id))+'<span>'+esc(equipmentOf(state,s).mortar?'Mortar kit':equipmentOf(state,s).tools?'Tools':WEAPONS[equipmentOf(state,s).weapon].name)+'</span>')).join('')+'</div>';
    }
    const key=this.page+':'+html;if(key!==this.key){this.key=key;updateCommandSurface(this.element,html);}
    if(this.locked())for(const b of this.element.querySelectorAll<HTMLButtonElement>('.position-content button:not([data-focus]):not([data-person]):not([data-position]):not([data-locate]),.command-primary button'))b.disabled=true;
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
