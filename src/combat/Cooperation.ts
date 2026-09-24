import {distance,type BattlefieldState} from '../core/types';
import {squadContacts} from '../operations/Visibility';

/** Stable alternating groups. Covering fire is evidenced by actual useful
 * rounds, not simply by labeling another squad 'support'. */
export function coordinateMovement(state:BattlefieldState):void {
  const op=state.operation;if(!op)return;
  for(const q of state.squads){
    if(q.kind!=='rifle'||q.order.type!=='move'||q.order.pushThrough||q.order.intent==='fall-back')continue;
    const people=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active'),side=q.faction??'player';
    const threats=squadContacts(state,q.id).filter(c=>c.active&&c.visible&&distance(c,q)<300);
    if(!threats.length){if(q.tactics)delete q.tactics;continue;}
    const t=q.tactics??={group:0,switchAt:state.elapsed+10};
    if(state.elapsed>=t.switchAt){t.group=t.group===0?1:0;t.switchAt=state.elapsed+10;}
    const support=people.filter(s=>q.soldierIds.indexOf(s.id)%2!==t.group),moving=people.filter(s=>!support.includes(s));
    const useful=(s:typeof people[number])=>(s.combat?.weapon?.effectiveUntil??0)>state.elapsed&&Boolean(s.combat?.weapon?.effectivePoint&&threats.some(c=>distance(c,s.combat!.weapon!.effectivePoint!)<45));
    const effective=support.some(s=>useful(s)&&(s.carried?.ammo??0)>0&&s.suppression<70);
    const otherSupport=state.soldiers.some(s=>s.squadId!==q.id&&state.squads.some(other=>other.id===s.squadId&&(other.faction??'player')===side)&&distance(s,q)<150&&useful(s)&&s.needs?.life==='active');
    for(const s of support)if(s.combat?.owner==='order'){s.combat.owner='reaction';s.combat.pauseReason='Covering moving group';s.action='covering fire';}
    if(!effective&&!otherSupport)for(const s of moving)if(s.combat?.owner==='order'){s.combat.owner='reaction';s.combat.pauseReason='Waiting for covering fire';s.action='waiting for covering fire';}
  }
}
