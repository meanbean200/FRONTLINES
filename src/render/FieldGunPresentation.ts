import * as THREE from 'three';
import type {BattlefieldState} from '../core/types';
import type {Facility} from '../garrison/types';
import type {WeaponAssets} from './WeaponAssets';
import {gunRecoil,latestGunDischarge} from './SupportAnimation';

/** Geometry, smoke and inspection use the same pose. Does not resolve a shot. */
export function fieldGunPresentation(state:BattlefieldState,f:Facility,height:number,asset?:WeaponAssets){
  const shot=latestGunDischarge(state,f.id);
  const mission=state.operation?.supportMissions?.find(m=>m.positionId===f.id&&['preparing','flight'].includes(m.stage))??shot;
  const yaw=mission?Math.atan2(mission.target.x-f.x,mission.target.z-f.z):f.facing??0;
  const recoil=shot?gunRecoil(state.elapsed-shot.launchAt):0;
  const baseElevation=asset?.cannonElevation??.2;
  // Only the requested area affects the pose, never the privately resolved impact.
  const elevation=asset&&mission?THREE.MathUtils.clamp(.18+Math.atan(Math.hypot(mission.target.x-f.x,mission.target.z-f.z)/2400)*.38,.18,.60):baseElevation;
  const pivot=asset?.cannonPivot??new THREE.Vector3(0,1.37,-.46);
  const barrel=new THREE.Matrix4().makeTranslation(f.x,height,f.z).multiply(new THREE.Matrix4().makeRotationY(yaw));
  if(asset){
    barrel.multiply(new THREE.Matrix4().makeTranslation(pivot.x,pivot.y,pivot.z))
      .multiply(new THREE.Matrix4().makeRotationX(-(elevation-baseElevation)))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
  }
  barrel.multiply(new THREE.Matrix4().makeTranslation(0,-Math.sin(baseElevation)*recoil,-Math.cos(baseElevation)*recoil));
  const muzzle=(asset?.cannonMuzzle??new THREE.Vector3(0,2.09,3.23)).clone().applyMatrix4(barrel);
  return {barrel,muzzle,yaw,elevation,recoil};
}
