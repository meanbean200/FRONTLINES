import {distance,type BattlefieldState,type SoldierState} from '../core/types';
import {RESOURCES,inventory,type Facility,type Garrison,type Resource,type Truck} from '../garrison/types';
import {localInventory} from '../garrison/Inventory';
import {forwardAccess} from '../garrison/SupplyPoints';
import {hasEquipment} from '../combat/Equipment';
import {constructionDemand,claimed,unfulfilled} from '../garrison/SupplyDemand';
import {facilityName} from '../construction/PositionDefinitions';
import {trenchName,trenchWorkforce,networkName} from './TrenchReadout';
import type {TrenchState} from '../core/types';
export function workReadout(state:BattlefieldState,f:Facility){
  const g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!,people=state.soldiers.filter(s=>f.workOrder?.workerIds.includes(s.id)&&s.needs?.life==='active');
  const carriers=state.soldiers.filter(s=>s.duty?.facilityId===f.id&&s.duty.kind==='haul'&&s.duty.stage==='deliver'&&s.needs?.life==='active');
  const demand=constructionDemand(state,f.id),inbound=demand?demand.claims.filter(c=>!['local','store'].includes(c.source)).reduce((n,c)=>n+c.amount,0):carriers.reduce((n,s)=>n+(s.carried?.materials??0),0),reserved=demand?claimed(demand)-inbound:0,delivered=f.paid?f.materialCost:f.stock.materials,local=localInventory(state,g).materials;
  const working=people.filter(s=>s.duty?.kind==='construct'&&s.duty.facilityId===f.id&&s.duty.arrivedAt!==undefined&&!['reaction','casualty','support'].includes(s.combat?.owner??'')&&['digging','clearing spoil'].includes(s.action));
  const recovering=people.filter(s=>s.selfCare||s.needs!.energy<=25||s.action==='sleeping'||s.action==='eating'||s.duty?.kind==='sleep').length;
  const idleSeconds=Math.max(0,state.elapsed-(f.workOrder?.lastProgressAt??f.workOrder?.createdAt??state.elapsed));
  let status='PLANNED',reason='Assign workers to start.';
  if(f.workOrder?.cancelledAt!==undefined){status='CANCELLED';reason='Delivered materials remain at this site. Future claims released.';}
  else if(f.progress===1){status='COMPLETE';reason='Ready for use.';}
  else if(!f.paid&&people.some(s=>s.duty?.pickupLoaded)){status='MATERIAL DELIVERY BLOCKED';reason=people.find(s=>s.duty?.pickupLoaded)!.duty!.reason;}
  else if(!f.paid&&carriers.some(s=>s.duty?.routeBlocked||(s.duty?.blockedFor??0)>20)){status='MATERIAL DELIVERY BLOCKED';reason='A carrier cannot reach this worksite. Cargo and assignments are retained.';}
  else if(!people.length){status='WAITING FOR WORKERS';reason='No active workers assigned.';}
  else if(people.every(s=>['reaction','casualty','support'].includes(s.combat?.owner??''))){status='INTERRUPTED BY COMBAT';reason='Assignments retained; safety takes priority.';}
  else if(!people.some(s=>hasEquipment(state,s,'tools')&&!s.selfCare&&s.needs!.energy>25)){status='NO TOOL CARRIER AVAILABLE';reason=f.workOrder?.autoWorkers?'Seeking a free, fit local tool carrier. Protected crews and loaded carriers are not reassigned.':'A fit tool carrier is required · enable Auto workers or assign one.';}
  else if(!f.paid){status=inbound>0?'MATERIALS IN TRANSIT':reserved>0?'COLLECTING MATERIALS':'WAITING FOR MATERIALS';reason=`${Math.ceil(f.materialCost-delivered)} still to reach this site · ${Math.floor(reserved)} reserved locally · ${Math.ceil(demand?unfulfilled(demand):Math.max(0,f.materialCost-delivered-inbound-local))} not yet sourced`;}
  else if(working.length){status='BUILDING';reason=`${working.length} working at the site · ${recovering} recovering`;}
  else if(recovering===people.length){status='RECOVERING';reason=`${recovering} sleeping / eating · work assignments retained`;}
  else if(f.workOrder?.accessIssue&&state.elapsed-f.workOrder.accessIssue.at<10){status=f.workOrder.accessIssue.reason;reason=status==='WORK FACE OCCUPIED'?'Productive work, a protected crew or recovery occupies the cutting face. Waiting for real access.':'No usable route to the work face. Worker, materials and progress retained.';}
  else if(people.some(s=>s.duty?.routeBlocked||s.duty?.blockedFor&&s.duty.blockedFor>20)){status='BLOCKED';reason='Worker route obstructed · inspect the approach.';}
  else {status='WORKERS APPROACHING';reason=`${people.length} assigned · nearest ${Math.round(Math.min(...people.map(s=>distance(s,f))))} m away`;}
  return {status,reason,idleSeconds,workers:people.length,working:working.length,inbound,reserved,delivered,local,remaining:Math.max(0,f.materialCost-delivered-inbound-reserved)};
}
export const SUPPLY_LABELS:Record<Resource,string>={ammo:'Ammo',food:'Food',water:'Water',medical:'Medical',materials:'Materials',mortarHE:'Indirect HE',mortarSmoke:'Indirect smoke',smokeGrenades:'Smoke grenades',fuel:'Fuel'};
/** Action codes describe scheduling; players need the current physical activity. */
export function personnelActivity(s:SoldierState):string{
  if(s.needs?.life==='dead')return 'Killed';
  if(s.needs?.life==='incapacitated')return 'Out of action';
  if(s.selfCare?.kind==='field-rest')return 'Recovering energy';
  if(s.duty?.kind==='meal'&&s.duty.weaponDeliveryId!==undefined)return s.duty.arrivedAt===undefined?'Fetching ammunition':'Collecting ammunition';
  const walking=s.action.startsWith('walking · ');
  if(walking&&s.duty)return ({rest:'Moving to reserve',sleep:'Moving to rest',watch:'Moving to post',meal:'Going for rations',haul:'Transporting supplies',construct:'Moving to work',patrol:'Patrolling'} as const)[s.duty.kind];
  if(s.duty?.kind==='rest'&&s.duty.arrivedAt!==undefined&&!s.selfCare&&(s.needs?.energy??0)>=45)return 'Standing by';
  return s.action;
}
export function trenchWorkReadout(state:BattlefieldState,t:TrenchState){
  const q=state.squads.find(q=>q.id===t.engineerSquadId),workforce=trenchWorkforce(state,t),working=workforce.digging+workforce.helpers;
  const workers=workforce.assigned;
  const status=t.progress===1?'COMPLETE':working?'DIGGING':workforce.recovering?'RECOVERING':workforce.blocked?'WORK DELAYED':workers?'CREW APPROACHING':'WAITING FOR WORKERS';
  const reason=workers?`${workforce.digging} digging · ${workforce.helpers} clearing · ${workforce.recovering} recovering · ${workforce.hauling} fetching supplies · ${workforce.walking} approaching · ${workforce.blocked} waiting`:q?.orderNote??(state.simSpeed===0?'Simulation paused':'Assign a digging crew');
  return {name:trenchName(state,t.id),location:t.points[Math.floor(t.points.length/2)],status,progress:t.progress,workers,working,materials:'No material required',reason};
}
export function shipmentReadout(state:BattlefieldState,t:Truck){
  const g=state.living!.garrisons.find(g=>g.id===t.garrisonId),returning=t.state==='returning'||t.state==='blocked'&&t.resume==='returning';
  const destination=t.abandoned?'Trip ended · cargo recoverable here':t.role==='convoy'?(returning?'Map-edge supply point':'Rear depot'):returning?'Rear depot':g?networkName(state,g.id):'Awaiting delivery assignment';
  const demands=(state.living!.supplyDemands??[]).filter(d=>d.claims.some(c=>c.source==='truck'&&c.id===t.id));
  const jobs=demands.filter(d=>d.consumer==='construction').map(d=>({name:facilityName(state,state.living!.facilities.find(f=>f.id===d.consumerId)!),amount:d.claims.filter(c=>c.source==='truck'&&c.id===t.id).reduce((n,c)=>n+c.amount,0)}));
  const note=['En route','Delivering physical cargo','Returning to depot','At depot','Awaiting assignment'].includes(t.reason)?'':t.reason;
  const source=t.role==='convoy'?(returning?'Rear depot':'Map-edge supply point'):returning?(g?networkName(state,g.id):'Former delivery point'):'Rear depot';
  let remaining=0,previous={x:t.x,z:t.z};for(const point of t.route.slice(t.routeIndex)){remaining+=distance(previous,point);previous=point;}
  const seconds=['outbound','returning'].includes(t.state)&&t.reason!=='Road queue'?remaining/12:undefined;
  const rounded=Math.ceil(seconds??0),eta=seconds===undefined?'Not predictable while stopped':`~${Math.floor(rounded/60)}:${String(rounded%60).padStart(2,'0')} at 1× · unobstructed travel`;
  return {destination,source,eta,remaining,jobs,note,cargo:RESOURCES.filter(k=>t.cargo[k]>.00001).map(k=>`${SUPPLY_LABELS[k]} ${Math.floor(t.cargo[k])}`),status:t.abandoned?'Abandoned':t.role==='convoy'&&t.state==='idle'?'At map edge':({idle:'At depot',loading:'Loading',outbound:'En route',unloading:'Unloading',returning:'Returning',blocked:'Blocked'}[t.state])};
}
export function networkSupply(state:BattlefieldState,groups:Garrison[]){
  const ids=new Set(groups.map(g=>g.id)),people=state.soldiers.filter(s=>ids.has(s.garrisonId!)&&s.needs?.life!=='dead'&&s.combat?.wound?.care!=='evacuated'),local=inventory(),inbound=inventory(),inaccessible=inventory(),carried=inventory();
  for(const g of groups){const stock=localInventory(state,g),destination=forwardAccess(state,g)?inaccessible:inbound;for(const key of RESOURCES){local[key]+=stock[key];destination[key]+=g.forwardStock[key];}}
  const trucks=state.living!.trucks.filter(t=>!t.abandoned&&ids.has(t.garrisonId!)&&['loading','outbound','unloading','blocked'].includes(t.state)&&t.resume!=='returning');
  for(const t of trucks)for(const key of RESOURCES)inbound[key]+=t.cargo[key];
  for(const s of people)for(const key of RESOURCES){carried[key]+=s.carried?.[key]??0;if(s.duty?.kind==='haul'&&s.duty.stage==='deliver'&&!s.duty.facilityId&&!s.duty.patientId)inbound[key]+=Math.max(0,(s.carried?.[key]??0)-(key==='ammo'?Math.min(60,s.carried?.ammo??0):0));}
  const jobs=state.living!.facilities.filter(f=>ids.has(f.garrisonId)&&f.progress<1&&f.workOrder?.cancelledAt===undefined),allocated=jobs.reduce((n,f)=>n+(f.paid?f.materialCost:f.stock.materials)+(constructionDemand(state,f.id)?.claims.reduce((n,c)=>n+c.amount,0)??0),0);
  const required=jobs.reduce((n,f)=>n+(f.paid?0:Math.max(0,f.materialCost-f.stock.materials)),0);
  const threshold=(key:Resource)=>key==='ammo'?Math.max(30,people.length*8):key==='food'||key==='water'?Math.max(2,people.length):key==='materials'?Math.max(8,required):key==='medical'?2:2;
  const demands=state.living!.supplyDemands?.filter(d=>ids.has(d.garrisonId))??[];
  const carriers=people.filter(s=>s.needs?.life==='active'&&s.duty?.kind==='haul'),issue=carriers.some(s=>s.duty?.unsafeRoute)?'ROUTE UNSAFE · WAITING':groups.some(g=>g.haulIssue&&state.elapsed-g.haulIssue.at<12)?'NO SAFE APPROACH':'';
  return {local,inbound,inaccessible,carried,trucks,allocated,required,issue,lastDelivery:Math.max(-1,...groups.map(g=>g.lastDeliveryAt??-1)),rows:(Object.keys(SUPPLY_LABELS) as Resource[]).map(key=>{
    const collecting=carriers.some(s=>s.duty?.stage==='pickup'&&!s.duty.unsafeRoute&&!s.duty.facilityId&&!s.duty.patientId&&!s.duty.crateId&&(!s.duty.urgentAmmo||['ammo','mortarHE','mortarSmoke'].includes(key)));
    const requests=demands.filter(d=>d.resource===key),requested=requests.reduce((n,d)=>n+Math.max(0,d.target-d.usable-d.claims.filter(c=>['local','store'].includes(c.source)).reduce((v,c)=>v+c.amount,0)),0),missing=requests.reduce((n,d)=>n+unfulfilled(d),0);
    const loads=trucks.filter(t=>t.cargo[key]>0),forward=groups.filter(g=>!forwardAccess(state,g)).reduce((n,g)=>n+g.forwardStock[key],0);
    const reason=loads.some(t=>t.state==='blocked')?'Supply truck route blocked':loads.length?(loads.length===1?'On delivery truck':`On ${loads.length} delivery trucks`):forward>0?issue?issue+' · stock at delivery point':collecting?'At delivery point · foot carriers collecting':'At delivery point · awaiting foot carrier':inbound[key]>0?issue||'Foot carrier approaching':inaccessible[key]>0?'AREA NOT SECURED · forward stock inaccessible':missing>0&&state.living!.rearStock[key]<=0?'None at rear depot · awaiting scheduled convoy':missing>0?'Waiting for a supply truck load':requests.length?'Available in local stores':'No current demand';
    return {key,label:SUPPLY_LABELS[key]!,local:local[key],inbound:inbound[key],inaccessible:inaccessible[key],carried:carried[key],requested,missing,reason,status:local[key]<=0?'EMPTY':local[key]<threshold(key)?'LOW':'GOOD',threshold:threshold(key)};
  })};
}
