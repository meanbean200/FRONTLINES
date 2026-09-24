import type {BattlefieldState} from '../core/types';
import {isOperationId} from './OperationDefinitions';
import {placeOperation} from './OperationPlacement';

/** Static mission data is reproducible from version/id/seed. Reject edited geometry,
 * missing objectives and incompatible definitions instead of inventing a continuation. */
export function validOperationalRuntime(state:BattlefieldState):boolean {
  const op=state.operation!,r=op.runtime;
  if(!r)return !isOperationId(op.mode);
  if(r.version!==2||!isOperationId(r.definitionId)||op.mode!==r.definitionId||r.seed!==state.seed)return false;
  if(!Array.isArray(op.objectives))return false;
  const expected=placeOperation(r.definitionId,r.seed);
  for(const key of ['front','zones','locations','routes','reinforcements','objectives','victory'] as const)if(JSON.stringify(r[key])!==JSON.stringify(expected[key]))return false;
  const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const phases=['preparation','contact','engagement','exploitation','consolidation','withdrawal'];
  if(!phases.includes(r.phase)||!nonnegative(r.phaseSince)||r.phaseSince>op.elapsed+.001||!nonnegative(r.lastEvaluation)||r.lastEvaluation>op.elapsed+.001||!nonnegative(r.nextEvaluation)||r.nextEvaluation>op.elapsed+1.001)return false;
  if(!Array.isArray(r.history)||r.history.length<1||r.history.length>32||!r.history.every((h,i)=>h&&phases.includes(h.phase)&&nonnegative(h.at)&&h.at<=op.elapsed+.001&&(i===0||h.at>=r.history[i-1].at)&&typeof h.reason==='string'))return false;
  if(!r.routeAccess||typeof r.routeAccess!=='object'||Object.entries(r.routeAccess).some(([id,v])=>!r.routes.some(route=>route.id===id)||typeof v!=='boolean'))return false;
  if(!Array.isArray(r.progress)||r.progress.length!==r.objectives.length||new Set(r.progress.map(p=>p?.id)).size!==r.progress.length)return false;
  if(!r.progress.every(p=>p&&r.objectives.some(o=>o.id===p.id)&&[p.heldFor,p.pressureFor].every(n=>nonnegative(n)&&n<=op.elapsed+.001)&&[p.satisfied,p.complete,p.failed].every(v=>typeof v==='boolean')&&typeof p.reason==='string'))return false;
  if(r.commander&&(!['scouting','committing','holding','withdrawing'].includes(r.commander.phase)||!nonnegative(r.commander.since)||r.commander.since>state.elapsed+.001||!nonnegative(r.commander.startingAble)||typeof r.commander.reason!=='string'))return false;
  if(r.commander?.nextSupport!==undefined&&!nonnegative(r.commander.nextSupport))return false;
  if(op.objectives.length!==r.locations.length||!r.locations.every(l=>op.objectives.some(o=>o.id===l.id&&state.living?.crates.some(c=>c.id===o.cacheId))))return false;
  return r.reinforcements.every(source=>{const supply=source.side==='player'?state.living:state.living?.enemySupply;return supply&&JSON.stringify(supply.rear)===JSON.stringify(source.rear)&&JSON.stringify(supply.entry)===JSON.stringify(source.entry);});
}
