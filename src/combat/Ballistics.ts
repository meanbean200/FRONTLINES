import { clamp, distance, type BattlefieldState, type SoldierState } from '../core/types';
import { hash2D } from '../core/random';
import { isWalkingAction } from '../core/SoldierActions';
import { boxIntersection } from '../terrain/WorldOcclusion';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import { bodyFloor, eyeHeight } from '../operations/Visibility';
import type { Point3, ShotEvent } from './types';
import {postureOf} from './Posture';

// Gameplay calibration, not historical marksmanship statistics. Metres of
// standard deviation in a plane perpendicular to the intended shot direction.
// Do not extrapolate a fixed 22 cm error all the way to the muzzle: multiplied
// movement/stress penalties turned a five-foot shot into a nearly vertical ray.
// The existing 50–360 m calibration is unchanged.
export const RIFLE_DISPERSION = [[0,0],[2,.045],[5,.10],[10,.18],[25,.37],[50,.57],[100,.95],[200,2.2],[300,4.8],[350,6.4],[360,6.8]] as const;
// Gameplay limit relative to the intended aim ray, not the world horizon.
// Applies to the physical shot, never just its tracer. Elevated targets remain valid.
export const MAX_SHOT_DEVIATION=Math.PI/15; // 12-degree half-angle.
export const maximumShotOffset=(range:number):number=>range*Math.tan(MAX_SHOT_DEVIATION);
export function rifleSpread(range:number):number {
  for(let i=1;i<RIFLE_DISPERSION.length;i++){
    const a=RIFLE_DISPERSION[i-1],b=RIFLE_DISPERSION[i];
    if(range<=b[0])return a[1]+(b[1]-a[1])*clamp((range-a[0])/(b[0]-a[0]),0,1);
  }
  return 6.8;
}
export function bodyVolume(terrain:TerrainSystem,s:SoldierState){
  const floor=bodyFloor(terrain,s),top=eyeHeight(terrain,s)+.12;
  const lying=postureOf(s)==='prone';
  return {x:s.x,z:s.z,y:floor+(top-floor)/2,rx:lying?.45:.23,ry:Math.max(.15,(top-floor)/2),rz:lying?.65:.23};
}
export function muzzlePoint(terrain:TerrainSystem,s:SoldierState):Point3 {
  // Anatomical shoulder line and metre-scale barrel, shared with rendering.
  return {x:s.x+Math.sin(s.heading)*.8+Math.cos(s.heading)*.16,y:eyeHeight(terrain,s)-.12,z:s.z+Math.cos(s.heading)*.8-Math.sin(s.heading)*.16};
}
export function aimPoint(terrain:TerrainSystem,shooter:SoldierState,target:SoldierState):Point3 {
  const body=bodyVolume(terrain,target),from=muzzlePoint(terrain,shooter);
  const chest={x:target.x,y:body.y,z:target.z};
  return terrain.objects.trace(from,chest,from.y,chest.y,false).clear?chest:{x:target.x,y:eyeHeight(terrain,target)-.04,z:target.z};
}
/** Fire permission uses the actual muzzle and the same fine trace as a shot.
 * Observation from the eyes alone is not permission to shoot through a lip. */
