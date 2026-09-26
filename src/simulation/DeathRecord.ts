import type {BattlefieldState,SoldierState} from '../core/types';
import {inventory} from '../garrison/types';

export type DeathCause='combat-fire'|'artillery'|'deprivation'|'structural'|'other'|'legacy-unknown';
export interface DamageOrigin {cause:DeathCause;at:number;eventId?:number;shooterId?:number;squadId?:number;deprivation?:'hunger'|'thirst'}
export interface DeathRecord extends DamageOrigin {
  occurredAt:number;
  condition:{energy:number;hunger:number;thirst:number;healthBefore:number};
}
/** Physical cargo moves once; there is no second inventory ledger. */
export function dropCargo(state:BattlefieldState,s:SoldierState):void {
  if(!s.carried||!Object.values(s.carried).some(n=>n>0))return;
  state.living!.crates.push({id:state.nextEntityId++,x:s.x,z:s.z,stock:s.carried,droppedBy:s.id});s.carried=inventory();
}
/** The only live transition to death. Repeated damage must not count/drop twice. */
export function recordDeath(state:BattlefieldState,s:SoldierState,origin:DamageOrigin):void {
  if(s.needs!.life==='dead')return;
  s.death={...origin,occurredAt:state.elapsed,condition:{energy:s.needs!.energy,hunger:s.needs!.hunger,thirst:s.needs!.thirst,healthBefore:s.health}};
  s.health=0;s.needs!.life='dead';s.action='dead';delete s.duty;delete s.selfCare;delete s.survivalReason;
  state.living!.metrics.deaths++;dropCargo(state,s);
}
export function deathDescription(s:SoldierState):string {
  if(s.needs?.life!=='dead')return '';
  const d=s.death;
  if(!d||d.cause==='legacy-unknown')return 'Cause not recorded in this older save';
  if(d.cause==='deprivation')return d.deprivation==='thirst'?'Died from prolonged dehydration':'Died from prolonged starvation';
  return ({'combat-fire':'Died from combat wounds',artillery:'Died from artillery wounds',structural:'Died in a structural event',other:'Died from another modeled cause'} as const)[d.cause];
}
export function validDeathRecord(s:SoldierState,elapsed:number):boolean {
  const d=s.death;if(!d)return true;
  const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  return !!d&&s.needs?.life==='dead'&&validDamageOrigin(d,elapsed)&&number(d.occurredAt)&&d.occurredAt<=elapsed+.001&&d.at<=d.occurredAt&&!!d.condition&&
    Object.values(d.condition).length===4&&['energy','hunger','thirst','healthBefore'].every(k=>number(d.condition[k as keyof typeof d.condition])&&d.condition[k as keyof typeof d.condition]<=100);
}
export function validDamageOrigin(d:DamageOrigin,elapsed:number):boolean {
  return !!d&&['combat-fire','artillery','deprivation','structural','other','legacy-unknown'].includes(d.cause)&&Number.isFinite(d.at)&&d.at>=0&&d.at<=elapsed+.001&&
    [d.eventId,d.shooterId,d.squadId].every(v=>v===undefined||Number.isSafeInteger(v)&&v>=0)&&
    (d.deprivation===undefined||d.cause==='deprivation'&&['hunger','thirst'].includes(d.deprivation));
}
