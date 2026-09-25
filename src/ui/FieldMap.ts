import type {BattlefieldState,Vec2} from '../core/types';
import {WORLD_SIZE,WORLD_HALF} from '../core/types';
import {mapCenter,mapProject,mapUnproject,ROADS,pointOnRoad} from '../terrain/WorldLayout';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {StrategyCamera} from '../render/StrategyCamera';
import {factionOf} from '../operations/types';
import {contactGroups} from './ContactReadout';
import {SETTLEMENTS} from '../terrain/WorldFeatures';
import {excavatedPoints} from '../core/TrenchGeometry';
import {blocksGameplayKey} from '../input/GameplayKeys';
import {drawOperationPlan} from './OperationalMap';
import {OPERATION_DEFINITIONS} from '../operations/OperationDefinitions';
import {placeMapLabels,type MapLabel} from './MapLabels';

/** Both map scales use the same delivered knowledge as battlefield markers. */
export function mapUnits(state:BattlefieldState){
  return [
    ...state.squads.filter(q=>q.soldierIds.length&&factionOf(q)==='player').map(q=>({id:q.id,x:q.x,z:q.z,enemy:false,reported:false,name:q.name})),
    ...contactGroups(state).map(c=>({id:c.id,x:c.x,z:c.z,enemy:true,reported:!c.visible,name:c.visible?'Confirmed contact':'Last report'})),
  ];
}

/** Cluster symbols at map scale, not people or simulation units. Known hostile
 * and friendly observations can never collapse into the same marker. */
export function mapClusters(units:ReturnType<typeof mapUnits>,project:(p:Vec2)=>{x:number;y:number}){
  const clusters:{x:number;y:number;enemy:boolean;reported:boolean;units:typeof units}[]=[];
  for(const unit of units){const p=project(unit),near=clusters.find(c=>c.enemy===unit.enemy&&c.reported===unit.reported&&Math.hypot(c.x-p.x,c.y-p.y)<24);
    if(near)near.units.push(unit);else clusters.push({...p,enemy:unit.enemy,reported:unit.reported,units:[unit]});
  }
  return clusters;
}

