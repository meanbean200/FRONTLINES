import type { BattlefieldState, Vec2 } from '../core/types';
import { SETTLEMENTS } from '../terrain/WorldFeatures';
import type { StrategyCamera } from '../render/StrategyCamera';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {pointAlongPolyline,polylineLength} from '../core/types';
import { factionOf } from '../operations/types';
import {observedEnemySquad} from '../operations/Visibility';
import {excavatedSpan} from '../core/TrenchGeometry';
import {trenchPresence} from './GarrisonReadout';
import {fieldIcon} from './FieldSymbols';
import {FieldMap} from './FieldMap';
import {OrderOverlay} from './OrderOverlay';
import {trenchName,friendlyTrenches} from './TrenchReadout';

export class TacticalOverlay {
  private readonly layer=document.createElement('div');
  private markers=new Map<number,HTMLButtonElement>();
  private trenchMarkers=new Map<number,HTMLButtonElement>();
  private objectiveMarkers=new Map<string,HTMLDivElement>();
  private markerTimer=1/30;
  private labels: {element:HTMLElement;point:Vec2}[]=[];
  private network=new TrenchNetwork();
  private networkTimer=0;
  private presence=new Map<number,number>();
  private readonly fieldMap:FieldMap;
  private readonly orders:OrderOverlay;
  constructor(private readonly getState:()=>BattlefieldState,private readonly selected:Set<number>,private readonly camera:StrategyCamera,terrain:TerrainSystem,private readonly select:(ids:number[],add?:boolean)=>void,private readonly occupy:(id:number)=>void,move?:(point:Vec2)=>void){
    this.layer.className='tactical-overlay';document.querySelector('#app')!.append(this.layer);
    for(const settlement of SETTLEMENTS){const label=document.createElement('div');label.className='place-name';label.textContent=settlement.name;this.layer.append(label);this.labels.push({element:label,point:settlement});}
    this.fieldMap=new FieldMap(getState,terrain,camera,selected,select,move);
    this.orders=new OrderOverlay(getState,selected,camera);
  }
  update(dt:number):void {
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
    const state=this.getState(),ids=new Set(state.squads.map(s=>s.id));
    const counts=new Map<number,number>(),relocating=new Set<number>();for(const s of state.soldiers)if(s.needs?.life==='active'){counts.set(s.squadId,(counts.get(s.squadId)??0)+1);if(s.duty?.relocationExit)relocating.add(s.squadId);}
    this.networkTimer-=dt;if(this.networkTimer<=0){this.networkTimer=.5;this.network.sync(state.trenches);this.presence=trenchPresence(state,this.network);}
    for(const[id,element]of this.markers)if(!ids.has(id)){element.remove();this.markers.delete(id);}
    state.squads.forEach((squad,index)=>{
      let marker=this.markers.get(squad.id);
      if(!marker){marker=document.createElement('button');marker.className=`squad-marker ${squad.kind}`;marker.setAttribute('aria-label',`Select ${squad.name}`);marker.innerHTML=`<i>${squad.kind==='engineer'?'⚒':'×'}</i><b>${squad.kind==='engineer'?'E'+(index-19):String(index+1).padStart(2,'0')}</b><small></small>`;
        marker.addEventListener('click',e=>{const current=this.getState().squads.find(s=>s.id===squad.id);if(current&&factionOf(current)==='player')this.select([squad.id],e.shiftKey);});marker.addEventListener('dblclick',()=>{const current=this.getState().squads.find(s=>s.id===squad.id);if(current)this.camera.focus(current,110);});this.markers.set(squad.id,marker);this.layer.append(marker);}
      marker.classList.toggle('engineer',squad.kind==='engineer');marker.setAttribute('aria-label',`Select ${squad.name}`);
      const enemy=factionOf(squad)==='enemy',able=counts.get(squad.id)??0;
      const contact=enemy?observedEnemySquad(state,squad.id):undefined;
      marker.classList.toggle('last-seen',Boolean(enemy&&contact&&!contact.visible));
      marker.classList.toggle('enemy',enemy);marker.classList.toggle('depleted',enemy?Boolean(contact?.visible&&contact.able===0):able===0);marker.disabled=enemy;
      marker.title=`${squad.name} · ${able} able${enemy?' · enemy':''}`;
      if(enemy){marker.setAttribute('aria-label',contact?.visible?`Spotted enemy · ${contact.able} able`:'Last seen enemy');marker.title=contact?.visible?'Spotted enemy':'Last known position · not live tracking';}
      if(marker.dataset.kind!==squad.kind){marker.dataset.kind=squad.kind;marker.querySelector('i')!.innerHTML=fieldIcon(squad.kind);}
      marker.querySelector('b')!.textContent=squad.kind==='engineer'?'E'+(state.squads.filter(s=>s.kind==='engineer').findIndex(s=>s.id===squad.id)+1):String(index+1).padStart(2,'0');
      marker.classList.toggle('selected',this.selected.has(squad.id));marker.classList.toggle('moving',!enemy&&squad.movementState==='moving');
      const text=marker.querySelector('small')!;
      const trench=state.trenches.find(t=>t.id===squad.order.trenchId);
      const withdrawn=state.living?.garrisons.some(g=>g.cutoff==='withdraw'&&g.squadIds.includes(squad.id));
      text.textContent=enemy?(contact?.visible?`SPOTTED · ${contact.able}`:'LAST SEEN'):able===0?'OUT OF ACTION':withdrawn?'WITHDRAWAL':relocating.has(squad.id)?'RELOCATING':squad.order.type==='construct-trench'&&trench?`${Math.floor(trench.progress*100)}%`:squad.order.type==='occupy-trench'?'DEFENDING':squad.movementState==='planning'?'PLANNING':squad.movementState==='moving'?'MOVING':'';
      if(enemy&&contact&&!contact.visible){const age=Math.floor(state.elapsed-contact.lastSeen);text.textContent=`LAST REPORT · ${age}s · ±${Math.min(60,age*2)}m`;}
      if(!enemy){let tip=marker.querySelector<HTMLElement>('.marker-tip');if(!tip){tip=document.createElement('span');tip.className='marker-tip';tip.setAttribute('aria-hidden','true');marker.append(tip);}tip.textContent=`${squad.name}\n${able} / ${squad.soldierIds.length} able · ${text.textContent||'Holding'}\nClick to select · double-click to focus`;}
    });
    const trenchIds=new Set(state.trenches.map(t=>t.id));
    for(const[id,m]of this.trenchMarkers)if(!trenchIds.has(id)){m.remove();this.trenchMarkers.delete(id);}
    const inspectable=new Set(friendlyTrenches(state,this.network).map(t=>t.id));
    for(const trench of state.trenches){
      let m=this.trenchMarkers.get(trench.id);
      if(!m){m=document.createElement('button');m.className='trench-capacity';m.addEventListener('click',()=>this.occupy(trench.id));this.layer.append(m);this.trenchMarkers.set(trench.id,m);}
      const component=this.network.component(trench.id),members=state.living?.garrisons.filter(g=>this.network.component(g.trenchId)===component)??[];
      if(!inspectable.has(trench.id)){m.dataset.representative='false';m.textContent='';m.disabled=true;continue;}m.disabled=false;
      const support=state.living?.facilities.some(f=>f.connectorId===trench.id);
      m.dataset.representative=String(!support);
      const used=state.soldiers.filter(s=>s.needs?.life!=='dead'&&members.some(g=>s.garrisonId===g.id)).length,capacity=this.network.capacity(component??-1);
      const inside=this.presence.get(component??-1)??0;
      m.textContent=`${trenchName(state,trench.id)}${trench.status==='complete'?'':` · ${Math.floor(trench.progress*100)}%`}`;
      m.setAttribute('aria-label',`Inspect ${trenchName(state,trench.id)}`);
      m.title=`Click to inspect and highlight this trench. Connected network: ${inside} inside · ${used}/${capacity} assigned. Manage personnel or assign squads in the inspector.`;
    }
    const objectiveIds=new Set(state.operation?.objectives.map(o=>o.id));
    for(const[id,marker]of this.objectiveMarkers)if(!objectiveIds.has(id)){marker.remove();this.objectiveMarkers.delete(id);}
    for(const[i,o]of (state.operation?.objectives??[]).entries()){
      let marker=this.objectiveMarkers.get(o.id);if(!marker){marker=document.createElement('div');this.objectiveMarkers.set(o.id,marker);this.layer.append(marker);}
      marker.className=`objective-world-label ${state.operation?.runtime?'neutral':o.owner}`;marker.textContent=state.operation?.runtime?o.name:`${String.fromCharCode(65+i)} · ${o.name}${o.contested?' · CONTESTED':''}`;
    }
  }
  private positionMarkers():void {
    const state=this.getState();
    for(const squad of state.squads){
      const marker=this.markers.get(squad.id);if(!marker)continue;
      if(!squad.soldierIds.length){marker.style.display='none';continue;}
      const enemy=factionOf(squad)==='enemy',contact=enemy?observedEnemySquad(state,squad.id):undefined;
      if(enemy&&!contact){marker.style.display='none';continue;}
      const p=this.camera.project(contact??squad,3);marker.style.display=p.visible?'':'none';
      marker.style.transform=`translate(${p.x}px,${p.y-18}px) translate(-50%,-100%)`;
    }
    for(const trench of state.trenches){
      const marker=this.trenchMarkers.get(trench.id);if(!marker)continue;
      const support=state.living?.facilities.some(f=>f.connectorId===trench.id);
      const span=excavatedSpan(trench),p=this.camera.project(pointAlongPolyline(trench.points,(span.start+span.end)/2/Math.max(1,polylineLength(trench.points))),1);
      marker.style.display=!support&&marker.dataset.representative==='true'&&p.visible&&this.camera.zoomDistance<1600?'':'none';
      marker.style.transform=`translate(${p.x}px,${p.y+20}px) translate(-50%,0)`;
    }
    for(const label of this.labels){const p=this.camera.project(label.point,25);label.element.style.display=p.visible&&this.camera.zoomDistance>200?'':'none';label.element.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;}
    for(const objective of state.operation?.objectives??[]){
      const marker=this.objectiveMarkers.get(objective.id);if(!marker)continue;
      const p=this.camera.project(objective,9);marker.style.display=p.visible?'':'none';
      marker.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    }
  }
}
