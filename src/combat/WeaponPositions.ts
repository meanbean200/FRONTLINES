import {distance,distanceToSegment,type BattlefieldState,type SoldierState} from '../core/types';
import {equipmentOf} from './Equipment';
import type {Facility} from '../garrison/types';
import {excavatedPoints} from '../core/TrenchGeometry';

export type WeaponPositionKind='emplacement'|'mortar';
export const isMountedGun=(state:BattlefieldState,s:SoldierState)=>['mg42','crew-mg'].includes(equipmentOf(state,s).weapon);
export function positionOperator(state:BattlefieldState,squadId:number,kind:WeaponPositionKind){
  return state.soldiers.find(s=>s.squadId===squadId&&s.needs?.life==='active'&&(kind==='mortar'?equipmentOf(state,s).mortar:isMountedGun(state,s)));
}
export function assignedWeaponPosition(state:BattlefieldState,squadId:number,kind:WeaponPositionKind):Facility|undefined{
  const side=state.squads.find(q=>q.id===squadId)?.faction??'player';
  return state.living?.facilities.find(f=>f.kind===kind&&f.weaponSquadId===squadId&&state.living!.garrisons.some(g=>g.id===f.garrisonId&&(g.faction??'player')===side&&g.squadIds.includes(squadId)));
}
/** Shared physical checks, not a renderer tag or a blanket trench bonus. */
export function weaponPositionReadiness(state:BattlefieldState,squadId:number,kind:WeaponPositionKind):string {
  const f=assignedWeaponPosition(state,squadId,kind),name=kind==='mortar'?'mortar pit':'MG nest';
  if(!f)return `Assign a built ${name} in Support`;
  const trench=state.trenches.find(t=>t.id===f.connectorId);
  if(!f.paid||f.progress<1||!trench||trench.status!=='complete'||trench.progress<1)return `${name} still under construction`;
  const operator=positionOperator(state,squadId,kind);
  if(!operator)return 'Weapon carrier out of action';
  if(operator.duty?.kind==='haul')return 'Weapon carrier finishing a physical supply delivery';
  if(operator.duty?.playerOrdered&&operator.duty.kind!=='watch')return 'Weapon carrier on a personal order · return to Area duties';
  const points=excavatedPoints(trench);
  const present=(s:SoldierState)=>s.needs?.life==='active'&&s.suppression<70&&!s.combat?.careTask&&s.action!=='sleeping'&&s.duty?.kind==='watch'&&s.duty.facilityId===f.id&&s.duty.arrivedAt!==undefined&&distance(s,f)<3.5&&points.some((p,i)=>i>0&&distanceToSegment(s,points[i-1],p).distance<trench.width/2);
  if(!present(operator))return `Crew moving to ${name}, resting or taking cover`;
  if(state.soldiers.filter(s=>s.squadId===squadId&&present(s)).length<2)return `Need 2 ready crew at ${name}`;
  return '';
}
