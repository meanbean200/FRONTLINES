import type {BattlefieldState} from '../core/types';
import type {Facility} from '../garrison/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {weaponCrewPoint} from '../construction/PositionDefinitions';
import type {Point3} from './types';
import {crewOperator} from './WeaponPositions';

/** Fixed tripod ahead of the gunner; traversing the barrel never moves the post. */
export function mountedGeometry(state:BattlefieldState,terrain:TerrainSystem,f:Facility,angle=f.facing??0,aim?:Point3){
  const operator=weaponCrewPoint(state,f,0),front=f.facing??0;
  const pivot={x:operator.x+Math.sin(front)*.62,z:operator.z+Math.cos(front)*.62,y:terrain.heightAt(operator.x,operator.z)+1.48};
  aim??=crewOperator(state,f)?.combat?.aim?.point;
  const pitch=aim?Math.atan2(aim.y-pivot.y,Math.hypot(aim.x-pivot.x,aim.z-pivot.z)):0;
  const muzzle={x:pivot.x+Math.sin(angle)*Math.cos(pitch)*.78,z:pivot.z+Math.cos(angle)*Math.cos(pitch)*.78,y:pivot.y+Math.sin(pitch)*.78};
  return {operator,pivot,muzzle,angle,pitch};
}
