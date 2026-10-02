import type {BuildingSite} from './WorldFeatures';
import {buildingFloors,doorPoint,firingPoints,floorHeight} from './BuildingGeometry';
import {roadDistance} from './WorldLayout';

/** Geometry already used by occupants, bullets and sight, never a stat bonus. */
export function buildingUtility(b:BuildingSite){
  const floors=buildingFloors(b),area=b.width*b.depth,door=doorPoint(b,1),road=roadDistance(door.x,door.z);
  const category=floors===2?(area>=150?'Large house':'Farmhouse'):area>=125?'Stone barn':road<30?'Roadside house':'Farm building';
  return {category,road,area,places:firingPoints(b).length*floors,elevation:(floors-1)*floorHeight(b),
    apertures:{north:3*floors,south:3*floors,east:floors,west:floors},
    role:floors===2?'Elevated observation and sheltered rifle positions':area>=125?'Broad covered floor for recovery and local staging':road<30?'Roadside shelter and a short carrier approach':'Sheltered ground-floor rifle positions'};
}
