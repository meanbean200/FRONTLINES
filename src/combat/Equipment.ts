import type {BattlefieldState,SoldierState,SquadState} from '../core/types';
import type {WeaponId} from './Weapons';
import {armyFor} from '../operations/BattleSetup';

/** Physical personal kit; ammunition and consumables remain in carried inventory.
 * A kit stays with its person, including casualties. No class-dependent refill. */
export interface InfantryEquipment {version:1;weapon:WeaponId;tools:boolean;mortar:boolean;medicalKit:boolean}
export type EquipmentCapability='tools'|'mortar'|'medicalKit'|'automatic';
/** Compatibility adapter ONLY for saves/entities without explicit equipment. */
export function legacyEquipment(state:BattlefieldState,s:SoldierState):InfantryEquipment{
  const q=state.squads.find(q=>q.id===s.squadId),i=q?.soldierIds.indexOf(s.id)??0,german=armyFor(state,q?.faction??'player')==='german';
  return {version:1,weapon:s.combat?.weapon?.id??(q?.kind==='machinegun'&&i===0?'crew-mg':q?.kind==='rifle'&&i===1?(german?'mg42':'bar'):q?.kind==='rifle'&&i===7?'smg':german?'kar98k':'m1'),
    tools:q?.kind==='engineer',mortar:q?.kind==='mortar'&&i===0,medicalKit:q?.kind==='medical'};
}
export const equipmentOf=(state:BattlefieldState,s:SoldierState):InfantryEquipment=>s.equipment??legacyEquipment(state,s);
export function initializeEquipment(state:BattlefieldState):void{for(const s of state.soldiers)s.equipment??=legacyEquipment(state,s);}
export function hasEquipment(state:BattlefieldState,s:SoldierState,kind:EquipmentCapability):boolean{
  const kit=equipmentOf(state,s);return kind==='automatic'?['bar','mg42','crew-mg'].includes(kit.weapon):kit[kind];
}
export function squadHasEquipment(state:BattlefieldState,q:SquadState,kind:EquipmentCapability):boolean{
  return state.soldiers.some(s=>s.squadId===q.id&&s.health>0&&(!s.needs||s.needs.life==='active')&&hasEquipment(state,s,kind));
}