/** Optional planning sheet. It pauses presentation's clock, not campaign state. */
export class FieldMap {
  private readonly dialog=document.createElement('dialog');
  private readonly canvas=document.createElement('canvas');
  private readonly background=document.createElement('canvas');
  private center:Vec2={x:0,z:0};
  private span=2400;
  private timer=0;
  private seed=-1;
  private returnFocus?:HTMLElement;
  private get verticalScale(){return this.span===WORLD_SIZE?1:.625;}
  constructor(private getState:()=>BattlefieldState,private terrain:TerrainSystem,private camera:StrategyCamera,private selected:Set<number>,private select?:(ids:number[],add?:boolean)=>void,private move?:(point:Vec2)=>void){
    this.dialog.className='field-map';this.dialog.setAttribute('aria-label','Operational map');
    this.dialog.innerHTML=`<header><div><small>OPERATIONAL MAP / NORTH ↑</small><h2>SAINT-MARTIN SECTOR</h2></div><nav><button data-scale="sector">Local</button><button data-scale="theater">Full sector</button><button data-close>Return <kbd>Esc</kbd></button></nav></header><div class="map-stage"></div><footer><span class="map-friendly">⊠ Friendly</span><span class="map-enemy">◇ Confirmed / dashed last report</span><span>━ Excavated / ┄ Planned</span><span>□ Supply · amber route blocked</span></footer><p class="map-help">Select a friendly marker. Right-click to move selected squads. Click terrain to focus. M to return · play paused.</p>`;
    this.canvas.width=960;this.canvas.height=600;this.canvas.setAttribute('aria-label','Terrain, roads, settlements, trenches and known formations');
    this.dialog.querySelector('.map-stage')!.append(this.canvas);document.body.append(this.dialog);
    this.dialog.querySelector('[data-close]')!.addEventListener('click',()=>this.close());
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    for(const b of this.dialog.querySelectorAll<HTMLButtonElement>('[data-scale]'))b.addEventListener('click',()=>{this.span=b.dataset.scale==='theater'?WORLD_SIZE:2400;this.center=mapCenter(this.camera.target,this.span,this.verticalScale);this.seed=-1;this.update(1);});
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{
      const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,point=mapUnproject(x,y,this.center,this.span,this.verticalScale);
      if(e.button===2){if(this.selected.size&&this.getState().operation?.status!=='victory'&&this.getState().operation?.status!=='defeat'){this.move?.(point);this.update(1);}return;}
      if(e.button!==0)return;
      const friend=mapUnits(this.getState()).filter(u=>!u.enemy).map(u=>({u,p:mapProject(u,this.center,this.span,this.verticalScale)})).sort((a,b)=>Math.hypot((a.p.x-x)*r.width,(a.p.y-y)*r.height)-Math.hypot((b.p.x-x)*r.width,(b.p.y-y)*r.height))[0];
      if(friend&&Math.hypot((friend.p.x-x)*r.width,(friend.p.y-y)*r.height)<20){this.select?.([friend.u.id],e.shiftKey);this.update(1);return;}
      this.camera.focus(point,this.camera.zoomDistance);this.close();
    });
    document.querySelector('#map-expand')!.addEventListener('click',()=>this.open());
    window.addEventListener('keydown',e=>{
      if(this.dialog.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();return;}
      if((e.code==='KeyM'||e.code==='KeyG')&&!e.repeat&&!blocksGameplayKey(e)&&!document.documentElement.dataset.menu&&!document.documentElement.dataset.help&&!document.documentElement.dataset.replay){e.preventDefault();e.stopImmediatePropagation();if(this.dialog.open)this.close();else this.open();}
    },true);
  }
  private open(){
    if(this.dialog.open)return;
    this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
    window.dispatchEvent(new Event('frontlines-menu'));document.documentElement.dataset.fieldMap='open';
    this.center=mapCenter(this.camera.target,this.span,this.verticalScale);this.seed=-1;
    if(this.getState().operation?.runtime){this.span=WORLD_SIZE;this.center={x:0,z:0};}
    this.dialog.showModal();this.update(1);
  }
  private close(){this.dialog.close();delete document.documentElement.dataset.fieldMap;this.returnFocus?.focus({preventScroll:true});}
  update(dt:number){
    if(!this.dialog.open)return;this.timer+=dt;if(this.timer<.2)return;this.timer=0;
    const state=this.getState();if(this.seed!==state.seed){this.paintTerrain();this.seed=state.seed;}
    this.dialog.dataset.scale=this.span===WORLD_SIZE?'theater':'sector';
    if(this.canvas.height!==960*this.verticalScale)this.canvas.height=960*this.verticalScale;
    for(const b of this.dialog.querySelectorAll<HTMLButtonElement>('[data-scale]'))b.setAttribute('aria-pressed',String((b.dataset.scale==='theater')===(this.span===WORLD_SIZE)));
    const ctx=this.canvas.getContext('2d')!,w=this.canvas.width,h=this.canvas.height;ctx.drawImage(this.background,0,0,w,h);
    const screen=(p:Vec2)=>{const q=mapProject(p,this.center,this.span,this.verticalScale);return {x:q.x*w,y:q.y*h};};
    const textScale=this.canvas.width/Math.max(1,this.canvas.getBoundingClientRect().width);
    const labels:MapLabel[]=[];
    const label=(text:string,x:number,y:number,priority=1)=>{const width=ctx.measureText(text).width;labels.push({text,x:x+(ctx.textAlign==='left'?width/2:0),y,width,height:14*textScale,priority,font:ctx.font,color:String(ctx.fillStyle)});};
    const operation=state.operation?.runtime;
    this.dialog.querySelector('h2')!.textContent=operation?`${OPERATION_DEFINITIONS[operation.definitionId].title.toUpperCase()} / SECTOR ${state.seed}`:'FIELD OPERATIONS';
    if(operation)drawOperationPlan(ctx,operation,screen,true,true,textScale,label);
    const line=(points:Vec2[],color:string,width:number,dash:number[]=[])=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>{const v=screen(p);if(i)ctx.lineTo(v.x,v.y);else ctx.moveTo(v.x,v.y);});ctx.stroke();ctx.setLineDash([]);};
    ctx.strokeStyle='#c0c6b51b';ctx.lineWidth=1;ctx.font=`${12*textScale}px Bahnschrift`;ctx.fillStyle='#b5bfab';
    for(let i=0;i<8;i++){const x=i*w/8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.fillText(String.fromCharCode(65+i),x+8,16);}
    for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(0,i*h/5);ctx.lineTo(w,i*h/5);ctx.stroke();ctx.fillText(String(i),8,i*h/5+16);}
    for(const t of state.trenches){line(t.points,'#8b7655',2,[4,4]);line(excavatedPoints(t),'#d1b18d',3);}
    const logistics=state.living;
    if(logistics){
      const supplyMark=(point:Vec2,text:string,warning=false)=>{const p=screen(point);ctx.fillStyle='#172322';ctx.strokeStyle=warning?'#d8ad77':'#bcc8c4';ctx.lineWidth=1.5;ctx.fillRect(p.x-5,p.y-5,10,10);ctx.strokeRect(p.x-5,p.y-5,10,10);ctx.fillStyle=ctx.strokeStyle;ctx.font=`${13*textScale}px Bahnschrift`;ctx.textAlign='left';label(text,p.x+9,p.y-12*textScale,warning?4:0);};
      supplyMark(logistics.rear,'Rear depot');
      for(const g of logistics.garrisons.filter(g=>g.faction!=='enemy'))supplyMark(g.forward,'Supply',g.cutoff!=='clear');
      for(const t of logistics.trucks.filter(t=>t.faction!=='enemy')){if(t.route.length>1)line(t.route,t.state==='blocked'?'#e0b378':'#a9b5a1',2,[6,5]);supplyMark(t,t.state==='blocked'?'Blocked truck':'Truck',t.state==='blocked');}
    }
    for(const q of state.squads)if(this.selected.has(q.id)&&factionOf(q)==='player'){
      const route=q.order.drawnPath??[q,...q.route.slice(q.routeIndex)];if(route.length>1)line(route,'#bed2dc',1.5,[7,3]);
    }
    for(const place of SETTLEMENTS){const p=screen(place);ctx.font=`600 ${14*textScale}px Bahnschrift`;ctx.fillStyle='#e0e7d2';ctx.textAlign='center';label(place.name,p.x,p.y-18,2);}
    for(const [i,o] of (state.operation?.objectives??[]).entries()){
      const p=screen(o),color=operation?'#ded1a3':o.owner==='player'?'#bacfd9':o.owner==='enemy'?'#d49889':'#ded1a3';ctx.fillStyle='#1c2b26';ctx.fillRect(p.x-10,p.y-11,20,22);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.strokeRect(p.x-10,p.y-11,20,22);ctx.fillStyle=color;ctx.textAlign='center';ctx.font=`600 ${16*textScale}px Bahnschrift`;ctx.fillText(operation?'◇':String.fromCharCode(65+i),p.x,p.y+5);
      if(operation&&o.id.endsWith('-rear')){ctx.font=`${12*textScale}px Bahnschrift`;label(o.name,p.x,p.y+25,2);}
    }
    for(const q of mapClusters(mapUnits(state),screen)){
      const p=q,chosen=q.units.find(u=>this.selected.has(u.id));ctx.strokeStyle=q.enemy?'#d8a097':'#bed1da';ctx.fillStyle=chosen?'#e6d6ad':'#1d3028';ctx.lineWidth=chosen?2:1.5;ctx.setLineDash(q.reported?[3,3]:[]);
      if(q.enemy){ctx.beginPath();ctx.moveTo(p.x,p.y-8);ctx.lineTo(p.x+9,p.y);ctx.lineTo(p.x,p.y+8);ctx.lineTo(p.x-9,p.y);ctx.closePath();ctx.fill();ctx.stroke();}
      else{ctx.fillRect(p.x-8,p.y-5,16,10);ctx.strokeRect(p.x-8,p.y-5,16,10);ctx.beginPath();ctx.moveTo(p.x-7,p.y-4);ctx.lineTo(p.x+7,p.y+4);ctx.moveTo(p.x+7,p.y-4);ctx.lineTo(p.x-7,p.y+4);ctx.stroke();}ctx.setLineDash([]);
      if(!q.enemy&&(chosen||q.units.length>1)){ctx.font=`${12*textScale}px Bahnschrift`;ctx.fillStyle='#dbe7e6';ctx.textAlign='left';const name=q.units.length>1?`${q.units.length} squads${chosen?' / '+chosen.name:''}`:chosen!.name;label(name,p.x+15,p.y+4,chosen?5:3);}
    }
    const p=screen(this.camera.target);ctx.strokeStyle='#e8e2cb';ctx.lineWidth=3;ctx.strokeRect(p.x-10,p.y-10,20,20);ctx.strokeStyle='#374c3c';ctx.lineWidth=1;ctx.strokeRect(p.x-10,p.y-10,20,20);
    for(const t of placeMapLabels(labels,w,h,4*textScale)){ctx.font=t.font;ctx.textAlign='left';ctx.fillStyle='#102019c9';ctx.fillRect(t.left-2,t.top-1,t.width+4,t.height+3);ctx.fillStyle=t.color;ctx.fillText(t.text,t.left,t.top+t.height-2);}
    ctx.fillStyle='#cbd4c2';ctx.textAlign='left';ctx.font=`${12*textScale}px Bahnschrift`;ctx.fillText(`${this.span/8} m`,32,h-24);ctx.fillRect(32,h-17,w/8,2);ctx.fillRect(32,h-21,1,6);ctx.fillRect(32+w/8,h-21,1,6);
  }
  private paintTerrain(){
    const w=480,h=480*this.verticalScale;this.background.width=w;this.background.height=h;
    const ctx=this.background.getContext('2d')!,image=ctx.createImageData(w,h),bands=new Int16Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const wx=this.center.x+(x/w-.5)*this.span,wz=this.center.z+(y/h-.5)*this.span*this.verticalScale;
      const type=this.terrain.groundTypeAt(wx,wz),height=this.terrain.baseHeightAt(wx,wz),i=y*w+x;bands[i]=Math.floor(height/12);
      const colors=type==='river'?[66,89,95]:type==='road'?[127,137,115]:type==='settlement'?[81,85,71]:type==='forest'?[44,65,49]:[62,80,59];
      const contour=(x>0&&bands[i]!==bands[i-1]||y>0&&bands[i]!==bands[i-w])&&type!=='river'&&type!=='road';
      for(let k=0;k<3;k++)image.data[i*4+k]=colors[k]+(contour?12:0);image.data[i*4+3]=255;
    }
    ctx.putImageData(image,0,0);
    ctx.strokeStyle='#929989';ctx.lineWidth=1.2;
    for(const road of ROADS){ctx.beginPath();for(let t=-WORLD_HALF;t<=WORLD_HALF;t+=20){const p=mapProject(pointOnRoad(road,t),this.center,this.span,this.verticalScale);if(t===-WORLD_HALF)ctx.moveTo(p.x*w,p.y*h);else ctx.lineTo(p.x*w,p.y*h);}ctx.stroke();}
  }
}
