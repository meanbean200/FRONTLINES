import type {BattlefieldState} from '../core/types';
import {inventory,RESOURCES} from '../garrison/types';
import {defaultEndlessOptions,type EndlessOptions} from './EndlessTypes';
import {endlessReleaseInterval,initialEndlessSource,stepEndlessAvailability} from './EndlessEconomy';
import type {Faction} from './types';

/** New-world initialization only. Save restoration never calls this. */
export function initializeEndless(state:BattlefieldState,options:EndlessOptions=defaultEndlessOptions()):void {
  const op=state.operation!,w=state.living!,r=op.campaign?.replacements;
  if(!r||!op.runtime||op.runtime.missionPlan||op.authored)throw new Error('Endless requires a persistent sector, not a mission or title-screen session.');
  if(op.endless)throw new Error('Endless state already initialized.');
  const source=initialEndlessSource(w.logistics!.manifest);
  const rearTarget={player:inventory(),enemy:inventory()};
  for(const side of ['player','enemy'] as const)for(const key of RESOURCES)rearTarget[side][key]=Math.max((side==='player'?w.rearStock:w.enemySupply!.stock)[key],w.logistics!.manifest[key]*2);
  op.battleMode='endless';op.duration=0;
  op.endless={version:1,options:structuredClone(options),startedAt:state.elapsed,startedHour:w.campaignHours,
    targetStrength:{player:op.initialPlayer,enemy:op.initialEnemy},initialReserve:r.reserve.player,
    generatedReserve:{player:0,enemy:0},nextAvailability:{player:state.elapsed+90,enemy:state.elapsed+90},
    nextSupplyAvailability:{player:state.elapsed+450,enemy:state.elapsed+450},nextAccounting:state.elapsed,
    sourceStock:{player:{...source},enemy:{...source}},sourceInitial:source,sourceGenerated:{player:inventory(),enemy:inventory()},
    sourceUsed:{player:inventory(),enemy:inventory()},rearTarget,
    owners:Object.fromEntries(op.objectives.map(o=>[o.id,o.owner])),history:[],
    statistics:{captured:{player:0,enemy:0},lost:{player:0,enemy:0},reinforcements:{player:0,enemy:0}},
    director:{phase:'probe',targetId:op.objectives.find(o=>o.owner==='neutral')?.id??op.objectives[0].id,since:state.elapsed,reviewAt:state.elapsed,
      startingAble:op.initialEnemy,attempts:0,nextSupport:0,reason:'Reconnoitre the sector; retain a reserve',
      knownSites:op.objectives.map(o=>({id:o.id,owner:o.owner,at:state.elapsed})),failedTargets:[]}};
  r.clock='simulation';r.nextAt={player:state.elapsed+endlessReleaseInterval(state),enemy:state.elapsed+endlessReleaseInterval(state)};r.dispatchAt={};
}
export function endlessEvent(state:BattlefieldState,kind:'control'|'reserve'|'ended',text:string):void {
  const e=state.operation!.endless!;e.history.push({at:state.elapsed,kind,text});
  if(e.history.length>64)e.history.splice(0,e.history.length-64);
}
export function endEndlessBattle(state:BattlefieldState,cause:'player-ended'|'force-exhausted'='player-ended',side?:Faction):boolean {
  const op=state.operation,e=op?.endless;if(!e||op.battleMode!=='endless'||op.status!=='active')return false;
  e.ended={at:state.elapsed,cause,...(side?{side}:{})};op.status='ended';state.simSpeed=0;
  op.reason=cause==='player-ended'?'Battle concluded by the commander. No victor declared.':`${side==='player'?'Friendly':'Opposing'} force exhausted · no surviving personnel, pending arrivals or reserve.`;
  endlessEvent(state,'ended',op.reason);return true;
}
/** Sole owner of Endless outcomes/history. No mission evaluator is invoked. */
export function stepEndlessController(state:BattlefieldState):void {
  const op=state.operation!,e=op.endless!,r=op.campaign!.replacements!;
  stepEndlessAvailability(state);
  if(state.elapsed<e.nextAccounting)return;e.nextAccounting=state.elapsed+1;
  for(const o of op.objectives){const previous=e.owners[o.id];if(previous===o.owner)continue;
    if(previous!=='neutral')e.statistics.lost[previous]++;
    if(o.owner!=='neutral')e.statistics.captured[o.owner]++;
    e.owners[o.id]=o.owner;endlessEvent(state,'control',`${o.name}: ${o.owner==='neutral'?'control lost':o.owner==='player'?'friendly control':'enemy control'}.`);
  }
  for(const side of ['player','enemy'] as const){
    e.statistics.reinforcements[side]=r.manifests.filter(m=>m.side===side&&!m.returning&&m.stage==='arrived').length;
    if(e.options.reinforcements!=='finite')continue;
    const ids=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
    // Recovery, evacuation and blocked arrivals are not irrecoverable defeat.
    if(!state.soldiers.some(s=>ids.has(s.squadId)&&s.needs?.life!=='dead')&&r.reserve[side]===0&&!r.manifests.some(m=>m.side===side&&m.stage!=='arrived')){
      endEndlessBattle(state,'force-exhausted',side);break;
    }
  }
}
