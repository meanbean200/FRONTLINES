import type { BattlefieldState, Vec2 } from '../core/types';
import { SETTLEMENTS } from '../terrain/WorldFeatures';
import type { StrategyCamera } from '../render/StrategyCamera';
import {CameraCompass} from './CameraCompass';
import {controlReadout,controlZone} from '../operations/ObjectiveControl';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {pointAlongPolyline,polylineLength} from '../core/types';
import { factionOf } from '../operations/types';
import {reportAnnotations,contactDescription,type ContactGroup} from './ContactReadout';
import {excavatedSpan} from '../core/TrenchGeometry';
import {trenchPresence} from './GarrisonReadout';
import {fieldIcon} from './FieldSymbols';
import {FieldMap,type PlanningActions} from './FieldMap';
import {OrderOverlay} from './OrderOverlay';
import {connectedName,friendlyTrenches,networkRepresentatives} from './TrenchReadout';
import {knownTrenchNetworks,type KnownTrenchNetwork} from '../operations/TrenchIntelligence';
import {formationLabels} from './FormationLabels';

export class TacticalOverlay {
  private readonly layer=document.createElement('div');
  private readonly leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private markers=new Map<number,HTMLButtonElement>();
  private contactMarkers=new Map<number,{element:HTMLDivElement;contact:ContactGroup}>();
  private trenchMarkers=new Map<number,HTMLButtonElement>();
  private knownMarkers=new Map<number,{element:HTMLButtonElement;row:KnownTrenchNetwork}>();
  private objectiveMarkers=new Map<string,HTMLButtonElement>();
  private markerTimer=1/30;
  private labels: {element:HTMLElement;point:Vec2}[]=[];
  private network=new TrenchNetwork();
  private networkTimer=0;
  private presence=new Map<number,number>();
  private readonly fieldMap:FieldMap;
  private readonly orders:OrderOverlay;
  private readonly compass:CameraCompass;
  constructor(private readonly getState:()=>BattlefieldState,private readonly selected:Set<number>,private readonly camera:StrategyCamera,terrain:TerrainSystem,private readonly select:(ids:number[],add?:boolean)=>void,private readonly occupy:(id:number)=>void,move?:(point:Vec2)=>void,planning?:PlanningActions,private readonly inspectTown?:(id:string)=>void){
    this.layer.className='tactical-overlay';this.leaders.classList.add('formation-leaders');this.layer.append(this.leaders);document.querySelector('#app')!.append(this.layer);
    for(const settlement of SETTLEMENTS){const label=document.createElement('div');label.className='place-name';label.textContent=settlement.name;this.layer.append(label);this.labels.push({element:label,point:settlement});}
    this.fieldMap=new FieldMap(getState,terrain,camera,selected,select,move,planning);
    this.orders=new OrderOverlay(getState,selected,camera);
    this.compass=new CameraCompass(camera);
  }
  update(dt:number):void {
    this.compass.update();
    this.fieldMap?.update(dt);
    this.orders?.update();
    if(this.layer.dataset)this.layer.dataset.scale=this.camera.zoomDistance<180?'close':this.camera.zoomDistance>1100?'operational':'tactical';
    this.markerTimer+=dt;
    if(this.markerTimer>=1/30){this.updateMarkers(this.markerTimer);this.markerTimer=0;}
    // Match the camera rendered this frame, even between content refreshes.
    // No visibility debounce or transform tween: both would lag behind the world.
    this.positionMarkers();
  }
  private updateMarkers(dt:number):void {
    const state=this.getState(),friendly=state.squads.filter(s=>factionOf(s)==='player'),ids=new Set(friendly.map(s=>s.id));
    const counts=new Map<number,number>(),relocating=new Set<number>();for(const s of state.soldiers)if(s.needs?.life==='active'){counts.set(s.squadId,(counts.get(s.squadId)??0)+1);if(s.duty?.relocationExit)relocating.add(s.squadId);}
    this.networkTimer-=dt;if(this.networkTimer<=0){this.networkTimer=.5;this.network.sync(state.trenches);this.presence=trenchPresence(state,this.network);}
    for(const[id,element]of this.markers)if(!ids.has(id)){element.remove();this.markers.delete(id);}
    friendly.forEach((squad,index)=>{
      let marker=this.markers.get(squad.id);
      if(!marker){marker=document.createElement('button');marker.className=`squad-marker ${squad.kind}`;marker.setAttribute('aria-label',`Select ${squad.name}`);marker.innerHTML=`<i>${squad.kind==='engineer'?'⚒':'×'}</i><b>${squad.kind==='engineer'?'E'+(index-19):String(index+1).padStart(2,'0')}</b><small></small>`;
        marker.addEventListener('click',e=>{const current=this.getState().squads.find(s=>s.id===squad.id);if(current&&factionOf(current)==='player')this.select([squad.id],e.shiftKey);});marker.addEventListener('dblclick',()=>{const current=this.getState().squads.find(s=>s.id===squad.id);if(current)this.camera.focus(current,110);});this.markers.set(squad.id,marker);this.layer.append(marker);}
      marker.classList.toggle('engineer',squad.kind==='engineer');marker.setAttribute('aria-label',`Select ${squad.name}`);
      const able=counts.get(squad.id)??0;
      marker.classList.toggle('depleted',able===0);
      marker.title=`${squad.name} · ${able} able`;
      if(marker.dataset.kind!==squad.kind){marker.dataset.kind=squad.kind;marker.querySelector('i')!.innerHTML=fieldIcon(squad.kind);}
      marker.querySelector('b')!.textContent=squad.kind==='engineer'?'E'+(state.squads.filter(s=>s.kind==='engineer').findIndex(s=>s.id===squad.id)+1):String(index+1).padStart(2,'0');
      marker.classList.toggle('selected',this.selected.has(squad.id));marker.classList.toggle('moving',squad.movementState==='moving');
      const text=marker.querySelector('small')!;
      const trench=state.trenches.find(t=>t.id===squad.order.trenchId);
      const withdrawn=state.living?.garrisons.some(g=>g.cutoff==='withdraw'&&g.squadIds.includes(squad.id));
      text.textContent=able===0?'OUT OF ACTION':withdrawn?'WITHDRAWAL':relocating.has(squad.id)?'RELOCATING':squad.order.type==='construct-trench'&&trench?`${Math.floor(trench.progress*100)}%`:squad.order.type==='occupy-trench'?'DEFENDING':squad.movementState==='planning'?'PLANNING':squad.movementState==='moving'?'MOVING':'';
      let tip=marker.querySelector<HTMLElement>('.marker-tip');if(!tip){tip=document.createElement('span');tip.className='marker-tip';tip.setAttribute('aria-hidden','true');marker.append(tip);}tip.textContent=`${squad.name}\n${able} / ${squad.soldierIds.length} able · ${text.textContent||'Holding'}\nClick to select · double-click to focus`;
    });
    const contacts=reportAnnotations(state),contactIds=new Set(contacts.map(c=>c.id));
    for(const[id,m]of this.contactMarkers)if(!contactIds.has(id)){m.element.remove();this.contactMarkers.delete(id);}
    for(const contact of contacts){
      let marker=this.contactMarkers.get(contact.id);
      if(!marker){
        const element=document.createElement('div');element.className='contact-marker';element.setAttribute('role','img');element.tabIndex=0;
        element.innerHTML='<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 3 25 14 14 25 3 14Z"/><circle cx="14" cy="14" r="2"/></svg><span class="marker-tip" aria-hidden="true"></span>';
        marker={element,contact};this.contactMarkers.set(contact.id,marker);this.layer.append(element);
      }
      marker.contact=contact;marker.element.classList.toggle('last-seen',!contact.visible);
      marker.element.dataset.x=String(contact.x);marker.element.dataset.z=String(contact.z);
      const description=(contact.heard?'Heard gunfire · approximate area\nNot a visual sighting':contactDescription(contact.visible))+'\nReported '+Math.floor(state.elapsed-contact.lastSeen)+' seconds ago';marker.element.setAttribute('aria-label',description.replace('\n',' · '));
      marker.element.querySelector('.marker-tip')!.textContent=description;
    }
    const representatives=networkRepresentatives(friendlyTrenches(state,this.network),this.network);
    const known=knownTrenchNetworks(state).filter(n=>!representatives.some(t=>this.network.anchor(t.id)===n.id));
    for(const[id,m]of this.knownMarkers)if(!known.some(n=>n.id===id)){m.element.remove();this.knownMarkers.delete(id);}
    for(const row of known){let m=this.knownMarkers.get(row.id);if(!m){const element=document.createElement('button');element.className='trench-capacity enemy-network';element.onclick=()=>this.occupy(row.id);this.layer.append(element);m={element,row};this.knownMarkers.set(row.id,m);}m.row=row;m.element.textContent=row.name;m.element.title='Observed ground · occupants unknown · click for orders';}
    const trenchIds=new Set(representatives.map(t=>t.id));
    for(const[id,m]of this.trenchMarkers)if(!trenchIds.has(id)){m.remove();this.trenchMarkers.delete(id);}
    for(const trench of representatives){
      let m=this.trenchMarkers.get(trench.id);
      if(!m){m=document.createElement('button');m.className='trench-capacity';m.addEventListener('click',()=>this.occupy(trench.id));this.layer.append(m);this.trenchMarkers.set(trench.id,m);}
      const component=this.network.component(trench.id),members=state.living?.garrisons.filter(g=>this.network.component(g.trenchId)===component)??[];
      m.disabled=false;
      const support=state.living?.facilities.some(f=>f.connectorId===trench.id);
      m.dataset.representative=String(!support);
      const used=state.soldiers.filter(s=>s.needs?.life!=='dead'&&members.some(g=>s.garrisonId===g.id)).length,capacity=this.network.capacity(component??-1);
      const inside=this.presence.get(component??-1)??0;
      m.textContent=connectedName(state,this.network,trench.id);
      m.setAttribute('aria-label',`Inspect ${m.textContent}`);
      m.title=`Click to inspect and highlight this trench. Connected network: ${inside} inside · ${used}/${capacity} assigned. Manage personnel or assign squads in the inspector.`;
    }
    const objectiveIds=new Set(state.operation?.objectives.map(o=>o.id));
    for(const[id,marker]of this.objectiveMarkers)if(!objectiveIds.has(id)){marker.remove();this.objectiveMarkers.delete(id);}
    for(const[i,o]of (state.operation?.objectives??[]).entries()){
      let marker=this.objectiveMarkers.get(o.id);if(!marker){marker=document.createElement('button');marker.onclick=()=>this.inspectTown?.(o.id);marker.setAttribute('aria-label',`Inspect ${o.name}`);this.objectiveMarkers.set(o.id,marker);this.layer.append(marker);}
      marker.className=`objective-world-label ${o.owner}`;marker.textContent=`${String.fromCharCode(65+i)} · ${o.name} · ${controlReadout(state,o).status}`;
    }
  }
  private positionMarkers():void {
    const state=this.getState();
    const anchors=state.squads.filter(s=>s.soldierIds.length&&this.markers.has(s.id)).map(s=>({id:s.id,...this.camera.project(s,3)}));
    const objectives=(state.operation?.objectives??[]).map(o=>({o,p:this.camera.project(controlZone(state,o)?.center??o,9)}));
    const reserved=objectives.filter(({p})=>p.visible).map(({o,p})=>({x:p.x,y:p.y,width:Math.max(160,(this.objectiveMarkers.get(o.id)?.textContent?.length??25)*6.8),height:48}));
    const arranged=new Map(formationLabels(anchors.filter(p=>p.visible).map(p=>({id:p.id,x:p.x,y:p.y-18})),typeof window==='undefined'?1920:window.innerWidth,typeof window==='undefined'?1080:window.innerHeight,reserved).map(p=>[p.id,p]));
    const lines:{x1:number;y1:number;x2:number;y2:number}[]=[];
    for(const m of this.knownMarkers?.values()??[]){const p=this.camera.project(m.row.point,1);m.element.style.display=p.visible?'':'none';m.element.style.transform=`translate(${p.x}px,${p.y+20}px) translate(-50%,0)`;}
    for(const squad of state.squads){
      const marker=this.markers.get(squad.id);if(!marker)continue;
      if(!squad.soldierIds.length){marker.style.display='none';continue;}
      const p=anchors.find(p=>p.id===squad.id)!,label=arranged.get(squad.id);marker.style.display=p.visible?'':'none';
      marker.style.transform=`translate(${label?.x??p.x}px,${label?.y??p.y-18}px) translate(-50%,-100%)`;
      if(label&&(Math.abs(label.x-p.x)>1||Math.abs(label.y-(p.y-18))>1))lines.push({x1:p.x,y1:p.y,x2:label.x,y2:label.y-15});
    }
    if(this.leaders){
      while(this.leaders.children.length<lines.length)this.leaders.append(document.createElementNS(this.leaders.namespaceURI,'line'));
      for(const [i,node]of [...this.leaders.children].entries()){
        const line=lines[i];node.setAttribute('visibility',line?'visible':'hidden');
        if(line)for(const [key,value]of Object.entries(line))node.setAttribute(key,String(value));
      }
    }
    for(const {element,contact}of this.contactMarkers.values()){
      const p=this.camera.project(contact,3);element.style.display=p.visible?'':'none';
      element.style.transform=`translate(${p.x}px,${p.y-18}px) translate(-50%,-100%)`;
    }
    for(const trench of state.trenches){
      const marker=this.trenchMarkers.get(trench.id);if(!marker)continue;
      const support=state.living?.facilities.some(f=>f.connectorId===trench.id);
      const span=excavatedSpan(trench),p=this.camera.project(pointAlongPolyline(trench.points,(span.start+span.end)/2/Math.max(1,polylineLength(trench.points))),1);
      marker.style.display=!support&&marker.dataset.representative==='true'&&p.visible&&this.camera.zoomDistance<1600?'':'none';
      marker.style.transform=`translate(${p.x}px,${p.y+20}px) translate(-50%,0)`;
    }
    for(const label of this.labels){const p=this.camera.project(label.point,25);label.element.style.display=p.visible&&this.camera.zoomDistance>200?'':'none';label.element.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;}
    for(const {o:objective,p} of objectives){
      const marker=this.objectiveMarkers.get(objective.id);if(!marker)continue;
      marker.style.display=p.visible?'':'none';
      marker.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    }
  }
}
