import type {BattlefieldState,SoldierState} from './types';

const soldiers=new WeakMap<BattlefieldState,{array:SoldierState[];length:number;indices:Map<number,number>}>();
/** Live object lookup, not a cached simulation decision. In-place death, care,
 * transfer and crew changes are immediately visible. Reorders repair the index. */
export function soldierById(state:BattlefieldState,id:number):SoldierState|undefined {
  let saved=soldiers.get(state);
  if(!saved||saved.array!==state.soldiers||saved.length!==state.soldiers.length){
    saved={array:state.soldiers,length:state.soldiers.length,indices:new Map(state.soldiers.map((s,i)=>[s.id,i]))};soldiers.set(state,saved);
  }
  const index=saved.indices.get(id),person=index===undefined?undefined:state.soldiers[index];
  if(person?.id===id)return person;
  const found=state.soldiers.findIndex(s=>s.id===id);if(found<0){saved.indices.delete(id);return;}
  saved.indices.set(id,found);return state.soldiers[found];
}
