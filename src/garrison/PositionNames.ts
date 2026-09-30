import type {BattlefieldState} from '../core/types';
import type {Garrison} from './types';

/** Player names use stable saved-array order, never raw entity/graph IDs. */
export const trenchName=(state:BattlefieldState,id:number)=>`Trench ${String(state.trenches.findIndex(t=>t.id===id)+1).padStart(2,'0')}`;
export function positionName(state:BattlefieldState,g:Garrison):string{
  return /^(Network|Garrison|Defensive area) \d+$/i.test(g.name)?trenchName(state,g.trenchId):g.name;
}
