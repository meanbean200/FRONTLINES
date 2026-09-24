import type { BattlefieldState, Vec2 } from '../core/types';
import {WORLD_SIZE,WORLD_HALF} from '../core/types';
import {mapCenter,mapProject,mapUnproject,ROADS,pointOnRoad} from '../terrain/WorldLayout';
import { SETTLEMENTS } from '../terrain/WorldFeatures';
import type { StrategyCamera } from '../render/StrategyCamera';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {pointAlongPolyline,polylineLength} from '../core/types';
import { factionOf } from '../operations/types';
import {observedEnemySquad} from '../operations/Visibility';
import {drawOperationPlan} from './OperationalMap';
import {excavatedSpan} from '../core/TrenchGeometry';
import {trenchPresence} from './GarrisonReadout';
import {fieldIcon} from './FieldSymbols';
import {FieldMap} from './FieldMap';
import {OrderOverlay} from './OrderOverlay';

export class TacticalOverlay {
  private readonly layer=document.createElement('div');
  private markers=new Map<number,HTMLButtonElement>();
  private trenchMarkers=new Map<number,HTMLButtonElement>();
  private objectiveMarkers=new Map<string,HTMLDivElement>();
  private markerTimer=1/30;
  private labels: {element:HTMLElement;point:Vec2}[]=[];
  private readonly mini:HTMLCanvasElement;
  private mapBackground=document.createElement('canvas');
  private mapSeed=-1;
  private mapTimer=0;
  private readonly center={x:-1150,z:-1250};
  private span=1800;
  private overview=false;
  private network=new TrenchNetwork();
  private networkTimer=0;
  private presence=new Map<number,number>();
  private readonly fieldMap:FieldMap;
  private readonly orders:OrderOverlay;
  constructor(private readonly getState:()=>BattlefieldState,private readonly selected:Set<number>,private readonly camera:StrategyCamera,private readonly terrain:TerrainSystem,private readonly select:(ids:number[],add?:boolean)=>void,private readonly occupy:(id:number)=>void){
    this.layer.className='tactical-overlay';document.querySelector('#app')!.append(this.layer);
    for(const settlement of SETTLEMENTS){const label=document.createElement('div');label.className='place-name';label.textContent=settlement.name;this.layer.append(label);this.labels.push({element:label,point:settlement});}
    this.mini=document.querySelector<HTMLCanvasElement>('#minimap')!;
    this.mini.width=240;this.mini.height=180;
    Object.assign(this.center,mapCenter(this.camera.target,this.span));
    this.mini.addEventListener('pointerdown',e=>{const rect=this.mini.getBoundingClientRect();this.camera.focus(mapUnproject((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height,this.center,this.span));});
    document.querySelector('#map-overview')!.addEventListener('click',()=>{this.overview=!this.overview;this.span=this.overview?WORLD_SIZE:1800;Object.assign(this.center,mapCenter(this.camera.target,this.span));this.mapSeed=-1;});
    this.fieldMap=new FieldMap(getState,terrain,camera,selected);
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
    this.mapTimer+=dt;if(this.mapTimer<.15)return;this.mapTimer=0;
    const state=this.getState();
    if(!this.overview){const next=mapCenter(this.camera.target,this.span);if(Math.hypot(next.x-this.center.x,next.z-this.center.z)>this.span*.25){Object.assign(this.center,next);this.mapSeed=-1;}}
    if(this.mapSeed!==state.seed){this.paintBackground();this.mapSeed=state.seed;}
    this.paintMap();
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
    const represented=new Set<number>();
    for(const trench of state.trenches){
      let m=this.trenchMarkers.get(trench.id);
      if(!m){m=document.createElement('button');m.className='trench-capacity';m.addEventListener('click',()=>this.occupy(trench.id));this.layer.append(m);this.trenchMarkers.set(trench.id,m);}
      const component=this.network.component(trench.id),members=state.living?.garrisons.filter(g=>this.network.component(g.trenchId)===component)??[];
      if(members.some(g=>g.faction==='enemy')){m.dataset.representative='false';m.textContent='';m.disabled=true;continue;}m.disabled=false;
      const support=state.living?.facilities.some(f=>f.connectorId===trench.id);
      m.dataset.representative=String(component!==undefined&&!support&&!represented.has(component));
      if(component!==undefined&&!support)represented.add(component);
      const used=state.soldiers.filter(s=>s.needs?.life!=='dead'&&members.some(g=>s.garrisonId===g.id)).length,capacity=this.network.capacity(component??-1);
      const inside=this.presence.get(component??-1)??0;
      m.textContent=`⌁ ${inside} inside · ${used}/${capacity} assigned${trench.status==='complete'?'':` · ${Math.floor(trench.progress*100)}%`}`;
      m.title=`${inside} friendly personnel physically in trench cover, including engineers and incapacitated troops. ${used} assigned to live here / ${capacity} capacity; some may still be approaching or carrying supplies. Select a squad and click to defend here: nearby entry, watch shifts, rest and supplies.`;
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
  private paintBackground():void {
    const width=240,height=180;this.mapBackground.width=width;this.mapBackground.height=height;
    const ctx=this.mapBackground.getContext('2d')!,image=ctx.createImageData(width,height);
    for(let j=0;j<height;j++)for(let i=0;i<width;i++) {
      const x=this.center.x+(i/width-.5)*this.span,z=this.center.z+(j/height-.5)*this.span;
      const ground=this.terrain.groundTypeAt(x,z),h=this.terrain.baseHeightAt(x,z),shade=1+(h-this.terrain.baseHeightAt(x+10,z+10))*.025;
      const color=ground==='river'?[143,166,167]:ground==='road'?[225,216,181]:ground==='settlement'?[173,161,133]:ground==='forest'?[168,179,141]:[208,197,164];
      const k=(j*width+i)*4;image.data[k]=color[0]*shade;image.data[k+1]=color[1]*shade;image.data[k+2]=color[2]*shade;image.data[k+3]=255;
    }
    ctx.putImageData(image,0,0);
    ctx.strokeStyle='#ebe1bc';ctx.lineWidth=1;
    for(const road of ROADS){ctx.beginPath();for(let t=-WORLD_HALF;t<=WORLD_HALF;t+=20){const p=mapProject(pointOnRoad(road,t),this.center,this.span);if(t===-WORLD_HALF)ctx.moveTo(p.x*width,p.y*height);else ctx.lineTo(p.x*width,p.y*height);}ctx.stroke();}
  }
  private paintMap():void {
    const ctx=this.mini.getContext('2d')!,w=240,h=180,state=this.getState();ctx.drawImage(this.mapBackground,0,0);
    const screen=(p:Vec2)=>{const q=mapProject(p,this.center,this.span);return {x:q.x*w,y:q.y*h};};
    if(state.operation?.runtime)drawOperationPlan(ctx,state.operation.runtime,screen);
    ctx.strokeStyle='rgba(226,221,191,.12)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*w/4,0);ctx.lineTo(i*w/4,h);ctx.moveTo(0,i*h/4);ctx.lineTo(w,i*h/4);ctx.stroke();}
    for(const trench of state.trenches){ctx.strokeStyle='#443328';ctx.lineWidth=2;ctx.beginPath();trench.points.forEach((p,i)=>{const q=screen(p);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});ctx.stroke();}
    for(const squad of state.squads){const enemy=factionOf(squad)==='enemy',contact=enemy?observedEnemySquad(state,squad.id):undefined;if(enemy&&!contact)continue;const p=screen(contact??squad);ctx.fillStyle=enemy?'#873e35':this.selected.has(squad.id)?'#fff9df':'#415c6a';ctx.fillRect(p.x-2,p.y-2,4,4);}
    for(const [i,o]of (state.operation?.objectives??[]).entries()){const p=screen(o);ctx.strokeStyle=state.operation?.runtime?'#665d38':o.owner==='player'?'#415c6a':o.owner==='enemy'?'#873e35':'#665d38';ctx.lineWidth=1.5;ctx.strokeRect(p.x-5,p.y-5,10,10);ctx.fillStyle=ctx.strokeStyle;ctx.font='10px monospace';if(!state.operation?.runtime)ctx.fillText(String.fromCharCode(65+i),p.x+7,p.y+3);}
    const p=screen(this.camera.target);const r=this.camera.zoomDistance/this.span*60;
    ctx.strokeStyle='#e2d7ad';ctx.lineWidth=1;ctx.strokeRect(p.x-r,p.y-r*.7,r*2,r*1.4);
    const title=document.querySelector('#map-scale');if(title)title.textContent=this.overview?`${WORLD_SIZE/1000} KM · THEATER`:'1.8 KM · SECTOR';
  }
}
