import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {equipmentOf} from '../combat/Equipment';
import {positionReadiness} from '../combat/WeaponPositions';

/** Shared by scheduling readouts and assault queries. Waiting is not sleeping. */
export const needsRecovery=(s:SoldierState)=>s.needs?.life!=='active'||s.health<25||(s.needs?.energy??100)<25||Math.max(s.needs?.hunger??0,s.needs?.thirst??0)>=85||Boolean(s.selfCare)||
  s.suppression>=70||['pinned','broken'].includes(s.combat?.reaction??'')||
  ['sleep','meal'].includes(s.duty?.kind??'')||s.duty?.rationUntil!==undefined||['sleeping','eating','incapacitated','evacuated'].includes(s.action)||
  ['disabling','critical','fatal'].includes(s.combat?.wound?.severity??'');

export function stationCrewIds(state:BattlefieldState):Set<number>{
  return new Set(state.living?.facilities.flatMap(f=>[...(f.weaponCrewIds??[]),...(f.crewRelief?[f.crewRelief.incomingId]:[])]));
}

/** A personal post supersedes a formation's excavation order, not its identity. */
export function isExcavationWorker(state:BattlefieldState,s:SoldierState):boolean{
  return s.assaultHold===undefined&&!s.personalArea&&!s.duty?.playerOrdered&&state.squads.some(q=>q.id===s.squadId&&q.order.type==='construct-trench');
}

export function isWorking(state:BattlefieldState,s:SoldierState):boolean{
  return Boolean(s.combat?.careTask||state.living?.facilities.some(f=>f.progress<1&&f.workOrder?.cancelledAt===undefined&&f.workOrder?.workerIds.includes(s.id))||
    ['construct','haul'].includes(s.duty?.kind??'')||isExcavationWorker(state,s));
}

/** Present, fit, armed observation/fighting or ready reserve; never assignment alone. */
export function readyDefender(state:BattlefieldState,s:SoldierState):boolean{
  if(needsRecovery(s)||s.combat?.careTask||['casualty','reaction'].includes(s.combat?.owner??''))return false;
  const d=s.duty;
  if(!d||!['watch','rest'].includes(d.kind)||d.arrivedAt===undefined||distance(s,d.destination)>3||d.entryPending||d.exitPending||d.relocationExit)return false;
  const f=state.living?.facilities.find(f=>f.weaponCrewIds?.includes(s.id));
  if(f)return !positionReadiness(state,f);
  return equipmentOf(state,s).weapon!=='unarmed'&&(state.operation?(s.carried?.ammo??0):s.ammunition)>0;
}
