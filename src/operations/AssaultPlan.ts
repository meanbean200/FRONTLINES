import {type BattlefieldState,type SoldierState,type SquadState,type Vec2} from '../core/types';
import {equipmentOf} from '../combat/Equipment';
import {positionReadiness} from '../combat/WeaponPositions';
import {needsRecovery,stationCrewIds,isWorking,isExcavationWorker,readyDefender} from '../garrison/PersonnelRoles';

export type AssaultStaffing='normal'|'all-in';
export interface AssaultOptions {includeWorkers?:boolean;personIds?:number[]}
export interface AssaultPreview {
  participantIds:number[]; excluded:{id:number;reason:string}[];
  sourcePositionIds:number[]; weaponIds:number[]; workIds:number[];
  trenchWorkIds?:number[];
  awakenedIds:number[]; unarmedIds:number[]; lowAmmoIds:number[];
  remainingDefenders:number; remainingReadyWeapons:number;
  remainingAssigned?:number; remainingReadyPersonnel?:number;
}
export type AssaultMarch=Pick<SquadState,'x'|'z'|'order'|'route'|'routeIndex'|'movementState'|'orderNote'|'tactics'>;
export interface AssaultPlan {
  sourcePositionIds?:number[];
  options?:AssaultOptions;
  staffing:AssaultStaffing; preview:AssaultPreview; participantIds:number[];
  phase:'preview'|'committed'|'holding'|'secured'; march?:AssaultMarch;
  reviewRequired?:boolean;
}
export function assaultFor(state:BattlefieldState,id:number){return state.preparedOrders?.find(o=>o.assault&&o.releasedAt!==undefined&&o.assault.phase!=='secured'&&o.assault.participantIds.includes(id));}
export const committedToAssault=(state:BattlefieldState,s:SoldierState)=>Boolean(assaultFor(state,s.id));
export const detachedFromFormation=(state:BattlefieldState,s:SoldierState)=>s.assaultHold!==undefined||committedToAssault(state,s);
export function assaultSquad(q:SquadState,a:AssaultPlan):SquadState{return {...q,...a.march,soldierIds:a.participantIds};}
export function effectiveSquad(state:BattlefieldState,s:SoldierState,q:SquadState):SquadState{
  const a=assaultFor(state,s.id)?.assault;
  return a?.march?assaultSquad(q,a):s.assaultHold!==undefined?{...q,order:{type:'hold',issuedAt:s.assaultHold},route:[],soldierIds:[s.id]}:q;
}
/** Pure query. Neither selecting ALL IN nor inspecting consequences claims people. */
export function previewAssault(state:BattlefieldState,squadIds:readonly number[],staffing:AssaultStaffing,sourcePositionIds?:readonly number[],options:AssaultOptions={}):AssaultPreview{
  const p:AssaultPreview={participantIds:[],excluded:[],sourcePositionIds:[],weaponIds:[],workIds:[],awakenedIds:[],unarmedIds:[],lowAmmoIds:[],remainingDefenders:0,remainingReadyWeapons:0};
  const facilities=state.living?.facilities??[],crewIds=stationCrewIds(state),workers:number[]=[],selected=state.soldiers.filter(s=>squadIds.includes(s.squadId)&&(!sourcePositionIds||sourcePositionIds.includes(s.garrisonId!))&&(!options.personIds||options.personIds.includes(s.id))&&state.squads.some(q=>q.id===s.squadId&&q.faction!=='enemy'));
  p.sourcePositionIds=[...new Set(selected.flatMap(s=>s.garrisonId===undefined?[]:[s.garrisonId]))].sort((a,b)=>a-b);
  for(const s of selected){
    const n=s.needs,crew=crewIds.has(s.id),worker=isWorking(state,s),resting=needsRecovery(s);
    let reason='';
    if(s.health<=0||n?.life!=='active')reason='Incapacitated or dead';
    else if(['disabling','critical','fatal'].includes(s.combat?.wound?.severity??'')||s.health<25)reason='Serious wound';
    else if(s.combat?.careTask)reason='Casualty care · safe handover required';
    else if(s.suppression>=70||['pinned','broken'].includes(s.combat?.reaction??''))reason='Physically pinned or broken';
    else if((n?.energy??100)<25||s.selfCare&&s.selfCare.kind!=='sleep')reason='Critical self-care';
    else if(committedToAssault(state,s))reason='Already committed to an assault';
    else if(staffing==='normal'&&crew)reason='Protected station crew';
    else if(staffing==='normal'&&resting)reason='Protected recovery';
    else if(staffing==='normal'&&worker&&!options.includeWorkers)reason='Protected ongoing work · enable Include workers';
    if(reason){p.excluded.push({id:s.id,reason});continue;}
    if(staffing==='normal'&&worker)workers.push(s.id);else p.participantIds.push(s.id);
    if(resting)p.awakenedIds.push(s.id);
    if(equipmentOf(state,s).weapon==='unarmed')p.unarmedIds.push(s.id);
    if((s.carried?.ammo??s.ammunition)<10)p.lowAmmoIds.push(s.id);
  }
  p.participantIds.push(...workers); // Available people first; opt-in workers follow.
  const ids=new Set(p.participantIds);
  p.weaponIds=facilities.filter(f=>f.weaponCrewIds?.some(id=>ids.has(id))).map(f=>f.id);
  p.workIds=facilities.filter(f=>f.progress<1&&f.workOrder?.cancelledAt===undefined&&f.workOrder?.workerIds.some(id=>ids.has(id))).map(f=>f.id);
  const excavationSquads=new Set(selected.filter(s=>ids.has(s.id)&&isExcavationWorker(state,s)).map(s=>s.squadId));
  p.trenchWorkIds=state.trenches.filter(t=>t.status!=='complete'&&state.squads.some(q=>excavationSquads.has(q.id)&&(q.order.trenchId===t.id||q.engineerWork?.projectTrenches?.includes(t.id)))).map(t=>t.id);
  p.remainingDefenders=state.soldiers.filter(s=>p.sourcePositionIds.includes(s.garrisonId!)&&!ids.has(s.id)&&s.needs?.life==='active'&&s.health>=25).length;
  const remaining=state.soldiers.filter(s=>p.sourcePositionIds.includes(s.garrisonId!)&&!ids.has(s.id)&&s.needs?.life!=='dead');
  p.remainingAssigned=remaining.length;p.remainingReadyPersonnel=remaining.filter(s=>readyDefender(state,s)).length;
  p.remainingReadyWeapons=facilities.filter(f=>p.sourcePositionIds.includes(f.garrisonId)&&!p.weaponIds.includes(f.id)&&['mortar','emplacement'].includes(f.kind)&&!positionReadiness(state,f)).length;
  return p;
}
export const sameAssaultPreview=(a:AssaultPreview,b:AssaultPreview)=>JSON.stringify(a)===JSON.stringify(b);
export function validAssault(state:BattlefieldState,o:import('./PreparedOrders').PreparedOrder):boolean{
  const a=o.assault;if(a===undefined)return true;
  if(!a||o.intent!=='assault'||!['normal','all-in'].includes(a.staffing)||!['preview','committed','holding','secured'].includes(a.phase)||!a.preview)return false;
  const people=new Set(state.soldiers.filter(s=>s.squadId===o.squadId).map(s=>s.id));
  const ids=(v:unknown,valid:Set<number>)=>Array.isArray(v)&&v.length<=state.soldiers.length+state.trenches.length+1000&&new Set(v).size===v.length&&v.every(id=>Number.isSafeInteger(id)&&valid.has(id));
  if(a.options!==undefined&&(!a.options||typeof a.options!=='object'||a.options.includeWorkers!==undefined&&typeof a.options.includeWorkers!=='boolean'||a.options.personIds!==undefined&&!ids(a.options.personIds,people)))return false;
  if(!ids(a.participantIds,people)||!ids(a.preview.participantIds,people)||JSON.stringify(a.participantIds)!==JSON.stringify(a.preview.participantIds))return false;
  if(a.sourcePositionIds!==undefined&&!ids(a.sourcePositionIds,new Set(state.living?.garrisons.map(g=>g.id))))return false;
  if(!Array.isArray(a.preview.excluded)||a.preview.excluded.length>people.size||a.preview.excluded.some(e=>!e||!people.has(e.id)||a.participantIds.includes(e.id)||typeof e.reason!=='string'||e.reason.length>200)||new Set(a.preview.excluded.map(e=>e.id)).size!==a.preview.excluded.length)return false;
  if(a.options?.personIds&&[...a.participantIds,...a.preview.excluded.map(e=>e.id)].some(id=>!a.options!.personIds!.includes(id)))return false;
  for(const key of ['awakenedIds','unarmedIds','lowAmmoIds'] as const)if(!ids(a.preview[key],new Set(a.participantIds)))return false;
  if(a.preview.trenchWorkIds!==undefined&&!ids(a.preview.trenchWorkIds,new Set(state.trenches.map(t=>t.id))))return false;
  if(!ids(a.preview.sourcePositionIds,new Set(state.living?.garrisons.map(g=>g.id)))||!ids(a.preview.weaponIds,new Set(state.living?.facilities.map(f=>f.id)))||!ids(a.preview.workIds,new Set(state.living?.facilities.map(f=>f.id))))return false;
  if(![a.preview.remainingDefenders,a.preview.remainingReadyWeapons].every(n=>Number.isSafeInteger(n)&&n>=0)||a.reviewRequired!==undefined&&typeof a.reviewRequired!=='boolean')return false;
  if([a.preview.remainingAssigned,a.preview.remainingReadyPersonnel].some(n=>n!==undefined&&(!Number.isSafeInteger(n)||n<0)))return false;
  if(a.preview.remainingReadyPersonnel!==undefined&&a.preview.remainingAssigned!==undefined&&a.preview.remainingReadyPersonnel>a.preview.remainingAssigned)return false;
  if(a.phase==='preview')return o.releasedAt===undefined&&a.march===undefined;
  const m=a.march,point=(p:Vec2)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=(state.worldSize??4000)/2&&Math.abs(p.z)<=(state.worldSize??4000)/2;
  return o.releasedAt!==undefined&&a.participantIds.length>0&&Boolean(m&&point(m)&&m.order&&['move','hold'].includes(m.order.type)&&['assault','fall-back',undefined].includes(m.order.intent)&&Number.isFinite(m.order.issuedAt)&&m.order.issuedAt>=0&&m.order.issuedAt<=state.elapsed&&(!m.order.target||point(m.order.target))&&Array.isArray(m.route)&&m.route.length<=8192&&m.route.every(point)&&Number.isInteger(m.routeIndex)&&m.routeIndex>=0&&m.routeIndex<=m.route.length&&['idle','moving','forming','planning'].includes(m.movementState)&&(m.orderNote===undefined||typeof m.orderNote==='string'&&m.orderNote.length<1000)&&(!m.tactics||[0,1].includes(m.tactics.group)&&Number.isFinite(m.tactics.switchAt)));
}
/** Called only on the confirmed fixed tick. Cargo remains on its actual carrier. */
export function commitAssault(state:BattlefieldState,q:SquadState,a:AssaultPlan,target:Vec2):void{
  const ids=new Set(a.participantIds),people=state.soldiers.filter(s=>ids.has(s.id));
  for(const f of state.living?.facilities??[]){
    const losing=f.weaponCrewIds?.some(id=>ids.has(id));
    f.weaponCrewIds=f.weaponCrewIds?.filter(id=>!ids.has(id));
    if(losing)f.autoReplaceCrew=false;
    if(f.crewRelief&&(ids.has(f.crewRelief.incomingId)||ids.has(f.crewRelief.outgoingId))){const incoming=state.soldiers.find(s=>s.id===f.crewRelief!.incomingId);if(incoming?.duty?.facilityId===f.id)delete incoming.duty;delete f.crewRelief;}
    if(f.workOrder?.workerIds.some(id=>ids.has(id))){f.workOrder.workerIds=f.workOrder.workerIds.filter(id=>!ids.has(id));f.workOrder.autoWorkers=false;if(!f.workOrder.workerIds.length)f.workOrder.pausedByAssault=true;}
  }
  for(const m of state.operation?.supportMissions??[])if(m.stage==='preparing'&&(m.crewIds?.some(id=>ids.has(id))||m.positionId!==undefined&&a.preview.weaponIds.includes(m.positionId))){m.stage='cancelled';m.reason='Crew committed to assault · no round fired';}
  for(const s of people){
    if(s.action==='sleeping'&&s.needs)s.needs.interruptedSleep++;
    delete s.duty;delete s.garrisonId;delete s.personalArea;delete s.selfCare;delete s.survivalReason;delete s.assaultHold;delete s.formationTravel;delete s.pathTravel;
    if(s.building)s.building.exitRequested=true;
    if(s.combat){s.combat.owner='order';delete s.combat.pauseReason;}
    s.action='assault committed';
  }
  a.phase='committed';
  a.march={x:people.reduce((n,s)=>n+s.x,0)/people.length,z:people.reduce((n,s)=>n+s.z,0)/people.length,order:{type:'move',intent:'assault',target:{...target},issuedAt:state.elapsed},route:[],routeIndex:0,movementState:'moving'};
  // Keep the original squad order and queues. Excluded workers continue their work.
  if(q.order.type==='construct-trench'&&q.soldierIds.every(id=>ids.has(id))){q.workStarted=false;q.orderNote='Work paused · personnel committed to assault';}
}
