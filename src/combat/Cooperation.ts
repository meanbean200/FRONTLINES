import {distance,type BattlefieldState} from '../core/types';
import {squadContacts} from '../operations/Visibility';
import {currentWeapon,weaponStock} from './WeaponPositions';
import {assaultSquad,detachedFromFormation} from '../operations/AssaultPlan';

/** Stable alternating groups. Covering fire is evidenced by actual useful
 * rounds, not simply by labeling another squad 'support'. */
export function coordinateMovement(state:BattlefieldState):void {
  const op=state.operation;if(!op)return;
  const detachments=(state.preparedOrders??[]).flatMap(o=>o.assault?.march&&o.assault.phase!=='secured'?[assaultSquad(state.squads.find(q=>q.id===o.squadId)!,o.assault)]:[]);
  for(const q of [...state.squads,...detachments]){
    if(q.order.type!=='move'||q.order.pushThrough||q.order.intent==='fall-back')continue;
    const people=state.soldiers.filter(s=>q.soldierIds.includes(s.id)&&s.needs?.life==='active'&&(detachments.includes(q)||!detachedFromFormation(state,s))),side=q.faction??'player';
    const threats=squadContacts(state,q.id).filter(c=>c.active&&c.visible&&distance(c,q)<300);
    if(!threats.length){if(q.tactics)delete q.tactics;if(detachments.includes(q)){const a=state.preparedOrders?.find(o=>o.squadId===q.id)?.assault;if(a?.march)delete a.march.tactics;}continue;}
    const t=q.tactics??={group:0,switchAt:state.elapsed+10};
    if(detachments.includes(q)){const a=state.preparedOrders?.find(o=>o.squadId===q.id)?.assault;if(a?.march)a.march.tactics=t;}
    if(state.elapsed>=t.switchAt){t.group=t.group===0?1:0;t.switchAt=state.elapsed+10;}
    const support=people.filter(s=>q.soldierIds.indexOf(s.id)%2!==t.group),moving=people.filter(s=>!support.includes(s));
    const useful=(s:typeof people[number])=>{const w=currentWeapon(state,s);return (w?.effectiveUntil??0)>state.elapsed&&Boolean(w?.effectivePoint&&threats.some(c=>distance(c,w.effectivePoint!)<45));};
    const effective=support.some(s=>useful(s)&&(weaponStock(state,s)?.ammo??0)>0&&s.suppression<70);
    const otherSupport=state.soldiers.some(s=>s.squadId!==q.id&&state.squads.some(other=>other.id===s.squadId&&(other.faction??'player')===side)&&distance(s,q)<150&&useful(s)&&s.needs?.life==='active');
    for(const s of support)if(s.combat?.owner==='order'){s.combat.owner='reaction';s.combat.pauseReason='Covering moving group';s.action='covering fire';}
    // A short wait permits the supporting group to settle. Without effective
    // fire it is NOT safe, but neither is indefinite exposed paralysis. The
    // moving group resumes cautiously; pinning still has higher authority.
    if(!effective&&!otherSupport&&state.elapsed<t.switchAt-7.5){for(const s of moving)if(s.combat?.owner==='order'){s.combat.owner='reaction';s.combat.pauseReason='Waiting briefly for covering fire';s.action='waiting for covering fire';s.posture='crouched';}}
    else if(!effective&&!otherSupport){for(const s of moving)if(s.combat?.owner==='order')s.posture='crouched';}
  }
}
