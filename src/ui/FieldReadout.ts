import type {BattlefieldState,SoldierState,SquadKind} from '../core/types';
import {factionOf} from '../operations/types';
import {supportReadiness,supportMissionText,SUPPORT_NAMES} from '../combat/SupportWeapons';
import {constructionStatus} from '../construction/ConstructionReadout';
import {crewWeaponReadout} from './WeaponReadout';
import {hasEquipment,squadHasEquipment} from '../combat/Equipment';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {assignedWeaponPosition} from '../combat/WeaponPositions';
import {preparedStatus} from '../operations/PreparedOrders';

export const roleName:Record<SquadKind,string>={rifle:'Rifle squad',engineer:'Engineer team',machinegun:'Machine-gun team',mortar:'Mortar team',medical:'Medical team'};
const mean=(people:SoldierState[],read:(s:SoldierState)=>number)=>Math.round(people.reduce((sum,s)=>sum+read(s),0)/Math.max(1,people.length));
/** Screen-only aggregation. No invented organization, ammo capacity, or ETA. */
export function selectionReadout(state:BattlefieldState,ids:ReadonlySet<number>,terrain?:TerrainSystem){
  const squads=state.squads.filter(q=>ids.has(q.id)&&factionOf(q)==='player');
  if(!squads.length)return undefined;
  const selected=new Set(squads.map(q=>q.id)),people=state.soldiers.filter(s=>selected.has(s.squadId));
  const able=people.filter(s=>!s.needs||s.needs.life==='active'),living=people.filter(s=>s.needs?.life!=='dead');
  const first=squads[0],orders=new Set(squads.map(q=>q.order.intent??q.order.type));
  const names:Record<string,string>={'hold':'Holding','move':'Moving','occupy-trench':'Defending','construct-trench':'Excavating','observe':'Observing','suppress':'Suppressing','assault':'Assaulting','fall-back':'Withdrawing'};
  let order=orders.size>1?'Mixed orders':names[[...orders][0]]??'Following orders';
  if(orders.size===1&&squads.every(q=>q.order.type==='occupy-trench')&&['observe','suppress'].includes(first.order.intent??''))order=`Defending · ${order.toLowerCase()}`;
  if(squads.length===1)order=constructionStatus(state,first)??order;
  if(squads.length===1&&first.orderNote?.startsWith('Route blocked'))order=first.orderNote;
  const prepared=state.preparedOrders?.filter(o=>ids.has(o.squadId)&&(o.releasedAt===undefined||o.raid));if(prepared?.length)order=preparedStatus(state,prepared[0]);
  const mission=state.operation?.supportMissions?.filter(m=>selected.has(m.squadId)).at(-1);
  if(mission&&(['preparing','flight'].includes(mission.stage)||state.elapsed-mission.requestedAt<30))order=SUPPORT_NAMES[mission.kind]+' · '+supportMissionText(mission,state.elapsed);
  const activities=new Map<string,number>();for(const s of able)activities.set(s.action,(activities.get(s.action)??0)+1);
  const activity=[...activities].sort((a,b)=>b[1]-a[1])[0]?.[0]??'Out of action';
  const warning=able.length&&able.filter(s=>s.combat?.reaction==='pinned').length>=Math.ceil(able.length/2)?'PINNED':
    people.some(s=>s.needs?.life==='incapacitated')?'CASUALTIES':
    state.operation&&able.length&&able.reduce((n,s)=>n+(s.carried?.ammo??s.ammunition),0)<able.length*10?'LOW AMMO':
    state.living?.garrisons.some(g=>g.squadIds.some(id=>selected.has(id))&&['decision','hold','recover'].includes(g.cutoff))?'SUPPLY SHORTAGE':'';
  return {name:squads.length===1?first.name:`${squads.length} squads`,role:squads.length===1?roleName[first.kind]:'Selected formation',kind:first.kind,
    able:able.length,total:people.length,order,activity,warning,ammo:Math.floor(able.reduce((n,s)=>n+(s.carried?.ammo??s.ammunition),0)),
    morale:mean(able,s=>s.morale),suppression:mean(able,s=>s.suppression),fatigue:mean(able,s=>s.fatigue),
    covered:living.filter(s=>s.cover==='trench'||s.building?.stage==='station'||s.building?.stage==='inside').length,living:living.length,
    down:people.filter(s=>s.needs?.life==='incapacitated').length,dead:people.filter(s=>s.needs?.life==='dead').length,
    position:squads.length===1?`${Math.abs(Math.round(first.x))} ${first.x<0?'W':'E'} / ${Math.abs(Math.round(first.z))} ${first.z<0?'N':'S'}`:'Multiple positions',
    support:squads.length===1&&(squadHasEquipment(state,first,'mortar')||assignedWeaponPosition(state,first.id,'mortar'))?{he:supportReadiness(state,'mortarHE',first.id,terrain),smoke:supportReadiness(state,'mortarSmoke',first.id,terrain)}:undefined,
    weapon:squads.length===1?crewWeaponReadout(state,first):undefined,
    equipment:[['automatic','automatic weapon'],['tools','tool set'],['mortar','mortar'],['medicalKit','medical kit']].map(([key,label])=>{const n=able.filter(s=>hasEquipment(state,s,key as import('../combat/Equipment').EquipmentCapability)).length;return n?`${n} ${label}${n>1?'s':''}`:'';}).filter(Boolean).join(' · ')||'Personal weapons only',
    reasons:[...new Set(able.map(s=>s.combat?.pauseReason).filter((s):s is string=>Boolean(s)))],
  };
}
