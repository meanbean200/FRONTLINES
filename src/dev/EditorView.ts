import * as THREE from 'three';
import {WorldSession,simulationPort} from '../sessions/WorldSession';
import {emptyScenarioWorld,instantiateScenario} from '../scenarios/instantiateScenario';
import type {ScenarioPreset,ScenarioEntity} from '../scenarios/ScenarioPreset';
import {StrategyCamera} from '../render/StrategyCamera';
import {TerrainRenderer} from '../render/TerrainRenderer';
import {UnitRenderer} from '../render/UnitRenderer';
import {TrenchRenderer} from '../render/TrenchRenderer';
import {LivingRenderer} from '../render/LivingRenderer';
import {OperationRenderer} from '../render/OperationRenderer';
import {EnvironmentLighting} from '../render/EnvironmentLighting';
import {HostViewport} from '../render/HostViewport';
import {TrenchSystem,productionTrenchPath} from '../construction/TrenchSystem';
import type {Vec2} from '../core/types';

/** Editor and playtest use the production render components and simulation, with one owned session. */
export class EditorView {
 session=new WorldSession('editor-test',emptyScenarioWorld(),false);
 readonly simulation=simulationPort(()=>this.session.simulation);
 readonly renderer:THREE.WebGLRenderer;
 readonly scene=new THREE.Scene();
 readonly camera:StrategyCamera;
 readonly ground:TerrainRenderer;
 readonly units:UnitRenderer;
 readonly trenches:TrenchRenderer;
 readonly living:LivingRenderer;
 readonly combat:OperationRenderer;
 readonly lighting:EnvironmentLighting;
 readonly viewport:HostViewport;
 readonly ink=document.createElementNS('http://www.w3.org/2000/svg','svg');
 playing=false;speed=1;lost=false;
 preset?:ScenarioPreset;selected?:string;draft:Vec2[]=[];
 private last=performance.now();private accumulator=0;private lastInk=0;
 constructor(readonly canvas:HTMLCanvasElement,private status:(text:string)=>void){
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.scene.background=new THREE.Color(0xa1b1ad);this.scene.fog=new THREE.FogExp2(0xa1b1ad,.00021);
  this.camera=new StrategyCamera(canvas,this.simulation.terrain);this.ground=new TerrainRenderer(this.simulation.terrain);this.units=new UnitRenderer(this.session.state,this.simulation.terrain);this.units.spectator=true;this.trenches=new TrenchRenderer(this.session.state,this.simulation.terrain);
  this.living=new LivingRenderer(()=>this.session.state,this.simulation.terrain);this.living.spectator=true;this.combat=new OperationRenderer(()=>this.session.state,this.simulation.terrain);this.lighting=new EnvironmentLighting(this.scene,this.renderer);
  this.scene.add(this.ground.group,this.units.group,this.trenches.group,this.living.group,this.combat.group);
  this.ink.classList.add('editor-ink');document.querySelector('#app')!.append(this.ink);
  this.viewport=new HostViewport(canvas.parentElement!,()=>1.25,size=>{this.renderer.setPixelRatio(size.ratio);this.renderer.setSize(size.width,size.height,false);this.camera.resize(size.width,size.height);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.accumulator=0;status('Graphics interrupted. Author document is intact; playtest is suspended.');});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.last=performance.now();this.accumulator=0;this.renderer.shadowMap.needsUpdate=true;status('Graphics restored.');});
  document.addEventListener('visibilitychange',()=>{this.accumulator=0;this.last=performance.now();});requestAnimationFrame(this.frame);
 }
 replace(p:ScenarioPreset,play=false):void{
  let state;
  try{state=instantiateScenario(p);}catch(e){if(play)throw e;state=emptyScenarioWorld(p.seed);const t=new TrenchSystem(state);for(const entity of p.entities)if(entity.type==='trench'){const trench=t.create(entity.points);trench.progress=entity.completed?1:0;trench.status=entity.completed?'complete':'planned';trench.width=entity.width;trench.depth=entity.depth;}this.status(String(e));}
  this.session.dispose();this.session=new WorldSession('editor-test',state,play);this.preset=structuredClone(p);this.playing=play;this.accumulator=0;this.last=performance.now();this.units.replaceState(state);this.trenches.replaceState(state);this.ground.reset();this.renderer.shadowMap.needsUpdate=true;
 }
 locate(entity:ScenarioEntity):void{const p=entity.type==='trench'?entity.points[Math.floor(entity.points.length/2)]:entity;this.camera.focus(p,190);}
 private frame=(now:number):void=>{
  const dt=Math.max(0,Math.min(.1,(now-this.last)/1000));this.last=now;this.viewport.checkPixelRatio();
  if(this.lost||document.hidden){this.accumulator=0;requestAnimationFrame(this.frame);return;}
  if(this.playing){this.accumulator=Math.min(.5,this.accumulator+dt*this.speed);const start=performance.now();while(this.accumulator>=.05){this.session.step();this.accumulator-=.05;if(performance.now()-start>10)break;}}
  this.camera.update(dt);this.ground.update(this.camera.target.x,this.camera.target.z,this.camera.zoomDistance);this.units.update(new Set(),dt,this.camera.zoomDistance);this.trenches.update(this.camera.zoomDistance);this.living.update(now,false,{...this.camera.target,zoom:this.camera.zoomDistance});this.combat.update();this.combat.group.visible=this.playing;
  this.lighting.update(this.session.state.living?.campaignHours??10,this.camera.target,this.camera.zoomDistance,now);this.renderer.render(this.scene,this.camera.camera);
  if(now-this.lastInk>33){this.drawInk();this.lastInk=now;}requestAnimationFrame(this.frame);
 };
 private drawInk():void{
  this.ink.style.display=this.playing?'none':'';if(this.playing)return;const rect=this.canvas.getBoundingClientRect();
  this.ink.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);const point=(p:Vec2)=>{const s=this.camera.project(p,.5);return `${(s.x-rect.left).toFixed(1)},${(s.y-rect.top).toFixed(1)}`;};
  const escape=(s:string)=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]!));
  const rows=[...(this.preset?.entities??[])].sort((a,b)=>Number(a.id===this.selected)-Number(b.id===this.selected)).map(e=>{const selected=e.id===this.selected,color=e.type==='facility'?'#c8b984':('side'in e?e.side:e.type==='objective'?e.owner:'neutral')==='enemy'?'#bb8576':'#94b4b9';
   if(e.type==='trench')return `<g stroke="${selected?'#eee1b4':color}" fill="${color}"><polyline points="${productionTrenchPath(e.points).map(point).join(' ')}" fill="none" stroke-width="${selected?3:1.5}" ${e.completed?'':'stroke-dasharray="5 5"'}/>${selected?e.points.map((p,i)=>`<circle cx="${point(p).split(',')[0]}" cy="${point(p).split(',')[1]}" r="5"/><text x="${point(p).split(',')[0]}" y="${Number(point(p).split(',')[1])-10}" stroke="none">${i+1}</text>`).join(''):''}</g>`;
   const s=this.camera.project(e,1),x=s.x-rect.left,y=s.y-rect.top;if(!s.visible)return '';const symbol=e.type==='formation'?e.kind==='rifle'?'×':e.kind==='engineer'?'⚒':e.kind==='machinegun'?'MG':e.kind==='mortar'?'M':'+':e.type==='objective'?'⚑':e.type==='stock'?'▣':e.type==='staging'?'R':e.weapon==='field-gun'?'FG':e.weapon==='crew-mg'?'MG':e.weapon==='mortar'?'M':'⌂';
   // Dense crews and posts keep their symbols; selection reveals the complete name.
   // The inspector list always retains every name, without overlapping map text.
   const label=selected?escape(e.name)+(e.type==='formation'?' · '+e.count:''):e.type==='objective'||e.type==='staging'?escape(e.name):'';
   return `<g transform="translate(${x},${y})"><rect x="-16" y="-13" width="32" height="26" fill="#14201e" stroke="${selected?'#f0dfa6':color}" stroke-width="${selected?3:1}"/><text text-anchor="middle" y="5" fill="${color}">${symbol}</text>${label?`<text x="20" y="5" fill="#e9e7d8" paint-order="stroke" stroke="#17211c" stroke-width="3">${label}</text>`:''}</g>`;
  });
  if(this.draft.length)rows.push(`<polyline points="${this.draft.map(point).join(' ')}" fill="none" stroke="#ead6a0" stroke-width="3" stroke-dasharray="7 4"/>`);this.ink.innerHTML=rows.join('');
 }
}
