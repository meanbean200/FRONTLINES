import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import weaponUrl from '../assets/weapons.glb?url&inline';

export interface WeaponAssets {
  rifle:THREE.BufferGeometry;
  submachinegun:THREE.BufferGeometry;
  automaticRifle:THREE.BufferGeometry;
  automaticRifleDeployed:THREE.BufferGeometry;
  machinegun:THREE.BufferGeometry;
  machinegunDeployed:THREE.BufferGeometry;
  cannonCarriage:THREE.BufferGeometry;
  cannonBarrel:THREE.BufferGeometry;
  rifleGrip:THREE.Vector3;
  submachinegunGrip:THREE.Vector3;
  automaticRifleGrip:THREE.Vector3;
  machinegunGrip:THREE.Vector3;
  cannonPivot:THREE.Vector3;
  cannonMuzzle:THREE.Vector3;
  cannonElevation:number;
}
/** Shared immutable geometry; instances, aiming and visibility remain renderer-owned. */
export async function parseWeaponAssets(buffer:ArrayBuffer):Promise<WeaponAssets>{
  const gltf=await new GLTFLoader().parseAsync(buffer,''),parts=new Map<string,THREE.BufferGeometry>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    parts.set(o.name,o.geometry.clone().applyMatrix4(o.matrixWorld));
    o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
  });
  const take=(name:string)=>{const p=parts.get(name);if(!p)throw Error(`Equipment asset missing ${name}.`);return p;};
  const sockets=gltf.userData.sockets;
  if(gltf.userData.version!==1||!sockets?.cannon?.muzzle||!sockets?.smg?.grip||!sockets?.bar?.grip||!sockets?.barBipods)throw Error('Incompatible equipment asset.');
  const merge=(names:string[])=>{const g=mergeGeometries(names.map(take),false);if(!g)throw Error('Incompatible equipment geometry.');return g;};
  const deployed=merge(['mg','mgLegL','mgLegR']);
  // Fold the two source bipod legs rearward for carried/tripod weapons. This is
  // a one-time geometry bake, not another mesh/mixer for every rifleman.
  for(const [name,side,key] of [['mgLegL',1,'left'],['mgLegR',-1,'right']] as const){
    const pivot=new THREE.Vector3(...sockets.mgBipods[key]),g=take(name);
    g.translate(-pivot.x,-pivot.y,-pivot.z);g.rotateZ(side*.52);g.rotateX(1.38);g.translate(pivot.x,pivot.y,pivot.z);
  }
  const machinegun=merge(['mg','mgLegL','mgLegR']),carriage=merge(['cannonCarriage','cannonWheelL','cannonWheelR']);
  const automaticRifleDeployed=merge(['bar','barLegL','barLegR']);
  for(const [name,side,key] of [['barLegL',1,'left'],['barLegR',-1,'right']] as const){
    const pivot=new THREE.Vector3(...sockets.barBipods[key]),g=take(name);
    g.translate(-pivot.x,-pivot.y,-pivot.z);g.rotateZ(side*.32);g.rotateX(1.45);g.translate(pivot.x,pivot.y,pivot.z);
  }
  const automaticRifle=merge(['bar','barLegL','barLegR']);
  const asset:WeaponAssets={rifle:take('rifle'),submachinegun:take('smg'),automaticRifle,automaticRifleDeployed,machinegun,machinegunDeployed:deployed,cannonCarriage:carriage,cannonBarrel:take('cannonBarrel'),rifleGrip:new THREE.Vector3(...sockets.rifle.grip),submachinegunGrip:new THREE.Vector3(...sockets.smg.grip),automaticRifleGrip:new THREE.Vector3(...sockets.bar.grip),machinegunGrip:new THREE.Vector3(...sockets.mg.grip),cannonPivot:new THREE.Vector3(...sockets.cannon.pivot),cannonMuzzle:new THREE.Vector3(...sockets.cannon.muzzle),cannonElevation:sockets.cannon.elevation};
  for(const key of ['mg','mgLegL','mgLegR','bar','barLegL','barLegR','cannonCarriage','cannonWheelL','cannonWheelR'])take(key).dispose();
  for(const g of [asset.rifle,asset.submachinegun,automaticRifle,automaticRifleDeployed,machinegun,deployed,carriage,asset.cannonBarrel]){g.computeBoundingBox();g.computeBoundingSphere();}
  return asset;
}
let pending:Promise<WeaponAssets>|undefined;
let loaded:WeaponAssets|undefined;
export function currentWeaponAssets():WeaponAssets|undefined{return loaded;}
export function loadWeaponAssets():Promise<WeaponAssets>{
  return pending??=fetch(weaponUrl).then(r=>{if(!r.ok)throw Error(`Equipment asset: ${r.status}`);return r.arrayBuffer();}).then(parseWeaponAssets).then(a=>loaded=a);
}
