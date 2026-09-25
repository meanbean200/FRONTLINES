import {distanceToSegment,type Vec2,type BattlefieldState,type TrenchState} from '../core/types';
import {excavatedPoints} from '../core/TrenchGeometry';
import {TrenchNetwork} from '../garrison/TrenchNetwork';

/** A saved trench's array order is stable; use the same short name on every surface. */
export const trenchName=(state:BattlefieldState,id:number)=>`Trench ${String(state.trenches.findIndex(t=>t.id===id)+1).padStart(2,'0')}`;
const readoutGraphs=new WeakMap<BattlefieldState,TrenchNetwork>();
export const networkName=(state:BattlefieldState,id:number)=>{
  const g=state.living?.garrisons.find(g=>g.id===id);if(!g)return 'Unassigned network';
  let graph=readoutGraphs.get(state);if(!graph){graph=new TrenchNetwork();readoutGraphs.set(state,graph);}graph.sync(state.trenches);return connectedName(state,graph,g.trenchId);
};
export const connectedName=(state:BattlefieldState,network:TrenchNetwork,id:number)=>`${state.trenches.some(t=>network.anchor(t.id)===network.anchor(id)&&state.squads.some(q=>q.id===t.engineerSquadId&&q.faction==='enemy'))?'Captured network':'Network'} ${String(network.anchor(id)).padStart(3,'0')}${state.trenches.find(t=>t.id===id)?.status==='planned'?' · planned':''}`;
export function networkRepresentatives(trenches:TrenchState[],network:TrenchNetwork):TrenchState[]{
  const groups=new Map<number,TrenchState>();for(const t of trenches){const id=network.anchor(t.id),prior=groups.get(id);if(!prior||t.id<prior.id)groups.set(id,t);}return [...groups.values()];
}
export const distanceToPolyline=(point:Vec2,points:Vec2[])=>({distance:points.slice(1).reduce((best,p,i)=>Math.min(best,distanceToSegment(point,points[i],p).distance),Infinity)});
export function friendlyTrenches(state:BattlefieldState,network:TrenchNetwork):TrenchState[]{
  return state.trenches.filter(t=>{
    const component=network.component(t.id),owners=state.living?.garrisons.filter(g=>component!==undefined&&network.component(g.trenchId)===component)??[];
    if(owners.some(g=>g.faction!=='enemy'&&g.squadIds.length))return true;
    if(state.squads.some(q=>q.id===t.engineerSquadId&&q.faction==='enemy'))return false;
    if(state.living?.facilities.some(f=>f.connectorId===t.id&&state.living?.garrisons.some(g=>g.id===f.garrisonId&&g.faction==='enemy')))return false;
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
