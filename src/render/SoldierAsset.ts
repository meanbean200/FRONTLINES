import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import soldierUrl from '../assets/soldier.glb?url&inline';

export type SoldierPose='idle'|'unarmed'|'walk'|'aim'|'crouch'|'crouchWalk'|'crouchAim'|'dig'|'rest'|'eat'|'treat'|'carry'|'prone'|'crawl'|'sleep'|'wounded'|'dead';
export interface PoseRange {offset:number;frames:number;duration:number}
export interface SoldierAsset {
  geometry:THREE.BufferGeometry;
  atlas:THREE.DataTexture;
  matrices:Float32Array;
  boneCount:number;
  poses:Record<SoldierPose,PoseRange>;
  joints:Record<string,{index:number;bind:THREE.Vector3}>;
}

/** One rig is sampled once. Gameplay never creates a Skeleton/Mixer per soldier. */
export async function parseSoldierAsset(buffer:ArrayBuffer):Promise<SoldierAsset>{
  const gltf=await new GLTFLoader().parseAsync(buffer,'');
  let body:THREE.SkinnedMesh|undefined;
  gltf.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)body=o;});
  if(!body||!body.geometry.getAttribute('skinWeight'))throw Error('Soldier asset is missing its weighted rig.');
  const mesh=body as THREE.SkinnedMesh,boneCount=mesh.skeleton.bones.length;
  const poses={} as SoldierAsset['poses'];let rows=0;
  for(const clip of gltf.animations){const frames=Math.max(2,Math.ceil(clip.duration*24));poses[clip.name as SoldierPose]={offset:rows,frames,duration:clip.duration};rows+=frames;}
  for(const name of ['idle','unarmed','walk','aim','crouch','crouchWalk','crouchAim','dig','rest','eat','treat','carry','prone','crawl','sleep','wounded','dead']){
    if(!poses[name as SoldierPose])throw Error(`Soldier asset is missing ${name}.`);
  }
  const matrices=new Float32Array(rows*boneCount*16),mixer=new THREE.AnimationMixer(gltf.scene),joints:SoldierAsset['joints']={};
  mesh.skeleton.bones.forEach((b,index)=>{joints[b.name]={index,bind:new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[index].clone().invert())};});
  for(const clip of gltf.animations){
    mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();const range=poses[clip.name as SoldierPose];
    for(let frame=0;frame<range.frames;frame++){
      mixer.setTime(frame/range.frames*range.duration);gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
      matrices.set(mesh.skeleton.boneMatrices,(range.offset+frame)*boneCount*16);
    }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
  const atlas=new THREE.DataTexture(matrices,boneCount*4,rows,THREE.RGBAFormat,THREE.FloatType);
  atlas.name='Shared soldier animation palette';atlas.minFilter=atlas.magFilter=THREE.NearestFilter;atlas.generateMipmaps=false;atlas.needsUpdate=true;
  // Skinning moves well beyond the A-pose. Use a conservative local envelope.
  mesh.geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-1,-.2,-1.3),new THREE.Vector3(1,2,1.3));
  mesh.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.85,0),2);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m.dispose());mesh.skeleton.dispose();
  return {geometry:mesh.geometry,atlas,matrices,boneCount,poses,joints};
}

let pending:Promise<SoldierAsset>|undefined;
export function loadSoldierAsset():Promise<SoldierAsset>{
  return pending??=fetch(soldierUrl).then(r=>{if(!r.ok)throw Error(`Soldier asset: ${r.status}`);return r.arrayBuffer();}).then(parseSoldierAsset);
}
