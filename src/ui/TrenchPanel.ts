import {distance,polylineLength,pointAlongPolyline,type Vec2,type TrenchState,type SoldierState} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import type {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import type {StrategyCamera} from '../render/StrategyCamera';
import type {PersonalOrder,Facility} from '../garrison/types';
import {friendlyTrenches,trenchName,trenchPeople,distanceToPolyline} from './TrenchReadout';
import {fieldIcon} from './FieldSymbols';
import {facilityName,WEAPON_POSITIONS} from '../construction/PositionDefinitions';
import {positionReadiness,crewAt,crewOperator,carriesPositionWeapon,type WeaponPositionKind} from '../combat/WeaponPositions';
import {equipmentOf} from '../combat/Equipment';
import {workReadout,networkSupply} from './PositionReadout';
import {placeMapLabels} from './MapLabels';

interface Actions {defend:(id:number)=>void;resume:(id:number)=>void;area:(id:number)=>void;move:(watch?:boolean)=>void;cancel:()=>void;notify:(text:string)=>void;place:(id:number,kind:Facility['kind'])=>void;fire:(id:number,kind:'mortarHE'|'mortarSmoke')=>void;person:()=>void}
type Page='overview'|'personnel'|'weapons'|'construction'|'supplies';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** One contextual inspector. Inventory is read-only; explicit buttons call simulation commands. */
export class TrenchPanel {
  readonly element=document.createElement('section');
  private readonly button=document.createElement('button');
  private readonly overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private readonly labels=document.createElement('div');
  private trenchId=0;private personId=0;private facilityId=0;private truckId=0;private page:Page='overview';private last=0;private key='';private assign:'crew'|'worker'|undefined;
  private cachedTrenches:TrenchState[]=[];private cachedFacilities:Facility[]=[];private hovered=0;private pointer?:{x:number;y:number};private watchMove=false;
  private readonly hint=document.createElement('div');
  private projectedPerson?:SoldierState;
  private hoverFacility?:Facility;
  private lines:TrenchState[]=[];
  private entries:{id:number;type:string;point:Vec2;name:string}[]=[];
  get showRoutes(){return !this.element.hidden&&this.page==='supplies';}
  constructor(private sim:BattlefieldSimulation,private camera:StrategyCamera,private selected:ReadonlySet<number>,private actions:Actions){
    const root=document.querySelector<HTMLElement>('#ui-root')!;
    this.button.id='trenches-command';this.button.innerHTML=fieldIcon('defend')+'Positions';this.button.setAttribute('aria-expanded','false');root.querySelector('.hud-tools summary')!.after(this.button);
    this.element.id='trench-panel';this.element.className='trench-panel position-inspector';this.element.hidden=true;this.element.setAttribute('aria-label','Position management');
    this.element.innerHTML='<header><div><small>POSITION / TRENCH NETWORK</small><h2>Position</h2></div><button data-close aria-label="Close position management">×</button></header><label class="position-picker">Trench<select id="trench-choice" aria-label="Trench"></select></label><nav class="position-tabs" aria-label="Position pages">'+(['overview','personnel','weapons','construction','supplies'] as Page[]).map(p=>'<button data-page="'+p+'">'+({overview:'Overview',personnel:'People',weapons:'Weapons',construction:'Build',supplies:'Supplies'}[p])+'</button>').join('')+'</nav><div class="position-content"></div>';
    root.append(this.element);this.overlay.classList.add('trench-inspection-overlay');this.overlay.setAttribute('aria-hidden','true');this.labels.className='position-labels';this.hint.className='position-hover';this.hint.hidden=true;root.append(this.labels,this.hint);document.querySelector('#app')!.append(this.overlay);
    this.button.onclick=()=>this.element.hidden?this.open():this.close();this.element.addEventListener('click',e=>this.click(e));
    this.element.querySelector('#trench-choice')!.addEventListener('change',e=>{this.trenchId=Number((e.target as HTMLSelectElement).value);this.facilityId=this.personId=this.truckId=0;delete document.documentElement.dataset.personSelected;this.assign=undefined;this.update(true);this.focus();});
    this.labels.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(b?.dataset.trench)this.open(Number(b.dataset.trench));if(b?.dataset.facility)this.chooseFacility(Number(b.dataset.facility));});
    window.addEventListener('pointermove',e=>{this.pointer=e.target instanceof HTMLCanvasElement?{x:e.clientX,y:e.clientY}:undefined;});
    window.addEventListener('frontlines-menu',()=>this.close());
    root.addEventListener('click',e=>{if((e.target as Element).closest('#build-command,#support-command,[data-hud-panel]'))this.close();});
    window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!this.element.hidden){this.close();e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  private locked(){return this.sim.commandsLocked||Boolean(document.documentElement.dataset.menu||document.documentElement.dataset.help||document.documentElement.dataset.replay);}
  open(id?:number):void {window.dispatchEvent(new Event('frontlines-menu'));this.trenchId=id??this.trenchId;this.facilityId=this.personId=this.truckId=0;this.assign=undefined;this.page='overview';this.element.hidden=false;document.documentElement.dataset.positionOpen='true';this.button.setAttribute('aria-expanded','true');this.update(true);this.element.scrollTop=0;}
  close():void{this.element.hidden=true;this.personId=0;this.projectedPerson=undefined;this.overlay.replaceChildren();this.labels.replaceChildren();delete this.labels.dataset.key;this.button.setAttribute('aria-expanded','false');delete document.documentElement.dataset.personSelected;delete document.documentElement.dataset.positionOpen;this.actions.cancel();}
  clearPerson():void{this.personId=0;delete document.documentElement.dataset.personSelected;this.update(true);}
  private focus():void{const f=this.sim.state.living!.facilities.find(f=>f.id===this.facilityId),t=this.sim.state.trenches.find(t=>t.id===this.trenchId);if(f)this.camera.focus(f,55);else if(t)this.camera.focus(pointAlongPolyline(t.points,.5),Math.max(80,Math.min(600,polylineLength(t.points)*1.5)));}
  inspectFacility(id:number):boolean{const f=this.sim.state.living!.facilities.find(f=>f.id===id),g=this.sim.state.living!.garrisons.find(g=>g.id===f?.garrisonId);if(!f||!g||g.faction==='enemy')return false;this.open(f.trenchAnchor?.trenchId??g.trenchId);this.facilityId=id;this.page=f.progress<1?'construction':['emplacement','mortar'].includes(f.kind)?'weapons':'overview';this.update(true);return true;}
  inspectPerson(id:number):boolean{
    const s=this.sim.state.soldiers.find(s=>s.id===id);if(!s||this.sim.state.squads.find(q=>q.id===s.squadId)?.faction==='enemy')return false;
    const choices=friendlyTrenches(this.sim.state,this.sim.garrisons.network).sort((a,b)=>distanceToPolyline(s,a.points).distance-distanceToPolyline(s,b.points).distance);
    this.open(choices[0]?.id);this.personId=id;this.page='personnel';document.documentElement.dataset.personSelected='true';this.actions.person();this.update(true);return true;
  }
  inspectAt(point:Vec2):boolean{
    const f=this.cachedFacilities.find(f=>distance(f,point)<(f.trenchAnchor?2.2:4));if(f)return this.chooseFacility(f.id);
    const truck=this.sim.state.living!.trucks.find(t=>t.faction!=='enemy'&&distance(t,point)<4);if(truck){const g=this.sim.state.living!.garrisons.find(g=>g.id===truck.garrisonId);this.open(g?.trenchId);this.truckId=truck.id;this.page='supplies';this.update(true);return true;}
    const t=this.cachedTrenches.find(t=>distanceToPolyline(point,t.points).distance<Math.max(3,t.width/2));if(!t)return false;this.open(t.id);return true;
  }
  private chooseFacility(id:number):boolean{
    const f=this.cachedFacilities.find(f=>f.id===id);
    if(this.personId&&f&&['emplacement','mortar'].includes(f.kind)){
      if(this.locked())return false;
      this.actions.notify(this.sim.garrisons.assignCrew(this.personId,f.id).reason);this.update(true);return true;
    }return this.inspectFacility(id);
  }
  movePerson(point:Vec2):boolean{if(this.locked()||this.element.hidden)return false;const result=this.sim.garrisons.orderPerson(this.personId,this.watchMove?'watch':'move',point);this.actions.notify(result.reason);this.update(true);return result.accepted;}
  private click(e:Event):void{
    const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
    if(b.hasAttribute('data-close')){this.close();return;}if(b.dataset.page){this.page=b.dataset.page as Page;this.assign=undefined;this.update(true);return;}
    if(b.dataset.person){this.inspectPerson(Number(b.dataset.person));return;}if(b.dataset.position){this.inspectFacility(Number(b.dataset.position));return;}
    if(b.dataset.locate){const truck=this.sim.state.living!.trucks.find(t=>t.id===Number(b.dataset.locate));if(truck)this.camera.focus(truck,80);return;}
    if(b.hasAttribute('data-focus')){this.focus();return;}
    if(this.locked())return;
    const f=this.sim.state.living!.facilities.find(f=>f.id===this.facilityId);
    if(b.dataset.order){const order=b.dataset.order as PersonalOrder;if(order==='move'||order==='watch'){this.watchMove=order==='watch';this.actions.move(this.watchMove);this.actions.notify('Click excavated trench floor · only this person moves.');}else this.actions.notify(this.sim.garrisons.orderPerson(this.personId,order).reason);}
    if(b.dataset.place){this.actions.place(-this.trenchId,b.dataset.place as Facility['kind']);this.close();}
    if(b.hasAttribute('data-defend'))this.actions.defend(this.trenchId);
    if(b.hasAttribute('data-resume'))this.actions.resume(this.trenchId);
    if(b.dataset.assign){this.assign=b.dataset.assign as 'crew'|'worker';}
    if(b.dataset.choose&&f){this.actions.notify((this.assign==='crew'?this.sim.garrisons.assignCrew(Number(b.dataset.choose),f.id):this.sim.garrisons.assignWorker(f.id,Number(b.dataset.choose))).reason);}
    if(b.hasAttribute('data-auto-crew')&&f)this.actions.notify(this.sim.garrisons.autoCrew(f.id).reason);
    if(b.hasAttribute('data-auto-workers')&&f)this.actions.notify(this.sim.garrisons.autoWorkers(f.id).reason);
    if(b.dataset.remove&&f)this.sim.garrisons.removeCrew(f.id,Number(b.dataset.remove));
    if(b.hasAttribute('data-remove-all')&&f)this.sim.garrisons.removeCrew(f.id);
    if(b.dataset.removeWorker&&f?.workOrder){const id=Number(b.dataset.removeWorker);this.actions.notify(this.sim.garrisons.orderPerson(id,'auto').reason);}
    if(b.dataset.fire&&f){this.actions.fire(f.id,b.dataset.fire as 'mortarHE'|'mortarSmoke');this.close();}
    this.update(true);
  }
  update(force=false):void{
    const state=this.sim.state,network=this.sim.garrisons.network;this.button.disabled=this.locked();
    // The existing emergency decision owns the right drawer until it is answered.
    if(!this.element.hidden&&state.living!.garrisons.some(g=>g.faction!=='enemy'&&g.cutoff==='decision'))this.close();
    if(force||performance.now()-this.last>250){
      this.last=performance.now();this.cachedTrenches=friendlyTrenches(state,network);this.cachedFacilities=state.living!.facilities.filter(f=>state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction!=='enemy');
      this.hovered=0;const p=this.pointer?this.camera.groundPoint(this.pointer.x,this.pointer.y):undefined;
      const hover=p?this.cachedFacilities.find(f=>distance(f,p)<(f.trenchAnchor?2.2:4)):undefined;
      this.hoverFacility=hover;this.projectedPerson=state.soldiers.find(s=>s.id===this.personId);
      if(p&&!hover)this.hovered=this.cachedTrenches.find(t=>distanceToPolyline(p,t.points).distance<3)?.id??0;
      this.hint.hidden=!hover||this.locked();if(hover){this.hint.textContent=facilityName(state,hover)+'\n'+(hover.progress<1?workReadout(state,hover).status:['emplacement','mortar'].includes(hover.kind)?positionReadiness(state,hover)||'READY':'COMPLETE')+' · Click to manage';}
      if(!this.element.hidden)this.renderContent();
      const component=network.component(this.hovered||this.trenchId);
      this.lines=this.cachedTrenches.filter(t=>t.id===(this.hovered||this.trenchId)||component!==undefined&&network.component(t.id)===component).slice(0,60);
      this.entries=[...this.cachedTrenches.slice(0,60).map(t=>({id:t.id,type:'trench',point:pointAlongPolyline(t.points,.5),name:trenchName(state,t.id).replace('Trench ','T')})),...this.cachedFacilities.slice(0,60).map(f=>({id:f.id,type:'facility',point:f,name:facilityName(state,f)}))];
    }
    this.project();
  }
  private renderContent():void{
    const state=this.sim.state,network=this.sim.garrisons.network;
    if(!this.cachedTrenches.some(t=>t.id===this.trenchId))this.trenchId=this.cachedTrenches[0]?.id??0;
    const choice=this.element.querySelector<HTMLSelectElement>('#trench-choice')!,options=this.cachedTrenches.map(t=>'<option value="'+t.id+'">'+trenchName(state,t.id)+'</option>').join('');if(choice.dataset.key!==options){choice.innerHTML=options;choice.dataset.key=options;}choice.value=String(this.trenchId);
    const t=this.cachedTrenches.find(t=>t.id===this.trenchId),component=t?network.component(t.id):undefined,groups=component===undefined?[]:state.living!.garrisons.filter(g=>g.faction!=='enemy'&&network.component(g.trenchId)===component),groupIds=new Set(groups.map(g=>g.id));
    const connected=this.cachedTrenches.filter(o=>component!==undefined&&network.component(o.id)===component),facilities=this.cachedFacilities.filter(f=>groupIds.has(f.garrisonId)),supply=networkSupply(state,groups),people=t?trenchPeople(state,network,t):[];
    const f=facilities.find(f=>f.id===this.facilityId),person=state.soldiers.find(s=>s.id===this.personId),personName=(id:number)=>{const s=state.soldiers.find(s=>s.id===id),q=state.squads.find(q=>q.id===s?.squadId);return q?q.name+' '+String(q.soldierIds.indexOf(id)+1).padStart(2,'0'):'Person '+id;};
    this.element.querySelector('h2')!.textContent=f?facilityName(state,f):t?trenchName(state,t.id):'Positions';
    for(const b of this.element.querySelectorAll<HTMLButtonElement>('[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===this.page));
    let html='';
    const btn=(attrs:string,label:string)=>'<button '+attrs+'>'+label+'</button>';
    const line=(name:string,value:string|number)=>'<dt>'+name+'</dt><dd>'+value+'</dd>';
    const job=(p:Facility)=>{const r=workReadout(state,p);return '<article class="position-job">'+btn('data-position="'+p.id+'"',facilityName(state,p))+'<strong>'+r.status+'</strong><p>'+esc(r.reason)+'</p><dl>'+line('Materials delivered',Math.floor(r.delivered)+' / '+p.materialCost)+line('Carried to job',Math.floor(r.inbound))+line('Local materials',Math.floor(r.local))+line('Still needed',Math.ceil(r.remaining))+line('Workers',r.workers)+line('Structure',Math.floor(p.progress*100)+'%')+'</dl></article>';};
    if(this.page==='overview')html='<strong class="network-name">'+(groups.map(g=>esc(g.name)).join(' / ')||'Unassigned network')+'</strong><dl>'+line('Excavated',t?Math.round(polylineLength(t.points)*t.progress)+' / '+Math.round(polylineLength(t.points))+' m':'—')+line('Capacity',network.capacity(component??-1))+line('Personnel here',people.length)+line('Structures',facilities.length)+line('Combat',groups.some(g=>(g.underFireUntil??0)>state.elapsed)?'UNDER FIRE':'Quiet')+'</dl><p>Connected: '+(connected.filter(o=>o!==t).map(o=>trenchName(state,o.id)).join(', ')||'No other trenches')+'</p><div class="position-actions">'+btn('data-focus','Locate')+btn('data-defend '+(!this.selected.size?'disabled':''),'Assign selected squads')+(t&&t.progress<1?btn('data-resume','Assign digging crew'):'')+'</div><h3>Build here</h3><div class="position-actions">'+btn('data-place="emplacement"','MG position')+btn('data-place="mortar"','Mortar pit')+'</div>';
    if(this.page==='personnel'){
      if(person){const equipment=equipmentOf(state,person);html='<section class="trench-person-detail"><small>PERSON SELECTED</small><h3>'+esc(personName(person.id))+'</h3><p>'+esc(person.action)+' · '+esc(person.needs?.life??'active')+' · '+esc(equipment.weapon)+'</p><p>'+esc(person.combat?.pauseReason??person.duty?.reason??'Formation order')+'</p><div class="person-orders">'+[['move','Move here'],['watch','Watch here'],['rest','Rest'],['meal','Eat / drink'],['auto','Automatic duties']].map(([id,label])=>btn('data-order="'+id+'"',label)).join('')+'</div><p>Click a completed weapon position to man it.</p></section>';}
      html+='<h3>Local personnel · '+people.length+'</h3><div class="trench-person-list">'+people.map(s=>btn('data-person="'+s.id+'" aria-pressed="'+(s.id===this.personId)+'"','<strong>'+esc(personName(s.id))+'</strong><span>'+esc(equipmentOf(state,s).tools?'TOOLS':equipmentOf(state,s).mortar?'MORTAR':equipmentOf(state,s).weapon)+' · '+esc(s.needs?.life==='active'?s.action:s.needs?.life)+'</span>')).join('')+'</div>';
    }
    if(this.page==='weapons'){
      if(f&&['emplacement','mortar'].includes(f.kind)){
        const crew=crewAt(state,f),kind=f.kind as WeaponPositionKind,operator=crewOperator(state,f),ammo=crew.reduce((n,s)=>n+(s.carried?.ammo??0),0),he=crew.reduce((n,s)=>n+(s.carried?.mortarHE??0),0),smoke=crew.reduce((n,s)=>n+(s.carried?.mortarSmoke??0),0);
        html='<strong class="position-status">'+esc(positionReadiness(state,f)||'READY')+'</strong><p>Crew '+crew.length+' / '+WEAPON_POSITIONS[kind].crew+' · Facing '+Math.round((f.facing??0)*180/Math.PI)+'°</p><div class="crew-slots">'+Array.from({length:WEAPON_POSITIONS[kind].crew},(_,i)=>crew[i]?'<div>'+esc(personName(crew[i].id))+' · '+(crew[i]===operator?'Gunner':'Assistant')+btn('data-remove="'+crew[i].id+'" aria-label="Return '+esc(personName(crew[i].id))+' to area duties"','Remove')+'</div>':'<div>Empty crew slot</div>').join('')+'</div><div class="position-actions">'+btn('data-assign="crew"','Assign person')+btn('data-auto-crew','Auto assign crew')+btn('data-remove-all','Remove crew')+btn('data-focus','Locate')+'</div>';
        html+='<dl>'+(kind==='mortar'?line('Crew ammunition',he+' HE / '+smoke+' smoke')+line('Local stores',Math.floor(supply.local.mortarHE)+' HE / '+Math.floor(supply.local.mortarSmoke)+' smoke'):line('Crew ammunition',ammo+' rounds')+line('Local stores',Math.floor(supply.local.ammo)+' rounds'))+'</dl>';
        if(kind==='mortar')html+='<div class="position-actions">'+btn('data-fire="mortarHE" '+(!operator||f.progress<1?'disabled':''),'Fire HE')+btn('data-fire="mortarSmoke" '+(!operator||f.progress<1?'disabled':''),'Fire smoke')+'</div>';else html+='<p>Automatically engages visible enemies in its firing sector.</p>';
      }else html='<h3>Weapon positions</h3>'+facilities.filter(p=>['emplacement','mortar'].includes(p.kind)).map(p=>btn('class="position-row" data-position="'+p.id+'"',facilityName(state,p)+'<small>'+esc(positionReadiness(state,p)||'READY')+'</small>')).join('');
      html+='<div class="position-actions">'+btn('data-place="emplacement"','Build MG position')+btn('data-place="mortar"','Build mortar pit')+'</div>';
    }
    if(this.page==='construction'){
      if(f&&f.progress<1){html=job(f)+'<div class="position-actions">'+btn('data-auto-workers','Auto workers')+btn('data-assign="worker"','Choose worker')+btn('data-focus','Locate worksite')+'</div>'+(f.workOrder?.workerIds??[]).map(id=>'<p>'+esc(personName(id))+btn('data-remove-worker="'+id+'"','Return to duties')+'</p>').join('');}
      else html=facilities.filter(p=>p.progress<1).map(job).join('')||'<p>No unfinished structures.</p>';
      html+='<h3>New work order</h3><div class="position-actions">'+[['emplacement','MG position'],['mortar','Mortar pit'],['aid','Aid post'],['ammo','Ammo store'],['store','Supply store'],['rest','Rest dugout'],['meal','Meal bay']].map(([id,label])=>btn('data-place="'+id+'"',label)).join('')+'</div>';
    }
    if(this.page==='supplies'){
      html='<p class="supply-chain">Rear → Truck → Forward point → Carriers → Network</p><p>Supply routes shown on the battlefield. Store stock is separate from personal packs.</p>'+supply.rows.map(r=>'<details class="supply-row"><summary>'+r.label+' <strong data-stock="'+r.status+'">'+r.status+'</strong></summary><p>'+Math.floor(r.local)+' local · '+Math.floor(r.inbound)+' inbound · '+Math.floor(r.carried)+' carried by people</p><small>LOW below '+r.threshold+' in stores; inbound is not yet available.</small></details>').join('')+'<p>'+supply.allocated+' materials committed to construction · '+supply.required+' outstanding</p><p>Last forward delivery: '+(supply.lastDelivery<0?'none recorded':Math.floor(state.elapsed-supply.lastDelivery)+' simulation seconds ago')+'</p>';
      const trucks=this.truckId?state.living!.trucks.filter(t=>t.id===this.truckId):supply.trucks;html+=trucks.map(t=>'<article><h3>Supply truck '+t.id+'</h3><p>'+esc(t.state)+' · '+esc(t.reason)+'</p><p>'+Math.floor(t.cargo.ammo)+' ammo · '+Math.floor(t.cargo.materials)+' materials · '+Math.floor(t.cargo.mortarHE)+' HE</p><p>'+Math.round(t.route.slice(t.routeIndex).reduce((n,p,i,a)=>n+distance(i?a[i-1]:t,p),0))+' m remaining on planned route</p>'+btn('data-locate="'+t.id+'"','Locate truck')+'</article>').join('');
    }
    if(this.assign&&f){
      const side=state.living!.garrisons.find(g=>g.id===f.garrisonId)?.faction??'player',eligible=state.soldiers.filter(s=>s.needs?.life==='active'&&(state.squads.find(q=>q.id===s.squadId)?.faction??'player')===side&&(distance(s,f)<180||groupIds.has(s.garrisonId!))).sort((a,b)=>Number(carriesPositionWeapon(state,b,f.kind as WeaponPositionKind))-Number(carriesPositionWeapon(state,a,f.kind as WeaponPositionKind))||a.id-b.id);
      html+='<h3>Choose '+(this.assign==='crew'?'crew':'worker')+'</h3><div class="trench-person-list">'+eligible.map(s=>btn('data-choose="'+s.id+'"',esc(personName(s.id))+'<span>'+esc(equipmentOf(state,s).mortar?'MORTAR':equipmentOf(state,s).tools?'TOOLS':equipmentOf(state,s).weapon)+'</span>')).join('')+'</div>';
    }
    const key=this.page+':'+html;if(key!==this.key){this.key=key;const content=this.element.querySelector('.position-content')!;const expanded=[...content.querySelectorAll<HTMLDetailsElement>('details[open]')].map(d=>d.querySelector('summary')?.textContent);content.innerHTML=html;for(const d of content.querySelectorAll<HTMLDetailsElement>('details'))d.open=expanded.includes(d.querySelector('summary')?.textContent);}
    if(this.locked())for(const b of this.element.querySelectorAll<HTMLButtonElement>('.position-content button:not([data-focus]):not([data-person]):not([data-position]):not([data-locate])'))b.disabled=true;
  }
  private project():void{
    const hidden=this.locked()||Boolean(document.documentElement.dataset.fieldMap);
    if(this.pointer&&!this.hint.hidden){this.hint.style.left=Math.min(this.pointer.x+16,window.innerWidth-240)+'px';this.hint.style.top=Math.min(this.pointer.y+16,window.innerHeight-100)+'px';}
    this.overlay.style.display=hidden?'none':'';this.labels.style.display=hidden||this.element.hidden?'none':'';if(hidden)return;
    const paths:Vec2[][]=this.element.hidden?[]:this.lines.map(t=>excavatedPoints(t));
    const f=this.hoverFacility??(!this.element.hidden?this.cachedFacilities.find(f=>f.id===this.facilityId):undefined);
    if(f){const r=f.trenchAnchor?1.7:3.2;paths.push(Array.from({length:17},(_,i)=>({x:f.x+Math.sin(i*Math.PI/8)*r,z:f.z+Math.cos(i*Math.PI/8)*r})));}
    if(!this.element.hidden&&this.projectedPerson){const s=this.projectedPerson;paths.push(Array.from({length:17},(_,i)=>({x:s.x+Math.sin(i*Math.PI/8)*.9,z:s.z+Math.cos(i*Math.PI/8)*.9})));}
    const screens=paths.map(path=>path.map(p=>this.camera.project(p,.3)));
    if(!this.element.hidden){
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
    for(const [i,child] of [...this.overlay.children].entries()){child.setAttribute('class',i<paths.length?'inspection-built':'inspection-label');child.setAttribute('points',screens[i]?.map(p=>p.x+','+p.y).join(' ')??'');}
  }
}
