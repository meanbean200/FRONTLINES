import { distance, type BattlefieldState, type SoldierState } from '../core/types';
import type { Garrison } from '../garrison/types';
import { localInventory } from '../garrison/Inventory';
import type { TrenchNetwork } from '../garrison/TrenchNetwork';
import { factionOf } from '../operations/types';

/** Presence is physical shelter, not a squad's reservation or garrison membership. */
export function trenchPresence(state:BattlefieldState,network:TrenchNetwork):Map<number,number> {
  const counts=new Map<number,number>(),friendly=new Set(state.squads.filter(q=>factionOf(q)==='player').map(q=>q.id));
  for(const s of state.soldiers){
    if(!friendly.has(s.squadId)||s.needs?.life==='dead'||s.cover!=='trench')continue;
    const nearest=network.nearest(s);if(!nearest)continue;
    const edge=network.edges[nearest.edge];if(nearest.distance>edge.width/2)continue;
    const component=network.nodes[edge.a].component;counts.set(component,(counts.get(component)??0)+1);
  }
  return counts;
}

/** Presentation only: a withdrawal changes where stock is usable, not its ownership. */
export function garrisonSupplyReadout(state:BattlefieldState,g:Garrison){
  const withdrawn=g.cutoff==='withdraw',people=state.soldiers.filter(s=>s.garrisonId===g.id&&s.needs?.life!=='dead');
  const stock=withdrawn?{...g.forwardStock}:localInventory(state,g);
  const issue=!withdrawn?g.supplyIssue:stock.food<1?'Withdrawal point: food exhausted · recovery slightly slower':people.some(s=>s.needs!.hunger>80)?'Food awaits at the withdrawal point; personnel still need access':undefined;
  return {stock,issue,label:withdrawn?'Withdrawal point':'Trench stores',endurance:stock.food/Math.max(1,people.length)*10};
}

export function withdrawalProgress(g:Garrison,people:SoldierState[]):string {
  const living=people.filter(s=>s.garrisonId===g.id&&s.needs?.life!=='dead');
  const arrived=living.filter(s=>s.duty?.arrivedAt!==undefined&&distance(s,g.forward)<10).length;
  return `Withdrawal · ${arrived}/${living.length} at supply point`;
}

export function relocationProgress(people:SoldierState[]):string|undefined {
  const active=people.filter(s=>s.needs?.life==='active'),travelling=active.filter(s=>s.duty?.relocationExit).length;
  return travelling?`Relocating · ${travelling}/${active.length} still en route`:undefined;
}
