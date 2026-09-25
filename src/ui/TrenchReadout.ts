import {distanceToSegment,type Vec2,type BattlefieldState,type TrenchState} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';

/** A saved trench's array order is stable; use the same short name on every surface. */
export const trenchName=(state:BattlefieldState,id:number)=>`Trench ${String(state.trenches.findIndex(t=>t.id===id)+1).padStart(2,'0')}`;
export const networkName=(state:BattlefieldState,id:number)=>`Trench network ${String((state.living?.garrisons.filter(g=>g.faction!=='enemy').findIndex(g=>g.id===id)??-1)+1).padStart(2,'0')}`;
export const distanceToPolyline=(point:Vec2,points:Vec2[])=>({distance:points.slice(1).reduce((best,p,i)=>Math.min(best,distanceToSegment(point,points[i],p).distance),Infinity)});
export function friendlyTrenches(state:BattlefieldState,network:TrenchNetwork):TrenchState[]{
  return state.trenches.filter(t=>{
    if(state.squads.some(q=>q.id===t.engineerSquadId&&q.faction==='enemy'))return false;
    if(state.living?.facilities.some(f=>f.connectorId===t.id&&state.living?.garrisons.some(g=>g.id===f.garrisonId&&g.faction==='enemy')))return false;
    const component=network.component(t.id);
    return component===undefined||!state.living?.garrisons.some(g=>g.faction==='enemy'&&network.component(g.trenchId)===component);
  });
}
export function trenchPeople(state:BattlefieldState,network:TrenchNetwork,t:TrenchState){
  const component=network.component(t.id),garrisons=state.living?.garrisons.filter(g=>g.faction!=='enemy'&&component!==undefined&&network.component(g.trenchId)===component)??[];
  const builders=state.squads.filter(q=>q.faction!=='enemy'&&q.order.type==='construct-trench'&&(q.order.trenchId===t.id||q.engineerWork?.crews.some(c=>c.trenchId===t.id)));
  const built=excavatedPoints(t);
  return state.soldiers.filter(s=>s.needs?.life!=='dead'&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy')&&
    (garrisons.some(g=>g.id===s.garrisonId)||builders.some(q=>q.id===s.squadId)||built.length>1&&distanceToPolyline(s,built).distance<t.width/2));
}

/** Count this worksite, not everyone digging somewhere in its connected area. */
export function trenchWorkforce(state:BattlefieldState,t?:TrenchState){
  if(!t||t.status==='complete')return {digging:0,helpers:0};
  const crew=new Set(state.squads.filter(q=>q.faction!=='enemy'&&q.order.type==='construct-trench').flatMap(q=>q.engineerWork?
    q.engineerWork.crews.filter(c=>c.trenchId===t.id).flatMap(c=>c.soldierIds):q.order.trenchId===t.id?q.soldierIds:[]));
  const facilities=new Set(state.living?.facilities.filter(f=>f.connectorId===t.id).map(f=>f.id));
  const people=state.soldiers.filter(s=>s.health>0&&s.needs?.life!=='dead'&&(crew.has(s.id)||s.duty?.kind==='construct'&&facilities.has(s.duty.facilityId!)));
  return {digging:people.filter(s=>s.action==='digging').length,helpers:people.filter(s=>s.action==='clearing spoil').length};
}
