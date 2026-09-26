import {type BattlefieldState,type Vec2} from '../core/types';
import type {TacticalIntent} from '../combat/types';
import {validRaid,type TrenchRaid} from './TrenchRaid';
export interface PreparedOrder {squadId:number;intent:TacticalIntent;target:Vec2;networkId?:number;preparedAt:number;signalAt?:number;releasedAt?:number;raid?:TrenchRaid}
export function preparedStatus(state:BattlefieldState,o:PreparedOrder):string {
  const people=state.soldiers.filter(s=>s.squadId===o.squadId&&s.needs?.life==='active');
  if(!people.length)return 'UNAVAILABLE · no fit personnel';
  if(o.raid&&['regrouping','failed','secured'].includes(o.raid.phase))return o.raid.reason;
  if(people.every(s=>['pinned','broken'].includes(s.combat?.reaction??'')))return 'PINNED · waiting for recovery';
  if(o.raid)return o.raid.reason;
  if(o.releasedAt!==undefined)return 'GO · order released';
  return o.signalAt!==undefined?'SIGNAL RECEIVED':'WAIT FOR SIGNAL';
}
export function validPreparedOrders(state:BattlefieldState):boolean {
  const orders=state.preparedOrders;if(!orders)return true;
  return Array.isArray(orders)&&orders.length<=state.squads.length&&orders.every(o=>o&&typeof o==='object')&&new Set(orders.map(o=>o.squadId)).size===orders.length&&orders.every(o=>state.squads.some(q=>q.id===o.squadId&&q.faction!=='enemy')&&['move','observe','suppress','assault','fall-back'].includes(o.intent)&&Number.isFinite(o.target?.x)&&Number.isFinite(o.target?.z)&&Math.abs(o.target.x)<=2000&&Math.abs(o.target.z)<=2000&&Number.isFinite(o.preparedAt)&&o.preparedAt>=0&&o.preparedAt<=state.elapsed&&[o.signalAt,o.releasedAt].every(v=>v===undefined||Number.isFinite(v)&&v>=o.preparedAt&&v<=state.elapsed)&&(o.networkId===undefined||Number.isInteger(o.networkId)&&o.networkId>0)&&(o.releasedAt===undefined||o.signalAt!==undefined&&o.releasedAt>=o.signalAt)&&validRaid(state,o));
}
