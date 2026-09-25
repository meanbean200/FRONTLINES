import {distance,distanceToSegment,type BattlefieldState,type SoldierState} from '../core/types';
import {equipmentOf} from './Equipment';
import type {Facility,Resource} from '../garrison/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import {WEAPON_POSITIONS} from '../construction/PositionDefinitions';
import {transfer} from '../garrison/Inventory';

export type WeaponPositionKind='emplacement'|'mortar';
export const isMountedGun=(state:BattlefieldState,s:SoldierState)=>['mg42','crew-mg'].includes(equipmentOf(state,s).weapon);
export const carriesPositionWeapon=(state:BattlefieldState,s:SoldierState,kind:WeaponPositionKind)=>kind==='mortar'?equipmentOf(state,s).mortar:isMountedGun(state,s);
export function positionOperator(state:BattlefieldState,squadId:number,kind:WeaponPositionKind){return state.soldiers.find(s=>s.squadId===squadId&&s.needs?.life==='active'&&carriesPositionWeapon(state,s,kind));}
export function crewAt(state:BattlefieldState,f:Facility):SoldierState[]{return (f.weaponCrewIds??[]).flatMap(id=>{const s=state.soldiers.find(s=>s.id===id);return s?[s]:[];});}
export function crewOperator(state:BattlefieldState,f:Facility){return crewAt(state,f).find(s=>s.needs?.life==='active');}
export function operatedPosition(state:BattlefieldState,s:SoldierState,kind:WeaponPositionKind){return state.living?.facilities.find(f=>f.kind===kind&&f.installation&&crewOperator(state,f)?.id===s.id);}
export const weaponStock=(state:BattlefieldState,s:SoldierState)=>operatedPosition(state,s,'emplacement')?.stock??s.carried;
/** Read-only access for support coordination, diagnostics and presentation. */
export const currentWeapon=(state:BattlefieldState,s:SoldierState)=>operatedPosition(state,s,'emplacement')?.installation?.weapon??s.combat?.weapon;
/** Idempotent physical ownership conversion. Never grants ammunition or teleports a mobile kit. */
export function installPositionWeapons(state:BattlefieldState,deliver=false):void {
  for(const f of state.living?.facilities??[]){
    if(!['emplacement','mortar'].includes(f.kind)||!f.paid||f.progress<1)continue;
    if(!f.installation&&f.includesWeapon)f.installation={kind:f.artillery?'field-gun':f.kind==='mortar'?'mortar':'crew-mg',source:'construction'};
    let migrated=false;
    if(!f.installation){
      const carrier=crewAt(state,f).find(s=>carriesPositionWeapon(state,s,f.kind as WeaponPositionKind)&&distance(s,f)<4);
      if(!carrier)continue;
      carrier.equipment??=equipmentOf(state,carrier);
      f.installation={kind:f.kind==='mortar'?'mortar':carrier.equipment.weapon as 'mg42'|'crew-mg',source:'legacy-kit',personId:carrier.id};
      if(f.kind==='mortar')carrier.equipment.mortar=false;
      else {f.installation.weapon=carrier.combat?.weapon;carrier.equipment.weapon='unarmed';if(carrier.combat)delete carrier.combat.weapon;}
      state.living!.migrationNote='Existing weapon kit installed at its physical post. Crew and all ammunition retained; no weapon or stock duplicated.';
      migrated=true;
    }
    if(deliver||migrated)for(const s of crewAt(state,f))if(s.needs?.life==='active'&&s.carried&&distance(s,f)<4&&s.duty?.facilityId===f.id&&s.duty.arrivedAt!==undefined){
      for(const key of (f.kind==='mortar'?['mortarHE','mortarSmoke']:['ammo']) as Resource[])transfer(s.carried,f.stock,key,Math.max(0,(key==='ammo'?120:key==='mortarHE'?8:4)-f.stock[key]));
      s.ammunition=s.carried.ammo;
    }
  }
}
export function assignedWeaponPosition(state:BattlefieldState,squadId:number,kind:WeaponPositionKind):Facility|undefined{
  return state.living?.facilities.find(f=>f.kind===kind&&crewOperator(state,f)?.squadId===squadId);
}
/** Shared person-level readiness: a squad tag cannot grant a mounted weapon. */
export function positionReadiness(state:BattlefieldState,f:Facility):string {
  if(!['emplacement','mortar'].includes(f.kind))return 'Not a weapon position';
  const kind=f.kind as WeaponPositionKind,t=state.trenches.find(t=>t.id===(f.trenchAnchor?.trenchId??f.connectorId));
  if(!f.paid||f.progress<1||!t||!f.trenchAnchor&&t.progress<1)return 'POSITION NOT COMPLETE';
  const people=crewAt(state,f),operator=crewOperator(state,f);
  if(!f.installation)return 'NO INSTALLED WEAPON · bring the existing equipment carrier to this legacy post';
  if(!operator)return 'NO GUNNER · assign nearby personnel';
  if(people.filter(s=>s.needs?.life==='active').length<WEAPON_POSITIONS[kind].crew)return 'NO ASSISTANT';
  if(people.some(s=>s.suppression>=70||['pinned','broken'].includes(s.combat?.reaction??'')))return 'PINNED';
  if(people.some(s=>s.duty?.kind==='sleep'||s.action==='sleeping'||(s.needs?.energy??100)<15))return 'RESTING';
  if(people.some(s=>s.duty?.kind==='meal'&&s.duty.reason==='Reload weapon ammunition from local stores'))return 'RESUPPLYING · waiting for physical ammunition delivery';
  const points=excavatedPoints(t);
  const present=(s:SoldierState)=>s.needs?.life==='active'&&!s.combat?.careTask&&s.duty?.kind==='watch'&&s.duty.facilityId===f.id&&s.duty.arrivedAt!==undefined&&distance(s,f)<4&&points.some((p,i)=>i>0&&distanceToSegment(s,points[i-1],p).distance<t.width/2);
  if(!people.every(present))return 'MOVING TO POSITION';
  if(kind==='emplacement'&&f.stock.ammo<1)return 'OUT OF AMMO';
  if(kind==='mortar'&&f.stock.mortarHE+f.stock.mortarSmoke<1)return 'OUT OF AMMO';
  return '';
}
export function weaponPositionReadiness(state:BattlefieldState,squadId:number,kind:WeaponPositionKind):string {
  const f=assignedWeaponPosition(state,squadId,kind);return f?positionReadiness(state,f):`Assign a built ${kind==='mortar'?'artillery position':'MG position'} and its individual crew`;
}
/** Only historical squad assignments are translated; no people, stock or coordinates change. */
export function migrateWeaponCrews(state:BattlefieldState):void {
  const claimed=new Set(state.living?.facilities.flatMap(f=>f.weaponCrewIds??[])??[]);let migrated=0,empty=0;
  for(const f of state.living?.facilities??[]){
    if(f.weaponSquadId===undefined)continue;
    if(f.weaponCrewIds===undefined){
      const kind=f.kind as WeaponPositionKind,g=state.living!.garrisons.find(g=>g.id===f.garrisonId),q=state.squads.find(q=>q.id===f.weaponSquadId);
      const people=state.soldiers.filter(s=>s.squadId===q?.id&&s.needs?.life==='active'&&!claimed.has(s.id)&&!s.combat?.careTask);
      const operator=f.installation?people[0]:people.find(s=>carriesPositionWeapon(state,s,kind)),helper=people.filter(s=>s!==operator).sort((a,b)=>Number(b.duty?.facilityId===f.id)-Number(a.duty?.facilityId===f.id)||a.id-b.id)[0];
      f.weaponCrewIds=operator&&helper&&g&&(g.faction??'player')===(q?.faction??'player')?[operator.id,helper.id]:[];
      for(const id of f.weaponCrewIds)claimed.add(id);if(f.weaponCrewIds.length)migrated++;else empty++;
    }delete f.weaponSquadId;
  }
  if(migrated||empty)state.living!.migrationNote=(state.living!.migrationNote??'')+` Weapon positions migrated: ${migrated} existing crews retained, ${empty} left uncrewed for review. No personnel, equipment or ammunition added or moved.`;
}
