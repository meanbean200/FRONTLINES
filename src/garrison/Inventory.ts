import { inventory, RESOURCES, type Inventory, type Resource, type Garrison } from './types';
import type { BattlefieldState } from '../core/types';
export function transfer(from:Inventory,to:Inventory,key:Resource,amount:number):number {
  const n=Math.max(0,Math.min(from[key],amount));from[key]-=n;to[key]+=n;return n;
}
export function total(stock:Inventory):number{return RESOURCES.reduce((sum,key)=>sum+stock[key],0);}
/** Rifle ammunition lives in the personal bandolier, not the carrier's supply sack. */
export function carrierCapacity(stock:Inventory,sackCapacity:number):number{return sackCapacity+Math.min(60,stock.ammo);}
export function transferBounded(from:Inventory,to:Inventory,key:Resource,amount:number,capacity:number):number {
  return transfer(from,to,key,Math.min(amount,Math.max(0,capacity-total(to))));
}
export function localInventory(state:BattlefieldState,g:Garrison):Inventory {
  const result={...g.cache};
  for(const f of state.living!.facilities)if(f.garrisonId===g.id&&(f.kind==='store'||f.kind==='ammo')&&f.progress===1)for(const key of RESOURCES)result[key]+=f.stock[key];
  return result;
}
export function consume(state:BattlefieldState,stock:Inventory,key:Resource,amount:number):number{return transfer(stock,state.living!.ledger.consumed,key,amount);}
export function balance(state:BattlefieldState):Inventory {
  const w=state.living!,result=inventory();
  const stocks=[w.rearStock,...(w.enemySupply?[w.enemySupply.stock]:[]),...w.garrisons.flatMap(g=>[g.cache,g.forwardStock]),...w.facilities.map(f=>f.stock),...w.trucks.map(t=>t.cargo),...w.crates.map(c=>c.stock),...state.soldiers.map(s=>s.carried??inventory()),...(state.operation?.campaign?.replacements?.manifests??[]).map(m=>m.stock)];
  for(const key of RESOURCES)result[key]=w.ledger.initial[key]+w.ledger.imported[key]-w.ledger.consumed[key]-w.ledger.lost[key]-stocks.reduce((sum,s)=>sum+s[key],0)-(key==='fuel'?w.trucks.reduce((sum,t)=>sum+t.fuel,0):0);
  return result;
}
