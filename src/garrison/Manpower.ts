import type {BattlefieldState,SoldierState} from '../core/types';
import {committedToAssault} from '../operations/AssaultPlan';
import {needsRecovery,stationCrewIds,isWorking,readyDefender} from './PersonnelRoles';
export {needsRecovery} from './PersonnelRoles';

/** A duty label is not evidence of a fit, armed person occupying that duty. */
export function readyWatch(state:BattlefieldState,s:SoldierState):boolean{
  return s.duty?.kind==='watch'&&readyDefender(state,s);
}

export type ManpowerPool='stationCrew'|'workers'|'available'|'recovering'|'assault';
/** Exclusive totals; reservation badges remain on the original people/posts. */
export function manpowerPools(state:BattlefieldState,people:SoldierState[]){
  const pools:Record<ManpowerPool,number[]>={stationCrew:[],workers:[],available:[],recovering:[],assault:[]};
  const crew=stationCrewIds(state);
  for(const s of people){
    if(s.needs?.life==='dead')continue;
    const q=state.squads.find(q=>q.id===s.squadId);
    const pool:ManpowerPool=needsRecovery(s)?'recovering':committedToAssault(state,s)||q?.order.intent==='assault'&&!s.duty?'assault':crew.has(s.id)?'stationCrew':isWorking(state,s)?'workers':'available';
    pools[pool].push(s.id);
  }
  return pools;
}