export function clearAimPoint(terrain:TerrainSystem,shooter:SoldierState,target:SoldierState):Point3|undefined {
  const oriented={...shooter,heading:Math.atan2(target.x-shooter.x,target.z-shooter.z)},from=muzzlePoint(terrain,oriented),body=bodyVolume(terrain,target);
  if(!terrain.objects.trace(shooter,from,eyeHeight(terrain,shooter)-.12,from.y,false,true).clear)return;
  for(const point of [{x:target.x,y:body.y,z:target.z},{x:target.x,y:eyeHeight(terrain,target)-.04,z:target.z}])
    if(terrain.objects.trace(from,point,from.y,point.y,false,true).clear)return point;
}
export function dispersionMultiplier(state:BattlefieldState,s:SoldierState,target?:SoldierState):number {
  const walking=isWalkingAction(s.action)||s.action==='following drawn path';
  const movingTarget=target&&(isWalkingAction(target.action)||target.action==='following drawn path');
  const hour=(state.living?.campaignHours??12)%24;
  return (walking?3.2:1)*(movingTarget?1.8:1)*(1+s.suppression/35)*
    (1+(100-(s.needs?.energy??100))/100)*(1+(100-s.morale)/200)*
    (hour<6||hour>=20?1.6:1)*(s.combat?.aim&&state.elapsed<s.combat.aim.settlingUntil?1.8:1);
}
/** Two independent seeded normal variates. No clock/frame-dependent hit roll. */
export function shotError(seed:number,shooterId:number,sequence:number):[number,number] {
  const u=Math.max(1e-9,hash2D(sequence,shooterId,seed+7151));
  const v=hash2D(sequence,shooterId,seed+31991),r=Math.sqrt(-2*Math.log(u));
  return [r*Math.cos(v*Math.PI*2),r*Math.sin(v*Math.PI*2)];
}
export function dispersedEndpoint(from:Point3,aim:Point3,spread:number,error:[number,number],reach:number):Point3 {
  const dx=aim.x-from.x,dy=aim.y-from.y,dz=aim.z-from.z,h=Math.hypot(dx,dz),d=Math.hypot(h,dy);
  if(d<1e-9)return {...from};
  const limit=maximumShotOffset(d),offset=Math.hypot(...error)*spread;
  const bounded=offset>limit?spread*limit/offset:spread;
  const lateral=error[0]*bounded,vertical=error[1]*bounded;
  // Orthonormal basis, including directly up/down stairs or an upper floor.
  const rightX=h>1e-9?dz/h:1,rightZ=h>1e-9?-dx/h:0;
  const x=dx+rightX*lateral+dy/d*rightZ*vertical;
  const y=dy+(dz*rightX-dx*rightZ)/d*vertical,z=dz+rightZ*lateral-dy/d*rightX*vertical;
  const length=Math.hypot(x,y,z)||1;
  return {x:from.x+x/length*reach,y:from.y+y/length*reach,z:from.z+z/length*reach};
}
/** Damage, near-miss suppression and visuals all consume this single result. */
export function resolveShot(state:BattlefieldState,terrain:TerrainSystem,shooter:SoldierState,aim:Point3,targets:readonly SoldierState[],spreadMultiplier=1,maximumRange=380):ShotEvent {
  const combat=shooter.combat??={shotSequence:0},sequence=combat.shotSequence++;
  const from=muzzlePoint(terrain,shooter),range=distance(from,aim);
  const end=dispersedEndpoint(from,aim,rifleSpread(range)*spreadMultiplier,shotError(state.seed,shooter.id,sequence),Math.max(2,Math.min(maximumRange,range+15)));
  const ray=terrain.objects.trace(from,end,from.y,end.y,false,true);
  let first=ray.clear?1:Math.min(1,distance(from,ray.point??end)/Math.max(.001,distance(from,end)));
  let hitId:number|undefined;
  const side=state.squads.find(q=>q.id===shooter.squadId)?.faction??'player';
  for(const target of targets){
    if((state.squads.find(q=>q.id===target.squadId)?.faction??'player')===side||target.health<=0||target.needs?.life!=='active')continue;
    const hit=boxIntersection(from,end,bodyVolume(terrain,target));
    if(hit&&hit[0]<first){first=hit[0];hitId=target.id;}
  }
  const to={x:from.x+(end.x-from.x)*first,y:from.y+(end.y-from.y)*first,z:from.z+(end.z-from.z)*first};
  const energy=hitId===undefined?ray.energy??1:terrain.objects.trace(from,to,from.y,to.y,false,true).energy??1;
  return {id:state.operation?.shots??sequence,at:state.elapsed,shooterId:shooter.id,squadId:shooter.squadId,from,to,hitId,
    obstruction:hitId===undefined?ray.blockedBy:undefined,energy};
}
export function segmentDistance(point:Point3,a:Point3,b:Point3):number {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy+(point.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
  return Math.hypot(point.x-a.x-dx*t,point.y-a.y-dy*t,point.z-a.z-dz*t);
}
