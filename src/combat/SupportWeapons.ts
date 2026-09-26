import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {hash2D} from '../core/random';
import {consume} from '../garrison/Inventory';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {bodyVolume} from './Ballistics';
import {combatWound} from './Casualties';
import {registerIncoming} from './Reactions';
import {signalEngagement} from './Engagement';
import {squadHasEquipment} from './Equipment';
import {assignedWeaponPosition,crewAt,crewOperator,positionReadiness} from './WeaponPositions';
import {bombardGround} from '../terrain/Bombardment';
export type SupportKind='mortarHE'|'mortarSmoke'|'smokeGrenades';
export type SupportSource='PLAYER'|'ENEMY_AI'|'CAMPAIGN_AI'|'AUTHORED_AI'|'SCRIPTED_SCENARIO'|'LEGACY_UNKNOWN';
export interface SupportRequest {at:number;squadId:number;side:'player'|'enemy';source:SupportSource;kind:SupportKind;target:Vec2;accepted:boolean;reason:string}
export const SUPPORT_NAMES:Record<SupportKind,string>={mortarHE:'Indirect HE',mortarSmoke:'Indirect smoke',smokeGrenades:'Smoke grenade'};
/** Live command authority. Historical provenance tags never grant permission. */
export function supportSourceMatchesSide(side:'player'|'enemy',source:SupportSource,authoredController?:'ai'|'human'):boolean {
  if(source==='AUTHORED_AI')return authoredController==='ai';
  return side==='player'?source==='PLAYER':source==='ENEMY_AI'||source==='CAMPAIGN_AI';
}
/** Read-only readiness, shared by command validation, live missions and the HUD. */
export function supportReadiness(state:BattlefieldState,kind:SupportKind,squadId:number,terrain?:TerrainSystem,checkBusy=true,positionId?:number){
  const q=state.squads.find(q=>q.id===squadId),grenade=kind==='smokeGrenades';
  const position=!grenade?(positionId===undefined?assignedWeaponPosition(state,squadId,'mortar'):state.living?.facilities.find(f=>f.id===positionId&&f.kind==='mortar')):undefined;
  const people=(position?crewAt(state,position):state.soldiers.filter(s=>s.squadId===squadId)).filter(s=>s.needs?.life==='active');
  const available=people.filter(s=>s.suppression<70&&s.action!=='sleeping'&&!s.combat?.careTask);
  const operator=grenade?available.find(s=>(s.carried?.[kind]??0)>=1):available.find(s=>s.id===position?.weaponCrewIds?.find(id=>state.soldiers.find(p=>p.id===id)?.needs?.life==='active'));
  const assignedOperator=position?crewOperator(state,position):undefined;
  const crew=available.filter(s=>operator&&distance(s,operator)<12),ammo=grenade?crew.reduce((n,s)=>n+(s.carried?.[kind]??0),0):(position?.stock[kind]??0);
  const pack=grenade?crew.find(s=>(s.carried?.[kind]??0)>=1):operator;
  let reason='';
  if(!state.operation?.supportRules||state.operation.status!=='active'||!q)reason='Support unavailable in this scenario';
  else if(!grenade&&!position)reason='Choose a built indirect weapon and assign two people';
  else if(!grenade&&crewOperator(state,position!)?.squadId!==squadId)reason='This position has a different operator';
  else if(!grenade&&!operator)reason=assignedOperator?.action==='sleeping'?'Gunner resting · recovering energy; equipment remains assigned':assignedOperator?.combat?.careTask?'Gunner assisting a casualty · finish or reassign the crew':(assignedOperator?.suppression??0)>=70?'Gunner under heavy suppression · waiting for recovery':'No ready assigned gunner';
  else if(checkBusy&&state.operation.supportMissions?.some(m=>(grenade?m.squadId===q.id:m.positionId===position?.id)&&['preparing','flight'].includes(m.stage)))reason='Support mission already in progress';
  else if(ammo<1)reason=`No ${SUPPORT_NAMES[kind].toLowerCase()} ammunition`;
  else if(!grenade&&q.order.type==='move'&&!operator?.personalArea)reason='Crew moving · Hold [H] before setting up the gun';
  else if(!pack)reason='Ammunition carrier unavailable: pinned, asleep or treating a casualty';
  else if(!grenade&&crew.length<2)reason='Need 2 ready crew within 12 m · regroup the team';
  else if(!grenade&&terrain&&[pack,...crew].some(s=>{const id=terrain.buildingAt(s);return id!==undefined&&state.buildingChanges?.find(b=>b.id===id)?.condition!=='ruined';}))reason='Indirect fire needs an open-air position clear of roofs';
  else if(position&&positionReadiness(state,position))reason=positionReadiness(state,position);
  const crewIds=[...new Set([operator?.id,pack?.id,...crew.map(s=>s.id)].filter((id):id is number=>id!==undefined))].slice(0,grenade?1:2);
  return {ammo:Math.floor(ammo),crew:crew.length,reason,operatorId:operator?.id,crewIds,positionId:position?.id};
}
export function selectedSupportTeam(state:BattlefieldState,ids:ReadonlySet<number>,kind:SupportKind,terrain?:TerrainSystem):number|undefined{
  const teams=state.squads.filter(q=>ids.has(q.id)&&q.faction!=='enemy'&&(kind==='smokeGrenades'||assignedWeaponPosition(state,q.id,'mortar')||squadHasEquipment(state,q,'mortar')));
  return (teams.find(q=>!supportReadiness(state,kind,q.id,terrain).reason)??teams[0])?.id;
}
export function supportMissionText(m:SupportMission,now:number):string{
  return m.stage==='preparing'?`Preparing · ${Math.max(0,Math.ceil(m.launchAt-now))} s to fire`:m.stage==='flight'?`Round in flight · ${Math.max(0,Math.ceil(m.impactAt-now))} s to impact`:m.stage==='complete'?'Impact complete':m.reason;
}
export interface SupportMission {id:number;squadId:number;positionId?:number;weapon?:'field-gun';kind:SupportKind;target:Vec2;impact:Vec2;requestedAt:number;launchAt:number;impactAt:number;stage:'preparing'|'flight'|'complete'|'cancelled';reason:string;dangerRadius:number;confirmedRisk:boolean;source?:SupportSource;side?:'player'|'enemy';ammoConsumed?:number;crewIds?:number[]}
export interface SmokeField extends Vec2 {id:number;radius:number;until:number;born:number}
export interface BlastEvent extends Vec2 {id:number;at:number;radius:number}
export function migrateSupportPositions(state:BattlefieldState):void{
  for(const m of state.operation?.supportMissions??[]){
    if(m.kind==='smokeGrenades'||m.positionId!==undefined)continue;
    const matches=state.living?.facilities.filter(f=>f.kind==='mortar'&&(m.crewIds?.length?m.crewIds.every(id=>f.weaponCrewIds?.includes(id)):crewOperator(state,f)?.squadId===m.squadId))??[];
    if(matches.length===1){m.positionId=matches[0].id;m.crewIds??=matches[0].weaponCrewIds?.slice();}
    else if(m.stage==='preparing'){m.stage='cancelled';m.reason='Legacy mortar order cancelled: choose its physical pit again';}
  }
}
export function requestPositionSupport(state:BattlefieldState,kind:'mortarHE'|'mortarSmoke',positionId:number,target:Vec2,confirmedRisk=false,terrain?:TerrainSystem,source:SupportSource='PLAYER'):{accepted:boolean;warning?:boolean;reason:string}{
  const f=state.living?.facilities.find(f=>f.id===positionId&&f.kind==='mortar'),operator=f&&crewOperator(state,f);
  if(!operator)return {accepted:false,reason:'No ready gunner assigned to this position'};
  return requestSupport(state,kind,operator.squadId,target,confirmedRisk,terrain,source,positionId);
}
export function requestBatterySupport(state:BattlefieldState,kind:'mortarHE'|'mortarSmoke',positionId:number,target:Vec2,confirmedRisk=false,terrain?:TerrainSystem){
  const f=state.living?.facilities.find(f=>f.id===positionId),guns=state.living?.facilities.filter(p=>f?.artillery&&p.artillery?.batteryId===f.artillery.batteryId)??[];
  if(!guns.length)return {accepted:false,reason:'Battery unavailable'};
  return requestSupportGroup(state,kind,guns.map(g=>g.id),target,confirmedRisk,terrain);
}
/** One player intention, separately validated physical weapons. */
export function requestSupportGroup(state:BattlefieldState,kind:'mortarHE'|'mortarSmoke',ids:number[],target:Vec2,confirmedRisk=false,terrain?:TerrainSystem){
  const guns=[...new Set(ids)].flatMap(id=>state.living?.facilities.find(f=>f.id===id&&f.kind==='mortar')??[]);
  if(!guns.length)return {accepted:false,reason:'Select at least one indirect weapon'};
  // Preflight against a copy so a risk confirmation never leaves half a salvo
  // committed. Actual requests still use each physical gun, crew and inventory.
  const probe=structuredClone(state),checks=guns.map(g=>requestPositionSupport(probe,kind,g.id,target,confirmedRisk,terrain));
  const warning=checks.find(c=>c.warning);if(warning)return warning;
  let fired=0;const reasons:string[]=[];
  for(const gun of guns){const r=requestPositionSupport(state,kind,gun.id,target,confirmedRisk,terrain);if(r.accepted)fired++;else reasons.push(r.reason);}
  return {accepted:fired>0,reason:`Fire support: ${fired}/${guns.length} guns preparing${reasons.length?' · '+[...new Set(reasons)].join('; '):''}`};
}
export function cancelSupportMission(state:BattlefieldState,id:number):boolean {
  const mission=state.operation?.supportMissions?.find(m=>m.id===id);
  if(!mission||mission.stage!=='preparing'||state.squads.find(q=>q.id===mission.squadId)?.faction==='enemy'||state.operation?.status!=='active')return false;
  mission.stage='cancelled';mission.reason='Cancelled by commander · no round fired';
  return true;
}
export function requestSupport(state:BattlefieldState,kind:SupportKind,squadId:number,target:Vec2,confirmedRisk=false,terrain?:TerrainSystem,source:SupportSource='PLAYER',positionId?:number):{accepted:boolean;warning?:boolean;reason:string} {
  if(kind!=='smokeGrenades'&&positionId===undefined){
    const positions=state.living?.facilities.filter(f=>f.kind==='mortar'&&crewOperator(state,f)?.squadId===squadId)??[];
    if(positions.length>1)return {accepted:false,reason:'Choose the actual gun position; this formation crews several positions'};
    positionId=positions[0]?.id;
  }
  const result=validateSupport(state,kind,squadId,target,confirmedRisk,terrain,source,positionId);
  const requester=state.squads.find(q=>q.id===squadId),side=requester?.faction??'player';
  // Unknown/unauthorized API callers are not game requesters. Keep useful
  // rejected orders (ammo, roofs, range, danger, reports) from real authorities.
  if(state.operation&&requester&&supportSourceMatchesSide(side,source,state.operation.authored?.controllers[side])&&Number.isFinite(target.x)&&Number.isFinite(target.z))state.operation.supportRequests=[...(state.operation.supportRequests??[]),{at:state.elapsed,squadId,side,source,kind,target:{...target},accepted:result.accepted,reason:result.reason}].slice(-64);
  return result;
}
function validateSupport(state:BattlefieldState,kind:SupportKind,squadId:number,target:Vec2,confirmedRisk:boolean,terrain:TerrainSystem|undefined,source:SupportSource,positionId?:number):{accepted:boolean;warning?:boolean;reason:string} {
  const op=state.operation,q=state.squads.find(q=>q.id===squadId);if(!op?.supportRules||op.status!=='active'||!q||![target.x,target.z].every(Number.isFinite))return{accepted:false,reason:'Support unavailable'};
  const requestingSide=q.faction??'player';
  if(!supportSourceMatchesSide(requestingSide,source,op.authored?.controllers[requestingSide]))return{accepted:false,reason:'Support authority rejected: this faction requires its active controller'};
  if((requestingSide==='enemy'||source==='AUTHORED_AI')&&!(op.intelligence?.command[requestingSide]??op.contacts?.[requestingSide]??[]).some(c=>c.active&&state.elapsed-c.lastSeen<=12&&distance(c,target)<=Math.max(5,Math.min(30,c.uncertainty??0))))return{accepted:false,reason:'No recent delivered report for this support target'};
  const ready=supportReadiness(state,kind,squadId,terrain,true,positionId),operator=state.soldiers.find(s=>s.id===ready.operatorId),range=distance(operator??q,target),grenade=kind==='smokeGrenades';
  const artillery=state.living?.facilities.some(f=>f.id===positionId&&f.artillery);
  if(ready.reason)return{accepted:false,reason:ready.reason};
  if(range>(grenade?30:artillery?1600:900)||!grenade&&range<(artillery?100:50))return{accepted:false,reason:grenade?'Smoke grenade exceeds 30m throw':artillery?'Field gun target must be 100–1600m away':'Mortar target must be 50–900m away'};
  if(artillery){const f=state.living!.facilities.find(f=>f.id===positionId)!,angle=Math.atan2(target.x-f.x,target.z-f.z)-(f.facing??0);if(Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))>Math.PI/3)return {accepted:false,reason:'Outside the field gun’s forward 120° sector · choose a target ahead of the installed carriage'};}
  const dangerRadius=kind==='mortarHE'?(artillery?65:40):0,side=q.faction??'player';
  const risk=dangerRadius>0&&state.soldiers.some(s=>s.needs?.life!=='dead'&&state.squads.some(other=>other.id===s.squadId&&(other.faction??'player')===side)&&distance(s,target)<dangerRadius);
  if(risk&&!confirmedRisk)return{accepted:false,warning:true,reason:`Explosive danger area includes friendly troops (${dangerRadius}m). Confirm or choose another area.`};
  const id=state.nextEntityId++,spread=grenade?2:artillery?26:18,angle=hash2D(id,q.id,state.seed+3)*Math.PI*2,r=Math.sqrt(hash2D(q.id,id,state.seed+7))*spread;
  const impact={x:target.x+Math.sin(angle)*r,z:target.z+Math.cos(angle)*r},launchAt=state.elapsed+(grenade?1.5:artillery?20:15);
  (op.supportMissions??=[]).push({id,squadId:q.id,positionId:ready.positionId,...(artillery?{weapon:'field-gun' as const}:{}),kind,target:{...target},impact,requestedAt:state.elapsed,launchAt,impactAt:launchAt+(grenade?1.5:3+range/130),stage:'preparing',reason:'Preparing support mission',dangerRadius,confirmedRisk,source,side,ammoConsumed:0,crewIds:ready.crewIds});
  return{accepted:true,reason:grenade?'Smoke throw ordered':artillery?'Field gun preparing · dispersed area fire':'Legacy mortar preparing · dispersed area fire'};
}
export function stepSupport(state:BattlefieldState,terrain:TerrainSystem):void {
  const op=state.operation;if(!op?.supportRules)return;
  op.smokeFields=(op.smokeFields??[]).filter(s=>s.until>state.elapsed);
  op.blastEvents=(op.blastEvents??[]).filter(b=>state.elapsed-b.at<1);
  for(const mission of op.supportMissions??[]){
    if(mission.stage==='preparing'){
      const squad=state.squads.find(q=>q.id===mission.squadId)!,people=state.soldiers.filter(s=>(mission.crewIds?.includes(s.id)??s.squadId===squad.id)&&s.needs?.life==='active'&&s.suppression<70&&s.action!=='sleeping'&&!s.combat?.careTask),grenade=mission.kind==='smokeGrenades';
      const position=state.living?.facilities.find(f=>f.id===mission.positionId);
      const operator=grenade?people[0]:position&&crewOperator(state,position);
      const pack=grenade?people.find(s=>(s.carried?.[mission.kind]??0)>=1&&(!operator||distance(s,operator)<12)):operator;
      const ready=supportReadiness(state,mission.kind,mission.squadId,terrain,false,mission.positionId);
      if(!grenade&&(!position||mission.crewIds?.some(id=>!position.weaponCrewIds?.includes(id)))){mission.stage='cancelled';mission.reason='Cancelled: assigned pit or crew changed';continue;}
      if(ready.reason||!pack){mission.stage='cancelled';mission.reason='Cancelled: '+(ready.reason||'Ammunition carrier unavailable');continue;}
      if(mission.crewIds?.some(id=>!people.some(s=>s.id===id&&operator&&distance(s,operator)<12))){mission.stage='cancelled';mission.reason='Cancelled: assigned support crew interrupted';continue;}
      if(state.elapsed<mission.launchAt)continue;
      if(grenade&&distance(pack,mission.target)>30){mission.stage='cancelled';mission.reason='Thrower moved beyond grenade range';continue;}
      const side=squad.faction??'player',danger=mission.kind==='mortarHE'&&state.soldiers.some(s=>s.needs?.life!=='dead'&&state.squads.some(q=>q.id===s.squadId&&(q.faction??'player')===side)&&distance(s,mission.target)<mission.dangerRadius);
      if(danger&&!mission.confirmedRisk){mission.stage='cancelled';mission.reason='Friendly troops entered danger area before launch';continue;}
      consume(state,grenade?pack.carried!:position!.stock,mission.kind,1);mission.ammoConsumed=(mission.ammoConsumed??0)+1;mission.stage='flight';mission.reason='Round in flight';
    }
    if(mission.stage==='flight'&&state.elapsed>=mission.impactAt){
      mission.stage='complete';mission.reason='Mission complete';
      if(mission.kind!=='mortarHE'){op.smokeFields.push({id:mission.id,...mission.impact,radius:mission.kind==='smokeGrenades'?11:18,born:state.elapsed,until:state.elapsed+60});continue;}
      const heavy=mission.weapon==='field-gun',pressureRadius=heavy?65:40,woundRadius=heavy?28:18;
      op.blastEvents.push({id:mission.id,...mission.impact,at:state.elapsed,radius:heavy?34:18});
      for(const s of state.soldiers){
        const d=distance(s,mission.impact);if(d>pressureRadius||s.needs?.life==='dead'||s.combat?.wound?.care==='evacuated')continue;
        const body=bodyVolume(terrain,s),y=terrain.heightAt(mission.impact.x,mission.impact.z)+.7,clear=terrain.objects.trace(mission.impact,s,y,body.y,false,true).clear;
        const pressure=(1-d/pressureRadius)*(clear?85:15);s.suppression=Math.min(100,s.suppression+pressure);s.morale=Math.max(0,s.morale-pressure*.15);registerIncoming(s,state.elapsed,Math.atan2(mission.impact.x-s.x,mission.impact.z-s.z));
        if(state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy')signalEngagement(state);
        if(d<woundRadius&&clear)combatWound(state,s,{cause:'artillery',id:mission.id,at:state.elapsed,shooterId:0,squadId:mission.squadId,from:{...mission.impact,y},to:body,hitId:s.id,energy:Math.max(.1,1-d/(woundRadius+2))});
      }
      // This impact is resolved against the structure that intercepted it;
      // preset damage affects subsequent shots, never exposes occupants retroactively.
      for(const [id,b] of terrain.buildings.entries())if(distance(b,mission.impact)<24){let change=state.buildingChanges?.find(v=>v.id===id);if(!change){change={id,condition:'intact',damage:0};(state.buildingChanges??=[]).push(change);}change.damage+=Math.max(0,24-distance(b,mission.impact))*3;change.condition=change.damage>=120?'ruined':change.damage>=50?'damaged':'intact';}
      if(heavy){bombardGround(state,mission.impact);terrain.syncModifications();}
    }
  }
  op.supportMissions=(op.supportMissions??[]).filter(m=>['preparing','flight'].includes(m.stage)||state.elapsed-m.impactAt<120).slice(-64);
}
export function smokeTransmission(state:BattlefieldState,a:Vec2,b:Vec2):number {
  let depth=0;const length=distance(a,b);if(length<.01)return 1;
  const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
  for(const cloud of state.operation?.smokeFields??[]){
    if(cloud.until<=state.elapsed)continue;
    const along=(cloud.x-a.x)*dx+(cloud.z-a.z)*dz,across=Math.abs((cloud.x-a.x)*dz-(cloud.z-a.z)*dx);
    if(across>=cloud.radius)continue;const half=Math.sqrt(cloud.radius**2-across**2),chord=Math.max(0,Math.min(length,along+half)-Math.max(0,along-half));
    depth+=chord*.45*Math.min(1,(state.elapsed-cloud.born+1)/4,(cloud.until-state.elapsed)/10);
  }return Math.exp(-depth);
}
