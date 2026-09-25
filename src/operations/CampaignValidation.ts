import type {BattlefieldState} from '../core/types';
import {RESOURCES} from '../garrison/types';
import {initialReserveCapacity} from './Replacements';
export function validCampaignSystems(s:BattlefieldState):boolean {
  const c=s.operation?.campaign;if(!c)return true;
  const nonnegative=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const enemy=(id:number)=>s.squads.some(q=>q.id===id&&q.faction==='enemy');
  if(c.plan){const p=c.plan;if(!['scout','prepare','commit','reassess','consolidate','withdraw','recover'].includes(p.phase)||!s.operation!.objectives.some(o=>o.id===p.objectiveId)||!enemy(p.scoutId)||!Array.isArray(p.forceIds)||!p.forceIds.every(enemy)||new Set(p.forceIds).size!==p.forceIds.length||![p.since,p.reviewAt,p.startingAble,p.attempts,p.nextSupport].every(nonnegative)||typeof p.reason!=='string')return false;}
  if(c.lastPlan&&(!s.operation!.objectives.some(o=>o.id===c.lastPlan!.objectiveId)||typeof c.lastPlan.reason!=='string'||!nonnegative(c.lastPlan.at)))return false;
  const r=c.replacements;if(!r)return true;
  if(r.dispatchAt&&(!(['player','enemy'] as const).every(side=>r.dispatchAt![side]===undefined||nonnegative(r.dispatchAt![side]))||Object.keys(r.dispatchAt).some(key=>!['player','enemy'].includes(key))))return false;
  if(!r.reserve||!r.nextAt||!(['player','enemy'] as const).every(side=>Number.isInteger(r.reserve[side])&&r.reserve[side]>=0&&r.reserve[side]<=48&&nonnegative(r.nextAt[side]))||!Array.isArray(r.manifests)||!Array.isArray(r.establishment))return false;
  if(r.establishment.length!==s.squads.length||new Set(r.establishment.map(row=>row?.squadId)).size!==r.establishment.length||!r.establishment.every(row=>row&&s.squads.some(q=>q.id===row.squadId)&&Number.isInteger(row.strength)&&row.strength>0&&row.strength<=1000))return false;
  const unique=new Set<number>(),pending=new Set<number>();
  for(const m of r.manifests){
    if(!m||!Number.isInteger(m.id)||m.id<1||m.id>=s.nextEntityId||unique.has(m.id)||!Number.isInteger(m.personId)||m.personId<1||m.personId>=s.nextEntityId||!['player','enemy'].includes(m.side)||!s.squads.some(q=>q.id===m.squadId&&(q.faction??'player')===m.side)||typeof m.returning!=='boolean'||!['edge','convoy','rear','shuttle','arrived'].includes(m.stage)||!nonnegative(m.releasedAt)||!m.stock||!RESOURCES.every(key=>nonnegative(m.stock[key])))return false;
    unique.add(m.id);
    if(m.replacesId!==undefined&&(m.returning||!s.soldiers.some(p=>p.id===m.replacesId&&p.squadId===m.squadId&&p.needs?.life==='dead')||r.manifests.some(other=>other!==m&&other.replacesId===m.replacesId)))return false;
    if(m.stage!=='arrived'){if(pending.has(m.personId))return false;pending.add(m.personId);}
    if((m.returning||m.stage==='arrived')&&!s.soldiers.some(p=>p.id===m.personId&&p.squadId===m.squadId))return false;
    if(!m.returning&&m.stage!=='arrived'&&s.soldiers.some(p=>p.id===m.personId))return false;
    if(['convoy','shuttle'].includes(m.stage)&&!s.living!.trucks.some(t=>t.id===m.truckId&&(t.faction??'player')===m.side&&t.role===m.stage))return false;
    if(m.stage==='arrived'&&(!nonnegative(m.arrivedAt)||RESOURCES.some(key=>m.stock[key]!==0)))return false;
  }
  const initialReserve=initialReserveCapacity(s);
  for(const side of ['player','enemy'] as const)if(r.reserve[side]+r.manifests.filter(m=>m.side===side&&!m.returning).length!==initialReserve)return false;
  for(const t of s.living!.trucks)if(r.manifests.filter(m=>m.truckId===t.id&&m.stage!=='arrived').length>8)return false;
  return true;
}
