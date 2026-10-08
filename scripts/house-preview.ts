// Developer-only art fixture. No player session or campaign persistence.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {loadHouseAssets} from '../src/render/HouseAssets';
import {createBuildingMeshes,refreshBuildingMeshes} from '../src/render/Scenery';
import {createStudyScenario} from '../src/garrison/StudyScenario';
const asset=await loadHouseAssets(),sim=createStudyScenario(),terrain=sim.terrain;
terrain.buildings=[{x:0,z:0,width:11,depth:9,height:5,angle:0}];
terrain.baseHeightAt=()=>0;terrain.heightAt=()=>0;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x343e30);
scene.add(new THREE.HemisphereLight(0xe1e3ce,0x736348,2));
const sun=new THREE.DirectionalLight(0xffebce,2.6);sun.position.set(18,32,-14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22});sun.shadow.normalBias=.025;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x616b46,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;floor.receiveShadow=true;scene.add(floor);
const infrastructure=new THREE.Group();infrastructure.add(createBuildingMeshes(terrain,asset));scene.add(infrastructure);
const source=await new OBJLoader().loadAsync('/assets/source/small-one-floor-house.obj');
source.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position'),colors:number[]=[],color=new THREE.Color();for(let i=0;i<p.count;i++){const y=p.getY(i);color.setHex(y>.06?0x646c68:y<-.65?0xada085:0xc5bba1);colors.push(color.r,color.g,color.b);}o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));o.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});o.castShadow=o.receiveShadow=true;}});
source.scale.setScalar(5.7);source.position.y=.80841131*5.7;source.visible=false;scene.add(source);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,500);camera.position.set(18,14,-22);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,0);controls.update();
let cutaway=false,detail=true,reverse=false;
function show(condition:'intact'|'damaged'|'ruined'='intact'){source.visible=false;infrastructure.visible=true;sim.state.buildingChanges=[{id:0,condition,damage:condition==='ruined'?100:condition==='damaged'?50:0}];terrain.syncModifications();refresh();}
function refresh(){refreshBuildingMeshes(infrastructure,terrain,cutaway?new Map([[0,0]]):new Map(),detail?asset:undefined);}
document.querySelector('#adapted')!.addEventListener('click',()=>{detail=true;cutaway=false;show();});
document.querySelector('#source')!.addEventListener('click',()=>{source.visible=true;infrastructure.visible=false;});
document.querySelector('#interior')!.addEventListener('click',()=>{cutaway=!cutaway;show();});
document.querySelector('#damage')!.addEventListener('click',()=>show('damaged'));
document.querySelector('#ruin')!.addEventListener('click',()=>show('ruined'));
document.querySelector('#fallback')!.addEventListener('click',()=>{detail=!detail;show();});
document.querySelector('#rear')!.addEventListener('click',()=>{reverse=!reverse;camera.position.set(reverse?-18:18,14,reverse?22:-22);controls.update();});
function frame(){requestAnimationFrame(frame);controls.update();renderer.render(scene,camera);document.querySelector('#status')!.textContent=`${source.visible?'Unadapted source reference':'Production building surfaces'} · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles`;}
frame();window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
Object.assign(window,{housePreview:{asset,sim,terrain,infrastructure,scene,renderer,camera}});
