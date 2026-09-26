import type {BattlefieldState} from '../core/types';
import {inventory,RESOURCES,type Inventory,type Resource,type SupplyClaim,type SupplyDemand} from './types';

type Source=Omit<SupplyClaim,'amount'>&{garrisonId:number;stock:Inventory;dedicated?:number};
export const constructionKey=(id:number)=>`construction:${id}:materials`;
export const claimed=(d:SupplyDemand)=>d.claims.reduce((n,c)=>n+c.amount,0);
export const unfulfilled=(d:SupplyDemand)=>Math.max(0,d.target-d.usable-claimed(d));
export function demandSources(state:BattlefieldState):Source[]{
  const w=state.living;if(!w)return [];
  return [
    ...w.garrisons.flatMap(g=>[{source:'local' as const,id:g.id,garrisonId:g.id,stock:g.cache},{source:'forward' as const,id:g.id,garrisonId:g.id,stock:g.forwardStock}]),
    ...w.facilities.filter(f=>['store','ammo'].includes(f.kind)&&f.progress===1).map(f=>({source:'store' as const,id:f.id,garrisonId:f.garrisonId,stock:f.stock})),
    ...w.trucks.filter(t=>t.role==='shuttle'&&t.garrisonId!==undefined&&w.garrisons.some(g=>g.id===t.garrisonId&&(g.faction??'player')===(t.faction??'player'))&&['loading','outbound','unloading','blocked'].includes(t.state)&&t.resume!=='returning').map(t=>({source:'truck' as const,id:t.id,garrisonId:t.garrisonId!,stock:t.cargo})),
    ...state.soldiers.filter(s=>s.garrisonId!==undefined&&s.needs?.life==='active'&&s.duty?.kind==='haul'&&s.duty.stage==='deliver'&&!s.duty.patientId).map(s=>({source:'carrier' as const,id:s.id,garrisonId:s.garrisonId!,dedicated:s.duty?.facilityId,stock:inventory({...s.carried,ammo:Math.max(0,(s.carried?.ammo??0)-60)})})),
  ];
}
/** Deterministic bounded allocation. No transfer or stock mutation occurs here. */
export function reconcileSupplyDemands(state:BattlefieldState):SupplyDemand[]{
  const w=state.living;if(!w)return [];
  const demands:SupplyDemand[]=[];
  const add=(garrisonId:number,consumer:SupplyDemand['consumer'],consumerId:number,resource:Resource,target:number,usable:number,priority:number,createdAt=0)=>{
    demands.push({key:`${consumer}:${consumerId}:${resource}`,garrisonId,consumer,consumerId,resource,target,usable:Math.min(target,usable),priority,createdAt,claims:[]});
  };
  for(const g of w.garrisons){
    const people=state.soldiers.filter(s=>s.garrisonId===g.id&&s.needs?.life!=='dead'),active=people.filter(s=>s.needs?.life==='active');
    for(const f of w.facilities.filter(f=>f.garrisonId===g.id&&f.workOrder?.cancelledAt===undefined)){
      if(f.progress<1)add(g.id,'construction',f.id,'materials',f.materialCost,f.paid?f.materialCost:f.stock.materials,f.workOrder?.explicit?1:4,f.workOrder?.createdAt??f.id);
      if(f.progress===1&&['emplacement','mortar'].includes(f.kind)){
        const crew=active.filter(s=>f.weaponCrewIds?.includes(s.id));
        for(const resource of (f.kind==='mortar'?['mortarHE','mortarSmoke']:['ammo']) as Resource[]){
          const usable=f.stock[resource]+crew.reduce((n,s)=>n+(s.carried?.[resource]??0),0),urgent=crew.length>=2&&(g.underFireUntil??0)>state.elapsed&&f.stock[resource]<(resource==='ammo'?12:1);
          // Ready ammunition comes before deeper reserve stock. Otherwise an
          // older gun with four shells locks the last cache rounds indefinitely
          // while an empty neighbour's assistant repeats a fruitless pickup.
          const minimum=resource==='ammo'?30:resource==='mortarHE'?2:1,empty=crew.length>=2&&usable<minimum;
          add(g.id,'weapon',f.id,resource,empty?minimum:resource==='ammo'?120:resource==='mortarHE'?8:4,usable,urgent?0:empty?2:4);
        }
      }
    }
    for(const resource of ['food','water'] as const){
      const critical=people.filter(s=>(resource==='water'?s.needs?.thirst:s.needs?.hunger)!>65);
      add(g.id,'personnel',g.id,resource,critical.length,critical.reduce((n,s)=>n+(s.carried?.[resource]??0),0),3);
    }
    // Reserve targets are additional floor stock after explicit consumers' claims.
    for(const resource of RESOURCES.filter(k=>k!=='fuel')){
      const target=resource==='materials'?32:resource==='ammo'?(state.operation?active.length*20:5):resource==='food'||resource==='water'?Math.max(100,people.length*2):resource==='medical'?8:resource==='mortarHE'||resource==='mortarSmoke'?0:6;
      if(target)add(g.id,'reserve',g.id,resource,target,0,5);
    }
  }
  demands.sort((a,b)=>a.priority-b.priority||a.createdAt-b.createdAt||a.consumerId-b.consumerId||RESOURCES.indexOf(a.resource)-RESOURCES.indexOf(b.resource)||a.key.localeCompare(b.key));
  const sources=demandSources(state).sort((a,b)=>({local:0,store:1,carrier:2,forward:3,truck:4}[a.source]-{local:0,store:1,carrier:2,forward:3,truck:4}[b.source])||a.id-b.id);
  const remaining=new Map(sources.map(s=>[`${s.source}:${s.id}`,{...s.stock}]));
  for(const d of demands){
    let needed=Math.max(0,d.target-d.usable);
    // Goods already carried to this site cannot be promised elsewhere, even if
    // a newer urgent demand outranks it. No reroute or teleport is implied.
    const eligible=sources.filter(s=>s.garrisonId===d.garrisonId&&(s.dedicated===undefined||d.consumer==='construction'&&s.dedicated===d.consumerId))
      .sort((a,b)=>Number(b.dedicated===d.consumerId)-Number(a.dedicated===d.consumerId));
    for(const s of eligible){const stock=remaining.get(`${s.source}:${s.id}`)!,amount=Math.min(needed,stock[d.resource]);if(amount<=0)continue;
      d.claims.push({source:s.source,id:s.id,amount});stock[d.resource]-=amount;needed-=amount;if(needed<=0)break;
    }
  }
  w.supplyDemands=demands;return demands;
}
export function constructionDemand(state:BattlefieldState,id:number){return state.living?.supplyDemands?.find(d=>d.key===constructionKey(id));}
export function claimedAt(state:BattlefieldState,key:string,source:SupplyClaim['source'],id:number):number{
  return state.living?.supplyDemands?.find(d=>d.key===key)?.claims.filter(c=>c.source===source&&c.id===id).reduce((n,c)=>n+c.amount,0)??0;
}
/** Personal collection cannot take another position's promised ammunition. */
export function availableForPerson(state:BattlefieldState,personId:number,source:SupplyClaim['source'],id:number,resource:Resource,stock:number):number{
  const own=state.living?.facilities.find(f=>f.weaponCrewIds?.includes(personId));
  const protectedAmount=(state.living?.supplyDemands??[]).filter(d=>d.resource===resource&&d.consumer==='weapon'&&d.consumerId!==own?.id).flatMap(d=>d.claims).filter(c=>c.source===source&&c.id===id).reduce((n,c)=>n+c.amount,0);
  return Math.max(0,stock-protectedAmount);
}
/** Ordered demand at a physical forward source: carriers use the same priorities as trucks. */
export function forwardClaims(state:BattlefieldState,garrisonId:number){return (state.living?.supplyDemands??[]).filter(d=>d.garrisonId===garrisonId).flatMap(d=>d.claims.filter(c=>c.source==='forward').map(c=>({resource:d.resource,amount:c.amount,priority:d.priority})));}
export function validSupplyDemands(state:BattlefieldState):boolean{
  const demands=state.living?.supplyDemands;if(demands===undefined)return true;
  if(!Array.isArray(demands)||demands.length>(state.living!.facilities.length*3+state.living!.garrisons.length*12))return false;
  const keys=new Set<string>(),amounts=new Map<string,number>(),sources=demandSources(state);
  for(const d of demands){
    if(!d||typeof d.key!=='string'||keys.has(d.key)||!state.living!.garrisons.some(g=>g.id===d.garrisonId)||!['construction','weapon','personnel','reserve'].includes(d.consumer)||!RESOURCES.includes(d.resource)||![d.target,d.usable,d.priority,d.createdAt].every(n=>Number.isFinite(n)&&n>=0)||d.usable>d.target||!Array.isArray(d.claims)||d.claims.length>state.soldiers.length+state.living!.facilities.length+state.living!.trucks.length+2)return false;
    keys.add(d.key);if(d.key!==`${d.consumer}:${d.consumerId}:${d.resource}`)return false;
    if(['construction','weapon'].includes(d.consumer)&&!state.living!.facilities.some(f=>f.id===d.consumerId&&f.garrisonId===d.garrisonId))return false;
    if(!['construction','weapon'].includes(d.consumer)&&d.consumerId!==d.garrisonId)return false;
    const holders=new Set<string>();
    for(const c of d.claims){if(!c||!['local','store','forward','truck','carrier'].includes(c.source)||!Number.isSafeInteger(c.id)||!Number.isFinite(c.amount)||c.amount<=0)return false;
      const holder=`${c.source}:${c.id}`,source=sources.find(s=>s.source===c.source&&s.id===c.id);
      if(holders.has(holder)||!source||source.garrisonId!==d.garrisonId||source.dedicated!==undefined&&(d.consumer!=='construction'||source.dedicated!==d.consumerId))return false;
      holders.add(holder);
      const k=`${c.source}:${c.id}:${d.resource}`;amounts.set(k,(amounts.get(k)??0)+c.amount);
    }
    if(d.usable+claimed(d)>d.target+.00001)return false;
  }
  // Snapshot balances are checked against the same physical holders; stale
  // claims are reconciled before serialization, not silently accepted on load.
  for(const [key,amount] of amounts){const [kind,id,resource]=key.split(':'),source=sources.find(s=>s.source===kind&&s.id===Number(id));if(!source||amount>source.stock[resource as Resource]+.00001)return false;}
  return true;
}
