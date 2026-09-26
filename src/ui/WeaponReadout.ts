import {distance,type BattlefieldState,type SquadState} from '../core/types';
import {WEAPONS} from '../combat/Weapons';
import {equipmentOf} from '../combat/Equipment';
import {isMountedGun,positionReadiness,crewAt,crewOperator,weaponStock} from '../combat/WeaponPositions';
import {supportMissionText} from '../combat/SupportWeapons';
import type {Facility} from '../garrison/types';

/** A manned gun is not available for another order while its round is in flight. */
export function activeSupportMission(state:BattlefieldState,f:Facility){
  return state.operation?.supportMissions?.find(m=>m.positionId===f.id&&(m.stage==='preparing'||m.stage==='flight'));
}
export function supportPositionStatus(state:BattlefieldState,f:Facility,reason:string):string {
  const mission=activeSupportMission(state,f);if(mission)return supportMissionText(mission,state.elapsed);
  if(reason.startsWith('Need 2 ready crew')){
    const people=crewAt(state,f);
    if(people.filter(p=>p.needs?.life==='active').length<2)return 'Assistant out of action · replacement needed';
    if(people.some(p=>p.suppression>=70||['pinned','broken'].includes(p.combat?.reaction??'')))return 'Crew under heavy suppression · waiting for recovery';
    if(people.some(p=>p.action==='sleeping'||p.duty?.kind==='sleep'))return 'Crew resting · returns automatically';
    if(people.some(p=>p.duty?.kind==='meal'))return people.some(p=>p.duty?.reason==='Reload weapon ammunition from local stores')?'Assistant collecting ammunition':'Crew eating / drinking · returns automatically';
    if(people.some(p=>p.combat?.careTask))return 'Crew assisting a casualty';
    return 'Crew returning to the gun';
  }
  return reason.replace('No indirect he ammunition','No HE shells').replace('No indirect smoke ammunition','No smoke shells');
}

/** Presentation only: the gun never gains crew, targets or readiness from this readout. */
export function crewWeaponReadout(state:BattlefieldState,q:SquadState):string|undefined{
  const position=state.living?.facilities.find(f=>f.kind==='emplacement'&&crewAt(state,f).some(s=>s.squadId===q.id));
  const gunner=position?crewOperator(state,position):state.soldiers.find(s=>s.squadId===q.id&&['crew-mg','mg42','bar'].includes(equipmentOf(state,s).weapon));if(!gunner)return position?'No active gunner':undefined;
  if(gunner.needs?.life!=='active')return 'Gunner out of action';
  if(position||isMountedGun(state,gunner)){const reason=position?positionReadiness(state,position):'Assign a built MG position and its individual crew';if(reason)return reason;}
  const weapon=position?.installation?.weapon??gunner.combat?.weapon,def=WEAPONS[weapon?.id??equipmentOf(state,gunner).weapon];
  const crew=(position?crewAt(state,position):[gunner]).filter(s=>s.needs?.life==='active'&&s.action!=='sleeping'&&!s.combat?.careTask&&s.suppression<70&&distance(s,gunner)<10).length;
  if(gunner.suppression>=70)return 'Gunner pinned · cannot operate weapon';
  if(gunner.action==='sleeping')return 'Gunner sleeping · not on watch';
  if(crew<def.crew)return `Crew ${crew}/${def.crew} · regroup within 10 m of gunner`;
  if(q.order.type==='move'&&!gunner.personalArea||gunner.action.startsWith('walking'))return `Travelling · ${def.setup} s setup after stopping`;
  if(!weapon)return 'Awaiting weapon setup';
  if(weapon?.setupUntil&&weapon.setupUntil>state.elapsed)return `Setting up · ${Math.ceil(weapon.setupUntil-state.elapsed)} s · crew ${def.crew}/${def.crew}`;
  if((weaponStock(state,gunner)?.ammo??0)<1)return 'Gun out of ammunition · resupply needed';
  if(weapon?.reloadUntil&&weapon.reloadUntil>state.elapsed)return `Reloading · ${Math.ceil(weapon.reloadUntil-state.elapsed)} s`;
  if(gunner.duty&&gunner.duty.kind!=='watch')return `Gunner on ${gunner.duty.kind} duty · not firing`;
  return `${(gunner.lastShotAt??-Infinity)>state.elapsed-2?'Firing bursts':'Set · watching sector'} · crew ${def.crew}/${def.crew} · ${def.range} m maximum`;
}
/** Routine setup/reloading/aiming isn't an emergency; keep actual blocking reasons. */
export function actionableWeaponReason(reasons:string[]):string|undefined{
  return reasons.find(reason=>/pinned|broken|blocked|cannot|unavailable|no ammunition/i.test(reason));
}
