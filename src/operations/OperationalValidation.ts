import type {BattlefieldState} from '../core/types';
import {isOperationId} from './OperationDefinitions';
import {placeOperation} from './OperationPlacement';
import {validBattleSetup} from './BattleSetup';
import {placeMissionOperation} from './MissionContent';
import {placeOpenFront} from './OpenFrontPlacement';

/** V8/libm versions may differ by a few ULPs on generated road curves. Keep
 * serialized coordinates, permit only sub-nanometre coordinate differences,
 * and still reject changed topology, dimensions, objectives or configuration. */
function sameDefinition(a:unknown,b:unknown,key=''):boolean {
  if(a===b)return true;
  if(typeof a==='number'&&typeof b==='number'&&(key==='x'||key==='z'))return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
  return keys.length===Object.keys(right).length&&keys.every(k=>Object.hasOwn(right,k)&&sameDefinition(left[k],right[k],k));
}

/** Static mission data is reproducible from version/id/seed. Reject edited geometry,
 * missing objectives and incompatible definitions instead of inventing a continuation. */
export function validOperationalRuntime(state:BattlefieldState):boolean {
  const op=state.operation!,r=op.runtime;
  if(!r)return op.setup===undefined&&!isOperationId(op.mode);
  if(r.version!==2||!isOperationId(r.definitionId)||op.mode!==r.definitionId||r.seed!==state.seed)return false;
  if(!Array.isArray(op.objectives))return false;
  if(op.setup!==undefined&&(!validBattleSetup(op.setup,true)||op.setup.operation!==op.mode||op.setup.seed!==state.seed))return false;
  if(Boolean(r.missionPlan)!==Boolean(r.mission))return false;
  if(r.missionPlan&&![1,2,3].includes(r.missionPlan.version))return false;
  if(Boolean(r.openFront)!==Boolean(op.setup?.openFrontRules))return false;
  let expected;try{expected=r.openFront?placeOpenFront(r.seed,op.setup!):r.missionPlan?placeMissionOperation(r.definitionId,r.seed,op.setup,r.missionPlan.version):placeOperation(r.definitionId,r.seed,op.setup);}catch{return false;}
  if(!sameDefinition(r.missionPlan,expected.missionPlan))return false;
  for(const key of ['front','zones','locations','routes','reinforcements','objectives','victory'] as const)if(!sameDefinition(r[key],expected[key]))return false;
  const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(r.openFront){const f=r.openFront;if(f.version!==1||state.worldSize!==2400||!nonnegative(f.nextWorks)||!Array.isArray(f.works)||f.works.length>16||new Set(f.works.map(w=>w.trenchId)).size!==f.works.length||!f.works.every(w=>w&&['player','enemy'].includes(w.side)&&['building','occupying'].includes(w.stage)&&state.trenches.some(t=>t.id===w.trenchId)&&Array.isArray(w.squadIds)&&w.squadIds.length>0&&new Set(w.squadIds).size===w.squadIds.length&&w.squadIds.every(id=>state.squads.some(q=>q.id===id&&(q.faction??'player')===w.side))))return false;}
  const phases=['preparation','contact','engagement','exploitation','consolidation','withdrawal'];
  if(r.mission){const m=r.mission,stages=['preparation','contact','line','building','sustain','secured','lost'];
    if(m.houseTaken!==undefined&&typeof m.houseTaken!=='boolean')return false;
    if(m.checks&&(!['house','line','supply','road'].every(k=>typeof m.checks![k as keyof typeof m.checks]==='boolean')||Object.entries(m.checks).some(([key,value])=>!['house','line','supply','road','secondary','defense'].includes(key)||typeof value!=='boolean')))return false;
    if(m.version!==1||!stages.includes(m.phase)||typeof m.lineTaken!=='boolean'||typeof m.reason!=='string'||![m.securedFor,m.breachedFor].every(n=>nonnegative(n)&&n<=op.elapsed+.001)||m.contactAt!==undefined&&(!nonnegative(m.contactAt)||m.contactAt>op.elapsed+.001))return false;
    if(!Array.isArray(m.history)||m.history.length<1||m.history.length>32||!m.history.every((h,i)=>h&&stages.includes(h.phase)&&nonnegative(h.at)&&h.at<=op.elapsed+.001&&typeof h.reason==='string'&&(i===0||h.at>=m.history[i-1].at)))return false;
  }
  if(!phases.includes(r.phase)||!nonnegative(r.phaseSince)||r.phaseSince>op.elapsed+.001||!nonnegative(r.lastEvaluation)||r.lastEvaluation>op.elapsed+.001||!nonnegative(r.nextEvaluation)||r.nextEvaluation>op.elapsed+1.001)return false;
  if(!Array.isArray(r.history)||r.history.length<1||r.history.length>32||!r.history.every((h,i)=>h&&phases.includes(h.phase)&&nonnegative(h.at)&&h.at<=op.elapsed+.001&&(i===0||h.at>=r.history[i-1].at)&&typeof h.reason==='string'))return false;
  if(!r.routeAccess||typeof r.routeAccess!=='object'||Object.entries(r.routeAccess).some(([id,v])=>!r.routes.some(route=>route.id===id)||typeof v!=='boolean'))return false;
  if(!Array.isArray(r.progress)||r.progress.length!==r.objectives.length||new Set(r.progress.map(p=>p?.id)).size!==r.progress.length)return false;
  if(!r.progress.every(p=>p&&r.objectives.some(o=>o.id===p.id)&&[p.heldFor,p.pressureFor].every(n=>nonnegative(n)&&n<=op.elapsed+.001)&&[p.satisfied,p.complete,p.failed].every(v=>typeof v==='boolean')&&typeof p.reason==='string'))return false;
  if(r.commander&&(!['scouting','consolidating','committing','holding','withdrawing'].includes(r.commander.phase)||!nonnegative(r.commander.since)||r.commander.since>state.elapsed+.001||!nonnegative(r.commander.startingAble)||typeof r.commander.reason!=='string'))return false;
  if(r.commander?.nextSupport!==undefined&&!nonnegative(r.commander.nextSupport))return false;
  if(r.commander){
    const c=r.commander,plans=['establishing-front','probing','assessing','preparing-attack','assaulting','consolidating','holding','reinforcing','counterattacking','withdrawing','forming-fallback','resupplying'],sectors=['left','center','right','rear'];
    if(c.planPhase!==undefined&&!plans.includes(c.planPhase)||c.planSince!==undefined&&!nonnegative(c.planSince)||c.reviewAt!==undefined&&!nonnegative(c.reviewAt)||c.activeSector!==undefined&&!['left','center','right'].includes(c.activeSector))return false;
    if(c.reserveIds!==undefined&&(!Array.isArray(c.reserveIds)||new Set(c.reserveIds).size!==c.reserveIds.length||!c.reserveIds.every(id=>state.squads.some(q=>q.id===id&&q.faction==='enemy'))))return false;
    if(c.sectors!==undefined&&(!Array.isArray(c.sectors)||c.sectors.length!==4||new Set(c.sectors.map(s=>s.id)).size!==4||!c.sectors.every(s=>s&&sectors.includes(s.id)&&[s.friendly,s.ready,s.contacts,s.suppression,s.ammo,s.prepared,s.support].every(nonnegative)&&typeof s.exposed==='boolean'&&Number.isFinite(s.center.x)&&Number.isFinite(s.center.z))))return false;
    if(c.failedApproaches!==undefined&&(!Array.isArray(c.failedApproaches)||c.failedApproaches.length>6||!c.failedApproaches.every(f=>f&&['left','center','right'].includes(f.sector)&&[f.at,f.loss,f.progress,f.cooldownUntil].every(nonnegative)&&typeof f.heavyResistance==='boolean'&&['none','he','smoke'].includes(f.support))))return false;
    if(c.transitions!==undefined&&(!Array.isArray(c.transitions)||c.transitions.length>32||!c.transitions.every(t=>t&&plans.includes(t.phase)&&nonnegative(t.at)&&typeof t.reason==='string'&&(t.sector===undefined||['left','center','right'].includes(t.sector)))))return false;
    if(c.attack!==undefined&&(!['left','center','right'].includes(c.attack.sector)||![c.attack.since,c.attack.startingAble].every(nonnegative)||!Number.isFinite(c.attack.startingDepth)||!['none','he','smoke'].includes(c.attack.support)))return false;
  }
  if(op.objectives.length!==r.locations.length||!r.locations.every(l=>op.objectives.some(o=>o.id===l.id&&state.living?.crates.some(c=>c.id===o.cacheId))))return false;
  return r.reinforcements.every(source=>{const supply=source.side==='player'?state.living:state.living?.enemySupply;return supply&&JSON.stringify(supply.rear)===JSON.stringify(source.rear)&&JSON.stringify(supply.entry)===JSON.stringify(source.entry);});
}
