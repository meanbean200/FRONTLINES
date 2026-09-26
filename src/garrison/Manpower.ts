import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {equipmentOf} from '../combat/Equipment';
import {positionReadiness} from '../combat/WeaponPositions';
import {committedToAssault} from '../operations/AssaultPlan';

export const needsRecovery=(s:SoldierState)=>s.needs?.life!=='active'||s.health<25||(s.needs?.energy??100)<25||Math.max(s.needs?.hunger??0,s.needs?.thirst??0)>=85||Boolean(s.selfCare)||
  s.suppression>=70||['pinned','broken'].includes(s.combat?.reaction??'')||
  ['sleep','meal'].includes(s.duty?.kind??'')||s.duty?.rationUntil!==undefined||['sleeping','eating','incapacitated','evacuated'].includes(s.action)||
  ['disabling','critical','fatal'].includes(s.combat?.wound?.severity??'');

/** A duty label is not evidence of a fit, armed person occupying that duty. */
export function readyWatch(state:BattlefieldState,s:SoldierState):boolean{
  if(needsRecovery(s)||s.suppression>=70||['pinned','broken'].includes(s.combat?.reaction??'')||['casualty','reaction'].includes(s.combat?.owner??'')||s.combat?.careTask)return false;
  const d=s.duty;if(d?.kind!=='watch'||d.arrivedAt===undefined||distance(s,d.destination)>3)return false;
  const f=state.living?.facilities.find(f=>f.weaponCrewIds?.includes(s.id));
  if(f)return !positionReadiness(state,f);
  return equipmentOf(state,s).weapon!=='unarmed'&&(state.operation?(s.carried?.ammo??0):s.ammunition)>0;
}

export type ManpowerPool='stationCrew'|'workers'|'available'|'recovering'|'assault';
/** Exclusive totals; reservation badges remain on the original people/posts. */
export function manpowerPools(state:BattlefieldState,people:SoldierState[]){
  const pools:Record<ManpowerPool,number[]>={stationCrew:[],workers:[],available:[],recovering:[],assault:[]};
  const crew=new Set(state.living?.facilities.flatMap(f=>[...(f.weaponCrewIds??[]),...(f.crewRelief?[f.crewRelief.incomingId]:[])])),workers=new Set(state.living?.facilities.filter(f=>f.progress<1&&f.workOrder?.cancelledAt===undefined).flatMap(f=>f.workOrder?.workerIds??[]));
  for(const s of people){
    if(s.needs?.life==='dead')continue;
    const q=state.squads.find(q=>q.id===s.squadId);
    const pool:ManpowerPool=needsRecovery(s)?'recovering':committedToAssault(state,s)||q?.order.intent==='assault'&&!s.duty?'assault':crew.has(s.id)?'stationCrew':s.combat?.careTask||workers.has(s.id)||s.duty?.kind==='construct'||s.duty?.kind==='haul'||s.assaultHold===undefined&&q?.order.type==='construct-trench'?'workers':'available';
    pools[pool].push(s.id);
  }
  return pools;
}
