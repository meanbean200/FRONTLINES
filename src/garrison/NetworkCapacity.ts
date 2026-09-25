import type {BattlefieldState} from '../core/types';
import type {TrenchNetwork} from './TrenchNetwork';

/** One accounting boundary for the inspector, assignment and reserve requests.
 * Living people retain their standing reservation during sleep, travel or evacuation.
 * Returning evacuees are already counted; new manifests reserve exactly one place. */
export function networkCapacity(state:BattlefieldState,network:TrenchNetwork,trenchId:number,side:'player'|'enemy'='player',selected:number[]=[]){
  const component=network.component(trenchId),groups=state.living?.garrisons.filter(g=>(g.faction??'player')===side&&component!==undefined&&network.component(g.trenchId)===component)??[];
  const groupIds=new Set(groups.map(g=>g.id)),squadIds=new Set([...groups.flatMap(g=>g.squadIds),...selected]);
  const people=state.soldiers.filter(s=>s.needs?.life!=='dead'&&(groupIds.has(s.garrisonId!)||selected.includes(s.squadId)));
  const manifests=state.operation?.campaign?.replacements?.manifests??[];
  const inbound=new Set(manifests.filter(m=>m.side===side&&m.stage!=='arrived'&&!m.returning&&squadIds.has(m.squadId)&&!people.some(s=>s.id===m.personId)).map(m=>m.personId)).size;
  const capacity=component===undefined?0:network.capacity(component);
  const present=people.filter(s=>{
    if(s.combat?.wound?.care==='evacuated'||s.combat?.wound?.care==='transport')return false;
    const near=network.nearest(s,component);
    return near!==undefined&&near.distance<=network.edges[near.edge].width*.43;
  }).length;
  return {capacity,assigned:people.length,present,inbound,reserved:people.length+inbound,free:Math.max(0,capacity-people.length-inbound),required:people.length+inbound};
}
export interface AssignmentResult {accepted:boolean;code:'accepted'|'unfinished'|'selection'|'enemy'|'capacity'|'route';reason:string;personId?:number}
