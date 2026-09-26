import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';

const cache=new WeakMap<BattlefieldState,{at:number;count:number;sides:Map<number,string>}>();
export function sameSide(state:BattlefieldState,a:SoldierState,b:SoldierState):boolean {
  if(a.squadId===b.squadId)return true;
  let row=cache.get(state);
  if(!row||row.at!==state.elapsed||row.count!==state.squads.length){row={at:state.elapsed,count:state.squads.length,sides:new Map(state.squads.map(q=>[q.id,q.faction??'player']))};cache.set(state,row);}
  return row.sides.get(a.squadId)===row.sides.get(b.squadId);
}
/** Bodies do not grant passage through walls. Callers still validate geometry. */
export function bodyBlocks(state:BattlefieldState,s:SoldierState,other:SoldierState,next:Vec2,radius:number):boolean {
  return other!==s&&other.needs?.life!=='dead'&&!sameSide(state,s,other)&&distance(next,other)<radius&&distance(next,other)<distance(s,other)-1e-5;
}
