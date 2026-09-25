import {distance,type BattlefieldState} from '../core/types';
import {RESOURCES,inventory,type Facility,type Garrison,type Resource} from '../garrison/types';
import {localInventory} from '../garrison/Inventory';
import {hasEquipment} from '../combat/Equipment';
export function workReadout(state:BattlefieldState,f:Facility){
  const g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!,people=state.soldiers.filter(s=>f.workOrder?.workerIds.includes(s.id)&&s.needs?.life==='active');
  const carriers=state.soldiers.filter(s=>s.duty?.facilityId===f.id&&s.duty.kind==='haul'&&s.duty.stage==='deliver'&&s.needs?.life==='active');
  const inbound=carriers.reduce((n,s)=>n+(s.carried?.materials??0),0),delivered=f.paid?f.materialCost:f.stock.materials,local=localInventory(state,g).materials;
  const working=people.filter(s=>s.duty?.kind==='construct'&&s.duty.facilityId===f.id&&s.duty.arrivedAt!==undefined&&!['reaction','casualty','support'].includes(s.combat?.owner??'')&&['digging','clearing spoil'].includes(s.action));
  let status='PLANNED',reason='Assign workers to start.';
  if(f.progress===1){status='COMPLETE';reason='Ready for use.';}
  else if(!f.paid){status=inbound>0?'MATERIALS IN TRANSIT':'WAITING FOR MATERIALS';reason=`${Math.ceil(Math.max(0,f.materialCost-delivered-inbound))} still needed · ${Math.floor(local)} in local stores`;}
  else if(!people.length){status='WAITING FOR WORKERS';reason='No active workers assigned.';}
  else if(people.every(s=>['reaction','casualty','support'].includes(s.combat?.owner??''))){status='INTERRUPTED BY COMBAT';reason='Assignments retained; safety takes priority.';}
  else if(!people.some(s=>hasEquipment(state,s,'tools'))){status='BLOCKED';reason='A tool carrier is required; laborers can assist.';}
  else if(working.length){status='BUILDING';reason=`${working.length} working at the site`;}
  else if(people.some(s=>s.duty?.routeBlocked||s.duty?.blockedFor&&s.duty.blockedFor>20)){status='BLOCKED';reason='Worker route obstructed · inspect the approach.';}
  else {status='WORKERS APPROACHING';reason=`${people.length} assigned · nearest ${Math.round(Math.min(...people.map(s=>distance(s,f))))} m away`;}
  return {status,reason,workers:people.length,working:working.length,inbound,delivered,local,remaining:Math.max(0,f.materialCost-delivered-inbound)};
}
export const SUPPLY_LABELS:Partial<Record<Resource,string>>={ammo:'Ammo',food:'Food',water:'Water',medical:'Medical',materials:'Materials',mortarHE:'Mortar HE',mortarSmoke:'Mortar smoke'};
export function networkSupply(state:BattlefieldState,groups:Garrison[]){
  const ids=new Set(groups.map(g=>g.id)),people=state.soldiers.filter(s=>ids.has(s.garrisonId!)&&s.needs?.life!=='dead'),local=inventory(),inbound=inventory(),carried=inventory();
  for(const g of groups){const stock=localInventory(state,g);for(const key of RESOURCES){local[key]+=stock[key];inbound[key]+=g.forwardStock[key];}}
  const trucks=state.living!.trucks.filter(t=>ids.has(t.garrisonId!)&&['loading','outbound','unloading','blocked'].includes(t.state));
  for(const t of trucks)for(const key of RESOURCES)inbound[key]+=t.cargo[key];
  for(const s of people)for(const key of RESOURCES){carried[key]+=s.carried?.[key]??0;if(s.duty?.kind==='haul'&&s.duty.stage==='deliver'&&!s.duty.facilityId&&!s.duty.patientId)inbound[key]+=Math.max(0,(s.carried?.[key]??0)-(key==='ammo'?Math.min(60,s.carried?.ammo??0):0));}
  const jobs=state.living!.facilities.filter(f=>ids.has(f.garrisonId)&&f.progress<1),allocated=jobs.reduce((n,f)=>n+(f.paid?f.materialCost:f.stock.materials),0);
  const required=jobs.reduce((n,f)=>n+(f.paid?0:Math.max(0,f.materialCost-f.stock.materials)),0);
  const threshold=(key:Resource)=>key==='ammo'?Math.max(30,people.length*8):key==='food'||key==='water'?Math.max(2,people.length):key==='materials'?Math.max(8,required):key==='medical'?2:2;
  return {local,inbound,carried,trucks,allocated,required,lastDelivery:Math.max(-1,...groups.map(g=>g.lastDeliveryAt??-1)),rows:(Object.keys(SUPPLY_LABELS) as Resource[]).map(key=>({key,label:SUPPLY_LABELS[key]!,local:local[key],inbound:inbound[key],carried:carried[key],status:local[key]<=0?'EMPTY':local[key]<threshold(key)?'LOW':'GOOD',threshold:threshold(key)}))};
}
