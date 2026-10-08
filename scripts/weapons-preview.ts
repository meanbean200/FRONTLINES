// Isolated art fixture. Uses production loaders/renderer; never reads/writes saves.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadWeaponAssets} from '../src/render/WeaponAssets';
import {loadSoldierAsset} from '../src/render/SoldierAsset';
import {UnitRenderer} from '../src/render/UnitRenderer';
import {LivingRenderer} from '../src/render/LivingRenderer';
import {createOperation} from '../src/operations/createOperation';
import {inventory} from '../src/garrison/types';
import type {TerrainSystem} from '../src/terrain/TerrainSystem';
import type {Facility} from '../src/garrison/types';
import {initializeEquipment} from '../src/combat/Equipment';
import {weaponCrewPoint} from '../src/construction/PositionDefinitions';

const [assets,soldier]=await Promise.all([loadWeaponAssets(),loadSoldierAsset()]);
const state=createOperation('campaign');initializeEquipment(state);const original=structuredClone(state.soldiers[0]);
state.trenches=[];state.craters=[];state.operation!.shotEvents=[];state.operation!.contacts={player:[],enemy:[]};state.elapsed=0;
state.squads=state.squads.slice(0,1);state.squads[0].faction='player';state.soldiers=[];
const labels:{el:HTMLDivElement;p:THREE.Vector3}[]=[];
function label(text:string,x:number,z:number,y=0){const el=document.createElement('div');el.className='label';el.textContent=text;document.body.append(el);labels.push({el,p:new THREE.Vector3(x,y,z)});}
for(let i=0;i<9;i++){
  const prone=i===8,s=structuredClone(original);s.id=i+1;s.squadId=state.squads[0].id;s.x=prone?2:-8+i%4*2;s.z=i<4||prone?3:0;s.heading=.1;s.action='holding';s.garrisonId=undefined;s.duty=undefined;s.personalArea=undefined;s.cover='open';s.trenchId=undefined;
  s.needs!.life='active';s.equipment!.weapon=prone?'bar':(['m1','mg42','smg','bar'] as const)[i%4];s.combat={shotSequence:0};
  if(i>=4){s.action='watching';s.aimTargetId=999;s.combat.aim={point:{x:s.x,y:prone?.40:1.52,z:103},targetId:999,since:0,lastSeen:0,lastHeading:0,lastPosition:{x:s.x,z:s.z},settlingUntil:0};}
  if(prone)s.posture='prone';
  state.soldiers.push(s);label(prone?'BAR · PRONE':['RIFLE','MACHINE GUN','SMG','BAR'][i%4],s.x,s.z,prone?1.1:2.1);
}
const gun={id:991,garrisonId:1,kind:'mortar',x:3,z:-1,progress:1,facing:.3,stock:inventory(),artillery:{},installation:{kind:'field-gun'},weaponCrewIds:[]} as unknown as Facility;
const mount={id:992,garrisonId:1,kind:'emplacement',x:8,z:2,progress:1,facing:0,stock:inventory(),installation:{kind:'crew-mg'},weaponCrewIds:[10]} as unknown as Facility;
const operator=structuredClone(original),crewPoint=weaponCrewPoint(state,mount,0);Object.assign(operator,{id:10,squadId:state.squads[0].id,x:crewPoint.x,z:crewPoint.z,heading:0,action:'watching',aimTargetId:999,cover:'open',trenchId:undefined,garrisonId:1,personalArea:undefined});operator.needs!.life='active';operator.equipment!.weapon='mg42';operator.combat={shotSequence:0};operator.duty={kind:'watch',facilityId:mount.id,arrivedAt:0} as typeof operator.duty;state.soldiers.push(operator);
state.living!.facilities=[gun,mount];state.living!.trucks=[];state.living!.crates=[];state.living!.garrisons=[];
const digger=structuredClone(original);Object.assign(digger,{id:11,squadId:state.squads[0].id,x:12,z:-3,heading:.1,action:'digging',posture:'standing',garrisonId:undefined,duty:undefined,personalArea:undefined,trenchId:undefined,cover:'open',aimTargetId:undefined});digger.needs!.life='active';digger.combat={shotSequence:0};state.soldiers.push(digger);
const terrain={heightAt:()=>0,baseHeightAt:()=>0} as unknown as TerrainSystem;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x232a21);
scene.add(new THREE.HemisphereLight(0xe0e2ce,0x625947,2));const sun=new THREE.DirectionalLight(0xffe8c5,2.5);sun.position.set(6,14,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15});sun.shadow.normalBias=.015;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:0x515d43,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.receiveShadow=true;scene.add(floor);
const units=new UnitRenderer(state,terrain,soldier,assets),living=new LivingRenderer(()=>state,terrain,assets);units.spectator=living.spectator=true;scene.add(units.group,living.group);
const smgModel=new THREE.Mesh(assets.submachinegun,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}));smgModel.position.y=1;smgModel.visible=false;smgModel.castShadow=true;scene.add(smgModel);
const barModel=new THREE.Mesh(assets.automaticRifle,smgModel.material);barModel.position.y=1;barModel.visible=false;barModel.castShadow=true;scene.add(barModel);
const shovelModel=new THREE.Mesh(assets.shovel,smgModel.material);shovelModel.position.y=1;shovelModel.visible=false;shovelModel.castShadow=true;scene.add(shovelModel);
function showFormation(){smgModel.visible=barModel.visible=shovelModel.visible=false;}
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.02,200);camera.position.set(10,9,17);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.6,1);controls.update();
label('FIELD ARTILLERY',3,4.5);let playing=true,far=false,other=false,last=performance.now();
document.querySelector('#pause')!.addEventListener('click',()=>{playing=!playing;document.querySelector('#pause')!.textContent=playing?'Pause':'Play';});
document.querySelector('#fire')!.addEventListener('click',()=>{playing=true;state.operation!.supportMissions=[{id:1001,squadId:state.squads[0].id,positionId:gun.id,weapon:'field-gun',kind:'mortarHE',target:{x:gun.x+Math.sin(.3)*(far?1800:250),z:gun.z+Math.cos(.3)*(far?1800:250)},impact:{x:0,z:0},requestedAt:state.elapsed,launchAt:state.elapsed,impactAt:state.elapsed+4,stage:'flight',reason:'Art animation sample only',dangerRadius:0,confirmedRisk:false,ammoConsumed:1}];});
document.querySelector('#aim')!.addEventListener('click',()=>{far=!far;const m=state.operation!.supportMissions?.[0];if(m){m.target={x:gun.x+Math.sin(.3)*(far?1800:250),z:gun.z+Math.cos(.3)*(far?1800:250)};}});
document.querySelector('#turn')!.addEventListener('click',()=>{showFormation();other=!other;camera.position.set(other?-10:10,7,other?-14:17);controls.target.set(0,.6,1);controls.update();});
document.querySelector('#close')!.addEventListener('click',()=>{showFormation();camera.position.set(-4,3.8,11);controls.target.set(-5.1,.95,3.1);controls.update();});
document.querySelector('#gun')!.addEventListener('click',()=>{showFormation();camera.position.set(11,4,3);controls.target.set(3,.9,-1);controls.update();});
document.querySelector('#smg')!.addEventListener('click',()=>{showFormation();camera.position.set(1.5,2.3,1.5);controls.target.set(-4,1,1.5);controls.update();});
document.querySelector('#smg-model')!.addEventListener('click',()=>{showFormation();smgModel.visible=true;camera.position.set(1.25,1.6,1);controls.target.set(0,1,-.1);controls.update();});
document.querySelector('#bar')!.addEventListener('click',()=>{showFormation();camera.position.set(3.5,2.3,1.5);controls.target.set(-2,1,1.5);controls.update();});
document.querySelector('#bar-prone')!.addEventListener('click',()=>{showFormation();camera.position.set(4.4,1.1,4.2);controls.target.set(2,.4,3.3);controls.update();});
document.querySelector('#bar-model')!.addEventListener('click',()=>{showFormation();barModel.visible=true;camera.position.set(1.8,1.65,1.2);controls.target.set(0,1,0);controls.update();});
document.querySelector('#bar-bipod')!.addEventListener('click',()=>{barModel.geometry=barModel.geometry===assets.automaticRifle?assets.automaticRifleDeployed:assets.automaticRifle;showFormation();barModel.visible=true;camera.position.set(1.8,1.65,1.2);controls.target.set(0,1,0);controls.update();});
function showMount(){showFormation();camera.position.set(11.5,2.8,4.9);controls.target.set(8.7,.85,1.8);controls.update();}
document.querySelector('#mount')!.addEventListener('click',showMount);
let mountYaw=0,mountRaised=false;
document.querySelector('#mount-turn')!.addEventListener('click',()=>{mountYaw=mountYaw===0?.65:0;mount.traverse={yaw:mountYaw} as typeof mount.traverse;operator.heading=mountYaw;showMount();});
document.querySelector('#mount-aim')!.addEventListener('click',()=>{mountRaised=!mountRaised;operator.combat!.aim={point:{x:8.7+Math.sin(mountYaw)*30,y:mountRaised?10:1.48,z:1.8+Math.cos(mountYaw)*30},targetId:999,since:0,lastSeen:0,lastHeading:0,lastPosition:{x:operator.x,z:operator.z},settlingUntil:0};showMount();});
document.querySelector('#shovel')!.addEventListener('click',()=>{showFormation();shovelModel.visible=true;camera.position.set(1.4,1.4,2.2);controls.target.set(0,.95,0);controls.update();});
document.querySelector('#dig')!.addEventListener('click',()=>{showFormation();camera.position.set(14.8,2.1,.3);controls.target.set(12,.75,-2.65);controls.update();});
document.querySelector('#wide')!.addEventListener('click',()=>{showFormation();camera.position.set(10,9,17);controls.target.set(0,.6,1);controls.update();});
function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing)state.elapsed+=dt;units.update(new Set(),dt,20);living.update(now,false);const modelOnly=smgModel.visible||barModel.visible||shovelModel.visible;units.group.visible=living.group.visible=!modelOnly;controls.update();renderer.render(scene,camera);
  for(const l of labels){const p=l.p.clone().project(camera);l.el.style.display=modelOnly?'none':'';l.el.style.left=(p.x*.5+.5)*innerWidth+'px';l.el.style.top=(-p.y*.5+.5)*innerHeight+'px';}
  document.querySelector('#status')!.textContent=`Supplied models · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles · no campaign state`;
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
Object.assign(window,{weaponPreview:{assets,state,units,living,renderer,camera}});
