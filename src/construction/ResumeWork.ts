import {distance,type BattlefieldState,type SquadState,type TrenchState,type Vec2} from '../core/types';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';
import {reservedConstructionTeam} from './WorkAssignments';
import {squadHasEquipment} from '../combat/Equipment';

/** R is a local continuation, never a map-wide search or a new assignment. */
export function resumeWorkChoices(state:BattlefieldState,network:TrenchNetwork,q:SquadState,faces:(t:TrenchState)=>Vec2[],requested?:number){
  const people=state.soldiers.filter(s=>s.squadId===q.id),g=state.living?.garrisons.find(g=>g.squadIds.includes(q.id));
  const component=g&&network.component(g.trenchId);
  let reason=!squadHasEquipment(state,q,'tools')?'No fit tool carrier selected':q.faction==='enemy'?'Choose friendly personnel':q.order.type==='construct-trench'?'Already working':reservedConstructionTeam(state,q.id)?'Crew or work detail already assigned · select its position to change it':q.order.building||people.some(s=>s.building)?'Building order active · leave the building before digging':requested===undefined&&q.order.type==='move'?'Movement order active · choose a worksite explicitly':people.some(s=>s.duty?.playerOrdered&&s.duty.kind==='sleep')?'Ordered rest active · let the detail recover':'';
  const rows=state.trenches.filter(t=>t.status!=='complete'&&(requested===undefined||requested===t.id))
    .filter(t=>!state.squads.some(other=>other.faction==='enemy'&&other.id===t.engineerSquadId)&&!state.living?.facilities.some(f=>f.connectorId===t.id))
    .filter(t=>!state.squads.some(other=>other.order.type==='construct-trench'&&(other.order.trenchId===t.id||other.engineerWork?.crews.some(c=>c.trenchId===t.id)||(other.constructionQueue??[]).some(j=>typeof j==='number'?j===t.id:j.kind==='trench'&&j.id===t.id))))
    .map(t=>({trench:t,point:faces(t)[0]})).filter((r):r is {trench:TrenchState;point:Vec2}=>Boolean(r.point))
    .filter(r=>requested!==undefined||distance(q,r.point)<=80&&(component===undefined||network.component(r.trench.id)===component||r.trench.points.some(p=>(network.nearest(p,component)?.distance??Infinity)<r.trench.width/2)))
    .sort((a,b)=>Number(b.trench.engineerSquadId===q.id)-Number(a.trench.engineerSquadId===q.id)||distance(q,a.point)-distance(q,b.point)||a.trench.id-b.trench.id);
  if(!reason&&!rows.length)reason='No unfinished local work · choose a worksite in Positions';
  return {reason,candidates:reason?[]:rows};
}
