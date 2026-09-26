import type {BattlefieldState} from '../core/types';
import {RESOURCES,type Inventory} from '../garrison/types';
import {validEndlessOptions} from './EndlessTypes';

/** Mode state is never inferred or repaired into a different campaign. */
export function validEndless(state:BattlefieldState):boolean {
  const op=state.operation;if(!op)return true;
  if(op.battleMode!==undefined&&!['operation','endless'].includes(op.battleMode))return false;
  const e=op.endless,r=op.campaign?.replacements;
  if(op.battleMode!=='endless')return e===undefined&&op.status!=='ended'&&r?.clock===undefined&&op.setup?.battleMode!=='endless';
  if(!e||!r||!op.runtime||op.runtime.missionPlan||op.authored||op.mode!=='open-front'||r.clock!=='simulation'||e.version!==1||!validEndlessOptions(e.options)||op.setup?.battleMode!=='endless')return false;
  if(e.options.reinforcements!==op.setup.endless?.reinforcements||e.options.pressure!==op.setup.endless?.pressure)return false;
  const n=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const integer=(v:unknown):v is number=>n(v)&&Number.isSafeInteger(v);
  const stock=(v:unknown):v is Inventory=>!!v&&typeof v==='object'&&RESOURCES.every(k=>n((v as Inventory)[k]));
  if(![e.startedAt,e.startedHour,e.nextAccounting].every(n)||e.startedAt>state.elapsed||!integer(e.initialReserve)||e.initialReserve!==(op.setup.advanced.reserves??48)||!stock(e.sourceInitial))return false;
  if(!e.owners||Object.keys(e.owners).length!==op.objectives.length||!op.objectives.every(o=>['player','enemy','neutral'].includes(e.owners[o.id])))return false;
  for(const side of ['player','enemy'] as const){
    if(!integer(e.targetStrength?.[side])||e.targetStrength[side]!== (side==='player'?op.initialPlayer:op.initialEnemy)||!integer(e.generatedReserve?.[side])||!n(e.nextAvailability?.[side])||!n(e.nextSupplyAvailability?.[side])||![e.sourceStock?.[side],e.sourceGenerated?.[side],e.sourceUsed?.[side],e.rearTarget?.[side]].every(stock))return false;
    if(e.options.reinforcements==='finite'&&(e.generatedReserve[side]!==0||RESOURCES.some(k=>e.sourceGenerated[side][k]!==0)))return false;
    for(const key of RESOURCES)if(Math.abs(e.sourceStock[side][key]+e.sourceUsed[side][key]-e.sourceInitial[key]-e.sourceGenerated[side][key])>1e-5||e.sourceStock[side][key]>e.sourceInitial[key]+1e-5)return false;
    if(!e.statistics||!integer(e.statistics.captured?.[side])||!integer(e.statistics.lost?.[side])||!integer(e.statistics.reinforcements?.[side]))return false;
    const ids=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
    const present=state.soldiers.filter(s=>ids.has(s.squadId)&&s.needs?.life!=='dead').length,pending=r.manifests.filter(m=>m.side===side&&!m.returning&&m.stage!=='arrived').length;
    if(present+pending>e.targetStrength[side])return false;
    if(r.establishment.filter(row=>ids.has(row.squadId)).reduce((sum,row)=>sum+row.strength,0)!==e.targetStrength[side])return false;
  }
  const d=e.director,site=(id:string)=>op.objectives.some(o=>o.id===id),owner=(v:string)=>['player','enemy','neutral'].includes(v);
  if(!d||!['probe','commit','hold','regroup'].includes(d.phase)||!site(d.targetId)||![d.since,d.reviewAt,d.startingAble,d.attempts,d.nextSupport].every(n)||d.since>state.elapsed||typeof d.reason!=='string')return false;
  if(!Array.isArray(d.knownSites)||d.knownSites.length!==op.objectives.length||new Set(d.knownSites.map(s=>s.id)).size!==d.knownSites.length||!d.knownSites.every(s=>site(s.id)&&owner(s.owner)&&n(s.at)&&s.at<=state.elapsed))return false;
  if(!Array.isArray(d.failedTargets)||d.failedTargets.length>op.objectives.length||new Set(d.failedTargets.map(s=>s.id)).size!==d.failedTargets.length||!d.failedTargets.every(s=>site(s.id)&&n(s.until)))return false;
  if(!Array.isArray(e.history)||e.history.length>64||!e.history.every((h,i)=>h&&n(h.at)&&h.at<=state.elapsed&&['control','reserve','ended'].includes(h.kind)&&typeof h.text==='string'&&h.text.length<=500&&(!i||h.at>=e.history[i-1].at)))return false;
  if(op.status==='ended')return !!e.ended&&n(e.ended.at)&&e.ended.at<=state.elapsed&&(e.ended.cause==='player-ended'&&e.ended.side===undefined||e.ended.cause==='force-exhausted'&&e.options.reinforcements==='finite'&&['player','enemy'].includes(e.ended.side??''));
  return op.status==='active'&&e.ended===undefined;
}
