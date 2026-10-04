import type {BuildingSite} from './WorldFeatures';
import {buildingFloors,doorPoint,firingPoints,floorHeight,type BuildingCondition} from './BuildingGeometry';
import {roadDistance} from './WorldLayout';

/** Geometry already used by occupants, bullets and sight, never a stat bonus. */
export function buildingUtility(b:BuildingSite,condition:BuildingCondition='intact'){
  const floors=condition==='ruined'?1:buildingFloors(b),area=b.width*b.depth,door=doorPoint(b,1),road=roadDistance(door.x,door.z);
  const category=floors===2?(area>=150?'Large house':'Farmhouse'):area>=125?'Stone barn':road<30?'Roadside house':'Farm building';
  const places=firingPoints(b,condition).length*floors;
  return {category,road,area,places,elevation:(floors-1)*floorHeight(b),
    apertures:condition==='ruined'?{north:1,south:1,east:1,west:1}:{north:3*floors,south:3*floors,east:floors,west:floors},
    role:condition==='ruined'?'Broken masonry positions with no roofed shelter':floors===2?'Elevated observation and sheltered rifle positions':area>=125?'Broad covered floor for recovery and local staging':road<30?'Roadside shelter and a short carrier approach':'Sheltered ground-floor rifle positions'};
}
