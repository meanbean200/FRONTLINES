// Development-only art inspection and matched render-layer benchmark; no campaign IO.
import * as THREE from 'three';
import {loadSoldierAsset} from '../src/render/SoldierAsset';
import {UnitRenderer} from '../src/render/UnitRenderer';
import {createBattlefield} from '../src/simulation/createBattlefield';
import type {TerrainSystem} from '../src/terrain/TerrainSystem';

const asset=await loadSoldierAsset(),state=createBattlefield(),template=structuredClone(state.soldiers[0]);
state.trenches=[];state.craters=[];state.squads=state.squads.slice(0,2);state.squads[1].faction='enemy';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x22291f);scene.fog=new THREE.Fog(0x22291f,65,200);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.01,300);let turned=false;
const sky=new THREE.HemisphereLight(0xdce2d4,0x6a644e,2);scene.add(sky);
const sun=new THREE.DirectionalLight(0xffecd0,2.3);sun.position.set(5,12,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.normalBias=.02;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x4c5540,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
const terrain={heightAt:()=>0} as unknown as TerrainSystem;
const model=new UnitRenderer(state,terrain,asset),original=new UnitRenderer(state,terrain,null,null);scene.add(model.group,original.group);
let useOriginal=false,playing=true,last=performance.now(),labels:{el:HTMLElement;x:number;z:number}[]=[];
const rows=[['READY','holding','standing','active'],['WALK','walking','standing','active'],['AIM','watching','standing','active'],['DIG','digging','standing','active'],['FIELD REST','resting','crouched','active'],['EAT / DRINK','eating','crouched','active'],['CROUCH','holding','crouched','active'],['TREAT','treating','crouched','active'],['CARRY','carrying casualty','standing','active'],['PRONE','holding','prone','active'],['SLEEP','sleeping','prone','active'],['DEAD','holding','prone','dead']] as const;
function setCount(count:number){
  labels.forEach(l=>l.el.remove());labels=[];const columns=count===12?6:Math.ceil(Math.sqrt(count));
  state.soldiers=Array.from({length:count},(_,i)=>{
    const row=rows[i%rows.length],s=structuredClone(template);s.id=i+1;s.squadId=state.squads[i%2].id;s.x=(i%columns-(columns-1)/2)*2.25;s.z=(Math.floor(i/columns)-(Math.ceil(count/columns)-1)/2)*3.2;s.heading=-.18;
    s.action=row[1];s.posture=row[2];s.needs={energy:80,hunger:20,thirst:20,life:row[3],hungryHours:0,thirstyHours:0,sleepHours:0,day:0,watchHours:0,interruptedSleep:0,taskChanges:0};if(row[0]==='AIM')s.aimTargetId=999;
    if(count===12){const el=document.createElement('div');el.className='pose-label';el.textContent=row[0];document.body.append(el);labels.push({el,x:s.x,z:s.z+1});}return s;
  });model.replaceState(state);original.replaceState(state);positionCamera();
}
function positionCamera(){const wide=state.soldiers.length>12,span=wide?Math.ceil(Math.sqrt(state.soldiers.length))*2.25:16;camera.position.set(turned?span*.58:0,wide?span*.9:6,wide?span*1.2:20);camera.lookAt(0,.7,0);}
function setBaseline(value:boolean){useOriginal=value;document.querySelector('#baseline')!.textContent=value?'Use supplied soldier':'Compare original soldiers';}
document.querySelector('#pause')!.addEventListener('click',()=>{playing=!playing;document.querySelector('#pause')!.textContent=playing?'Pause':'Play';});
document.querySelector('#baseline')!.addEventListener('click',()=>setBaseline(!useOriginal));
document.querySelector('#turn')!.addEventListener('click',()=>{turned=!turned;positionCamera();});
document.querySelector('#count')!.addEventListener('change',e=>setCount(Number((e.target as HTMLSelectElement).value)));
let samples:{frame:number;units:number;render:number}[]=[],measureUntil=0;
function frame(now:number){
  const interval=now-last,dt=Math.min(.05,interval/1000);last=now;if(playing)state.elapsed+=dt;
  const start=performance.now(),active=useOriginal?original:model;active.update(new Set(),dt,20);original.group.visible=useOriginal;model.group.visible=!useOriginal;const units=performance.now()-start;
  const renderStart=performance.now();renderer.render(scene,camera);const render=performance.now()-renderStart;
  if(now<measureUntil)samples.push({frame:interval,units,render});
  labels.forEach(({el,x,z})=>{const p=new THREE.Vector3(x,0,z).project(camera);el.style.left=(p.x*.5+.5)*innerWidth+'px';el.style.top=(-p.y*.5+.5)*innerHeight+'px';});
  document.querySelector('#status')!.textContent=`${useOriginal?'ORIGINAL':'SUPPLIED MODEL'} · ${state.soldiers.length} personnel · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} rendered triangles · asset gallery, not a full simulation performance result`;
  requestAnimationFrame(frame);
}
setCount(12);requestAnimationFrame(frame);
onresize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
Object.assign(window,{soldierPreview:{asset,setCount,setBaseline,setTime:(t:number)=>{state.elapsed=t;playing=false;},renderer,state,
  measure:async(ms=6000)=>{samples=[];measureUntil=performance.now()+ms;await new Promise(resolve=>setTimeout(resolve,ms+100));const q=(k:keyof typeof samples[number],p:number)=>{const a=samples.map(s=>s[k]).sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*p))];};return {count:state.soldiers.length,original:useOriginal,frames:samples.length,frameP95:q('frame',.95),unitsP95:q('units',.95),renderSubmitP95:q('render',.95),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};}}});
