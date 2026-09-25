import type {BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {buildingFloors,firingPoints} from '../terrain/BuildingGeometry';

/** Public architecture, friendly occupants only. No enemy occupancy leak. */
export function buildingReadout(state:BattlefieldState,terrain:TerrainSystem,id:number){
  const b=terrain.buildings[id];if(!b)return;
  const friendly=new Set(state.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
  const people=state.soldiers.filter(s=>friendly.has(s.squadId)&&s.building?.id===id&&s.needs?.life!=='dead');
  const cap=firingPoints(b).length;
  return {name:(b.height>6?'House':'Farm building')+' '+String(id+1).padStart(2,'0'),condition:terrain.buildingCondition(id),
    floors:Array.from({length:buildingFloors(b)},(_,floor)=>({floor,capacity:cap,inside:people.filter(s=>s.building!.floor===floor&&!['approach','exit'].includes(s.building!.stage)).length,
      ready:people.filter(s=>s.needs?.life==='active'&&s.building!.floor===floor&&s.building!.stage==='station'&&!s.building!.exitRequested).length,
      casualties:people.filter(s=>s.needs?.life!=='active'&&s.building!.floor===floor&&!['approach','exit'].includes(s.building!.stage)).length,
      reserved:people.filter(s=>s.needs?.life==='active'&&s.building!.targetFloor===floor&&!s.building!.exitRequested).length,
      incoming:people.filter(s=>s.needs?.life==='active'&&s.building!.targetFloor===floor&&s.building!.stage==='approach').length})),people,
    squads:state.squads.filter(q=>friendly.has(q.id)&&state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active'))};
}
