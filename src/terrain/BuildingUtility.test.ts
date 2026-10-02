import {it,expect} from 'vitest';
import {buildingUtility} from './BuildingUtility';
import {buildingFloors,firingPoints} from './BuildingGeometry';
import {createOperation} from '../operations/createOperation';
import {TerrainSystem} from './TerrainSystem';
import {buildingReadout} from '../ui/BuildingReadout';

it('describes real geometry and friendly stock, not bonuses or hidden occupants',()=>{
  const state=createOperation('advance'),terrain=new TerrainSystem(state);
  const before=JSON.stringify(state),kinds=new Set<string>();
  terrain.buildings.forEach((b,id)=>{const u=buildingUtility(b),r=buildingReadout(state,terrain,id)!;kinds.add(u.category);expect(u.places).toBe(firingPoints(b).length*buildingFloors(b));expect(r.floors.reduce((n,f)=>n+f.capacity,0)).toBe(u.places);expect(r.stock).toEqual([]);expect(u.road).toBeGreaterThanOrEqual(0);});
  expect(kinds.size).toBeGreaterThanOrEqual(3);expect(JSON.stringify(state)).toBe(before);
});
