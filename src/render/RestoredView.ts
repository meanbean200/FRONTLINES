import type {BattlefieldState,Vec2} from '../core/types';
import {factionOf} from '../operations/types';

/** Loading a different campaign must not leave its troops off-screen. */
export function restoredViewTarget(state:BattlefieldState):Vec2|undefined {
  const playerSquads=new Set(state.squads.filter(q=>factionOf(q)==='player').map(q=>q.id));
  const living=state.soldiers.filter(s=>playerSquads.has(s.squadId)&&s.health>0&&s.needs?.life!=='dead');
  const point=living.find(s=>s.needs?.life!=='incapacitated')??living[0]??state.squads.find(q=>playerSquads.has(q.id))??state.operation?.objectives[0]??state.trenches[0]?.points[0];
  return point?{x:point.x,z:point.z}:undefined;
}
