import * as THREE from 'three';
import type {BattlefieldState} from '../core/types';
import type {Facility} from '../garrison/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {Point3} from '../combat/types';
import {mountedGeometry} from '../combat/MountedGeometry';
import type {WeaponAssets} from './WeaponAssets';

/** Fixed feet, articulated cradle, unchanged authoritative barrel/shot origin.
 * The short adjustable riser is presentation, not new cover or a firing rule. */
export function mountedGunPresentation(state:BattlefieldState,terrain:TerrainSystem,f:Facility,asset?:WeaponAssets,shot?:{from:Point3;to:Point3}){
  const geometry=mountedGeometry(state,terrain,f,f.traverse?.yaw??f.facing??0),muzzle=shot?.from??geometry.muzzle;
  const direction=shot?new THREE.Vector3(shot.to.x-muzzle.x,shot.to.y-muzzle.y,shot.to.z-muzzle.z):new THREE.Vector3(muzzle.x-geometry.pivot.x,muzzle.y-geometry.pivot.y,muzzle.z-geometry.pivot.z);
  direction.normalize();const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
  const gun=new THREE.Matrix4().compose(new THREE.Vector3(muzzle.x,muzzle.y,muzzle.z).addScaledVector(direction,-.6),q,new THREE.Vector3(1,1,1));
  if(!asset)return {gun};
  // Mount location and base orientation come only from the installed post, never
  // the temporary aim point, crew position or a random shot's angular error.
  const base=new THREE.Matrix4().compose(new THREE.Vector3(geometry.pivot.x,terrain.heightAt(geometry.pivot.x,geometry.pivot.z),geometry.pivot.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),f.facing??0),new THREE.Vector3(1,1,1));
  const bottom=asset.mgMountBaseNeck.clone().applyMatrix4(base),top=asset.mgMountHeadNeck.clone().applyMatrix4(gun),span=top.clone().sub(bottom),length=span.length();
  const riser=new THREE.Matrix4().compose(bottom.clone().add(top).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),length>.001?span.normalize():new THREE.Vector3(0,1,0)),new THREE.Vector3(1,Math.max(.001,length),1));
  return {gun,base,head:gun,riser};
}
