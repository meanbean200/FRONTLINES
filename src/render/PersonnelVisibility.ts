import type {BattlefieldState,SoldierState} from '../core/types';

export const RECENT_FALLEN_LIMIT=64;
/** Presentation only: authoritative people, cargo and provenance are never removed. */
export function renderedPersonnel(state:BattlefieldState):SoldierState[] {
  if(!state.operation?.endless)return state.soldiers;
  const recent=state.soldiers.filter(s=>s.needs?.life==='dead'&&state.elapsed-(s.death?.occurredAt??0)<300)
    .sort((a,b)=>(b.death?.occurredAt??0)-(a.death?.occurredAt??0)||b.id-a.id).slice(0,RECENT_FALLEN_LIMIT);
  const ids=new Set(recent.map(s=>s.id));
  return state.soldiers.filter(s=>s.needs?.life!=='dead'||ids.has(s.id));
}
