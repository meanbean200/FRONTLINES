import type {BattlefieldState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {buildingFloors,firingPoints} from '../terrain/BuildingGeometry';
import {buildingUtility} from '../terrain/BuildingUtility';
import {ownsCrate} from '../garrison/SupplyAccess';
import {buildingContains} from '../terrain/BuildingGeometry';

/** Public architecture, friendly occupants only. No enemy occupancy leak. */
export function buildingReadout(state:BattlefieldState,terrain:TerrainSystem,id:number){
  const b=terrain.buildings[id];if(!b)return;
  const friendly=new Set(state.squads.filter(q=>q.faction!=='enemy').map(q=>q.id));
  const people=state.soldiers.filter(s=>friendly.has(s.squadId)&&(s.building?.id===id||s.selfCare?.home.building?.id===id)&&s.needs?.life!=='dead');
  const cap=firingPoints(b).length;
  const utility=buildingUtility(b),stock=(state.living?.crates??[]).filter(c=>buildingContains(b,c)&&ownsCrate(state,c,'player'));
  return {name:utility.category+' '+String(id+1).padStart(2,'0'),condition:terrain.buildingCondition(id),utility,stock,
    floors:Array.from({length:buildingFloors(b)},(_,floor)=>({floor,capacity:cap,inside:people.filter(s=>s.building?.floor===floor&&!['approach','exit'].includes(s.building.stage)).length,
      ready:people.filter(s=>s.needs?.life==='active'&&s.building?.floor===floor&&s.building.stage==='station'&&!s.building.exitRequested&&!s.selfCare).length,
      casualties:people.filter(s=>s.needs?.life!=='active'&&s.building?.floor===floor&&!['approach','exit'].includes(s.building.stage)).length,
      reserved:people.filter(s=>s.needs?.life==='active'&&(s.selfCare?.home.building?.floor===floor||s.building?.targetFloor===floor&&!s.building.exitRequested)).length,
      incoming:people.filter(s=>s.needs?.life==='active'&&(s.selfCare?.home.building?.floor===floor&&s.selfCare.stage==='return'||s.building?.targetFloor===floor&&s.building.stage==='approach')).length})),people,
    squads:state.squads.filter(q=>friendly.has(q.id)&&state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active'))};
}
