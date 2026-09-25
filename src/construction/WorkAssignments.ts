import type {BattlefieldState} from '../core/types';

/** Explicit position work is not also a squad excavation queue entry. Removes
 * only redundant legacy references, never sites, workers, cargo or orders. */
export function migrateExplicitWorkQueues(state:BattlefieldState):void {
  const explicit=new Set(state.living?.facilities.filter(f=>f.workOrder?.explicit).map(f=>f.id));
  for(const q of state.squads)if(q.constructionQueue)q.constructionQueue=q.constructionQueue.filter(j=>typeof j==='number'||j.kind!=='facility'||!explicit.has(j.id));
}
export function reservedConstructionTeam(state:BattlefieldState,squadId:number):boolean {
  const ids=new Set(state.squads.find(q=>q.id===squadId)?.soldierIds??[]);
  return Boolean(state.living?.facilities.some(f=>f.progress<1&&f.workOrder?.workerIds.some(id=>ids.has(id))||f.weaponCrewIds?.some(id=>ids.has(id))));
}
