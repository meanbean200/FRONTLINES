import {distance,type BattlefieldState,type SquadState} from '../core/types';
import {WEAPONS} from '../combat/Weapons';
import {equipmentOf} from '../combat/Equipment';
import {isMountedGun,weaponPositionReadiness} from '../combat/WeaponPositions';

/** Presentation only: the gun never gains crew, targets or readiness from this readout. */
export function crewWeaponReadout(state:BattlefieldState,q:SquadState):string|undefined{
  const gunner=state.soldiers.find(s=>s.squadId===q.id&&['crew-mg','mg42','bar'].includes(equipmentOf(state,s).weapon));if(!gunner)return undefined;
  if(gunner.needs?.life!=='active')return 'Gunner out of action';
  if(isMountedGun(state,gunner)){const reason=weaponPositionReadiness(state,q.id,'emplacement');if(reason)return reason;}
  const weapon=gunner.combat?.weapon,def=WEAPONS[equipmentOf(state,gunner).weapon];
  const crew=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active'&&s.action!=='sleeping'&&!s.combat?.careTask&&s.suppression<70&&distance(s,gunner)<10).length;
  if(gunner.suppression>=70)return 'Gunner pinned · cannot operate weapon';
  if(gunner.action==='sleeping')return 'Gunner sleeping · not on watch';
  if(crew<def.crew)return `Crew ${crew}/${def.crew} · regroup within 10 m of gunner`;
  if(q.order.type==='move'||gunner.action.startsWith('walking'))return `Travelling · ${def.setup} s setup after stopping`;
  if(!weapon)return 'Awaiting weapon setup';
  if(weapon?.setupUntil&&weapon.setupUntil>state.elapsed)return `Setting up · ${Math.ceil(weapon.setupUntil-state.elapsed)} s · crew ${def.crew}/${def.crew}`;
  if((gunner.carried?.ammo??0)<1)return 'Gun out of ammunition · resupply needed';
  if(weapon?.reloadUntil&&weapon.reloadUntil>state.elapsed)return `Reloading · ${Math.ceil(weapon.reloadUntil-state.elapsed)} s`;
  if(gunner.duty&&gunner.duty.kind!=='watch')return `Gunner on ${gunner.duty.kind} duty · not firing`;
  return `${(gunner.lastShotAt??-Infinity)>state.elapsed-2?'Firing bursts':'Set · watching sector'} · crew ${def.crew}/${def.crew} · ${def.range} m maximum`;
}
/** Routine setup/reloading/aiming isn't an emergency; keep actual blocking reasons. */
export function actionableWeaponReason(reasons:string[]):string|undefined{
  return reasons.find(reason=>/pinned|broken|blocked|cannot|unavailable|no ammunition/i.test(reason));
}
