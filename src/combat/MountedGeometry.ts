import type {BattlefieldState} from '../core/types';
import type {Facility} from '../garrison/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {weaponCrewPoint} from '../construction/PositionDefinitions';

/** Fixed tripod ahead of the gunner; traversing the barrel never moves the post. */
export function mountedGeometry(state:BattlefieldState,terrain:TerrainSystem,f:Facility,angle=f.facing??0){
  const operator=weaponCrewPoint(state,f,0),front=f.facing??0;
  const pivot={x:operator.x+Math.sin(front)*.62,z:operator.z+Math.cos(front)*.62,y:terrain.heightAt(operator.x,operator.z)+1.48};
  const muzzle={x:pivot.x+Math.sin(angle)*.78,z:pivot.z+Math.cos(angle)*.78,y:pivot.y};
  return {operator,pivot,muzzle,angle};
}
