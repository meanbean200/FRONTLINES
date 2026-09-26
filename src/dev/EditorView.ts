import * as THREE from 'three';
import {WorldSession} from '../sessions/WorldSession';
import {instantiateScenario,scenarioDiagnostics} from '../scenarios/instantiateScenario';
import type {ScenarioPreset,ScenarioEntity} from '../scenarios/ScenarioPreset';
import {StrategyCamera} from '../render/StrategyCamera';
import {TerrainRenderer} from '../render/TerrainRenderer';
import {UnitRenderer} from '../render/UnitRenderer';
import {TrenchRenderer} from '../render/TrenchRenderer';
import {LivingRenderer} from '../render/LivingRenderer';
import {OperationRenderer} from '../render/OperationRenderer';
import {EnvironmentLighting} from '../render/EnvironmentLighting';
import {HostViewport} from '../render/HostViewport';
import type {Vec2} from '../core/types';
import {AuthoringWorld} from './AuthoringWorld';
import {EditorInk} from './EditorInk';

/** One render host, lightweight edit geometry; production sessions exist only during Play Test. */
export class EditorView {
 readonly author=new AuthoringWorld();
 session?:WorldSession;
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
 readonly overlay=new EditorInk();
 readonly ink=this.overlay.element;
 speed=1;lost=false;
 preset?:ScenarioPreset;selected?:string;draft:Vec2[]=[];preview?:ScenarioEntity;
 private last=performance.now();private accumulator=0;
 readonly frames:number[]=[];
 get playing():boolean{return Boolean(this.session);}
 get state(){return this.session?.state??this.author.state;}
 get terrain(){return this.session?.simulation.terrain??this.author.terrain;}
 constructor(readonly canvas:HTMLCanvasElement,status:(text:string)=>void){
  const terrain=new Proxy(this.author.terrain,{get:(_,key)=>{const current=this.terrain,value=Reflect.get(current,key);return typeof value==='function'?value.bind(current):value;}});
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.scene.background=new THREE.Color(0xa1b1ad);this.scene.fog=new THREE.FogExp2(0xa1b1ad,.00021);
  this.camera=new StrategyCamera(canvas,terrain);this.ground=new TerrainRenderer(terrain);this.units=new UnitRenderer(this.state,terrain);this.units.spectator=true;this.trenches=new TrenchRenderer(this.state,terrain);
  this.living=new LivingRenderer(()=>this.state,terrain);this.living.spectator=true;this.combat=new OperationRenderer(()=>this.state,terrain);this.lighting=new EnvironmentLighting(this.scene,this.renderer);
  this.scene.add(this.ground.group,this.units.group,this.trenches.group,this.living.group,this.combat.group);
  document.querySelector('#app')!.append(this.ink);
  this.viewport=new HostViewport(canvas.parentElement!,()=>1.25,size=>{this.renderer.setPixelRatio(size.ratio);this.renderer.setSize(size.width,size.height,false);this.camera.resize(size.width,size.height);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.accumulator=0;status('Graphics interrupted. Author document is intact; playtest is suspended.');});
  canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.last=performance.now();this.accumulator=0;this.renderer.shadowMap.needsUpdate=true;status('Graphics restored.');});
  document.addEventListener('visibilitychange',()=>{this.accumulator=0;this.last=performance.now();});requestAnimationFrame(this.frame);
 }
 replace(p:ScenarioPreset,play=false):void{
  // Construct before disposing: a rejected test never destroys the usable authoring view.
  const next=play?instantiateScenario(p):undefined;
  const wasPlaying=this.playing;
  if(play&&!wasPlaying)this.speed=1;
  this.session?.dispose();this.session=next?new WorldSession('editor-test',next,true):undefined;this.preset=p;this.preview=undefined;this.overlay.invalid.clear();
  const seedChanged=this.author.sync(p);
  this.accumulator=0;this.last=performance.now();
  if(play||wasPlaying){this.units.replaceState(this.state);this.trenches.replaceState(this.state);this.ground.reset();}
  else if(seedChanged)this.ground.reset();
  this.ink.style.display=play?'none':'';this.renderer.shadowMap.needsUpdate=true;
 }
 locate(entity:ScenarioEntity):void{const p=entity.type==='trench'?entity.points[Math.floor(entity.points.length/2)]:entity;this.camera.focus(p,190);}
 diagnostics(){return {scenarioInstantiations:scenarioDiagnostics.instantiations,terrainResets:this.ground.resetCount,overlay:{...this.overlay.stats},ownership:{...WorldSession.ownership}};}
 private frame=(now:number):void=>{
  const elapsed=now-this.last,dt=Math.max(0,Math.min(.1,elapsed/1000));this.last=now;this.viewport.checkPixelRatio();
  if(this.lost||document.hidden){this.accumulator=0;requestAnimationFrame(this.frame);return;}
  this.frames.push(elapsed);if(this.frames.length>600)this.frames.shift();
  if(this.session){this.accumulator=Math.min(.5,this.accumulator+dt*this.speed);const start=performance.now();while(this.accumulator>=.05){this.session.step();this.accumulator-=.05;if(performance.now()-start>10)break;}}
  this.camera.update(dt);this.ground.update(this.camera.target.x,this.camera.target.z,this.camera.zoomDistance);this.trenches.update(this.camera.zoomDistance);
  this.units.group.visible=this.living.group.visible=this.combat.group.visible=this.playing;
  if(this.playing){this.units.update(new Set(),dt,this.camera.zoomDistance);this.living.update(now,false,{...this.camera.target,zoom:this.camera.zoomDistance});this.combat.update();}
  this.lighting.update(this.state.living?.campaignHours??this.preset?.hour??10,this.camera.target,this.camera.zoomDistance,now);this.renderer.render(this.scene,this.camera.camera);
  if(!this.playing)this.overlay.draw(this.preset,this.selected,this.preview,this.draft,this.camera,this.canvas.getBoundingClientRect());
  requestAnimationFrame(this.frame);
 };
}
