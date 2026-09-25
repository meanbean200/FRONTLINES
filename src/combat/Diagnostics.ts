import type {BattlefieldState} from '../core/types';
import {distance} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {crewAt,crewOperator,positionReadiness,currentWeapon} from './WeaponPositions';
import {canSpot,squadContacts} from '../operations/Visibility';
import {clearAimPoint,muzzlePoint} from './Ballistics';
import {WEAPONS} from './Weapons';

/** Explicit developer readout. Never supplies new information to a commander. */
export function combatDiagnostics(state:BattlefieldState,terrain?:TerrainSystem){
  return {
    at:state.elapsed,
    soldiers:state.soldiers.map(s=>({id:s.id,squadId:s.squadId,position:{x:s.x,z:s.z},
      posture:s.posture??'standing',reaction:s.combat?.reaction??'steady',owner:s.combat?.owner??'order',
      suppression:s.suppression,morale:s.morale,threatDirection:s.combat?.threatDirection,
      desiredCover:s.combat?.reactionRoute?.[s.combat.reactionIndex??0],
      stoppedReason:s.combat?.pauseReason??squadReason(state,s.squadId),action:s.action,equipment:s.equipment,weaponInUse:currentWeapon(state,s)?.id??'not equipped',coverTests:s.combat?.coverTests??0})),
    support:(state.operation?.supportMissions??[]).map(m=>({...m,source:m.source??'LEGACY_UNKNOWN',ammoConsumed:m.ammoConsumed??null})),
    requests:structuredClone(state.operation?.supportRequests??[]),
    positions:(state.living?.facilities??[]).filter(f=>['emplacement','mortar'].includes(f.kind)).map(f=>{
      const operator=crewOperator(state,f),crew=crewAt(state,f),weapon=f.installation?.weapon;
      const observed=operator?squadContacts(state,operator.squadId):[];
      const targets=observed.map(c=>{const t=state.soldiers.find(s=>s.id===c.soldierId),range=operator?distance(operator,c):0;return {id:c.soldierId,reportVisible:c.visible,reportAge:state.elapsed-c.lastSeen,range,
        inSector:operator?Math.cos(Math.atan2(c.x-operator.x,c.z-operator.z)-(f.facing??0))>=.34:false,
        visible:!!(terrain&&operator&&t&&c.visible&&canSpot(state,terrain,operator,t)),clearMuzzle:!!(terrain&&operator&&t&&c.visible&&clearAimPoint(terrain,operator,t))};});
      return {id:f.id,kind:f.kind,facing:f.facing,installation:f.installation,readyStock:{...f.stock},readiness:positionReadiness(state,f)||'READY',reason:positionReadiness(state,f)||operator?.combat?.pauseReason||'No observed target',operatorId:operator?.id,
        crew:crew.map(s=>({id:s.id,equipment:s.equipment,x:s.x,z:s.z,suppression:s.suppression,duty:s.duty,ammo:s.carried?.ammo,he:s.carried?.mortarHE,smoke:s.carried?.mortarSmoke})),
        range:weapon?WEAPONS[weapon.id].range:undefined,cooldown:operator?.nextShotAt,weapon,muzzle:terrain&&operator?muzzlePoint(terrain,operator):undefined,targets,
        missions:state.operation?.supportMissions?.filter(m=>m.positionId===f.id)};
    }),
  };
}
function squadReason(state:BattlefieldState,id:number){return state.squads.find(q=>q.id===id)?.orderNote??'';}
