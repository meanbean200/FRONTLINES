import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {hash2D} from '../core/random';
import {consume} from '../garrison/Inventory';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {bodyVolume} from './Ballistics';
import {combatWound} from './Casualties';
import {registerIncoming} from './Reactions';
import {signalEngagement} from './Engagement';
export type SupportKind='mortarHE'|'mortarSmoke'|'smokeGrenades';
export const SUPPORT_NAMES:Record<SupportKind,string>={mortarHE:'Mortar HE',mortarSmoke:'Mortar smoke',smokeGrenades:'Smoke grenade'};
/** Read-only readiness, shared by command validation, live missions and the HUD. */
export function supportReadiness(state:BattlefieldState,kind:SupportKind,squadId:number,terrain?:TerrainSystem,checkBusy=true){
  const q=state.squads.find(q=>q.id===squadId),grenade=kind==='smokeGrenades';
  const people=state.soldiers.filter(s=>s.squadId===squadId&&s.needs?.life==='active');
  const available=people.filter(s=>s.suppression<70&&s.action!=='sleeping'&&!s.combat?.careTask);
  const crew=available.filter(s=>q&&distance(s,q)<12),ammo=people.reduce((n,s)=>n+(s.carried?.[kind]??0),0);
  const pack=available.find(s=>(s.carried?.[kind]??0)>=1);
  let reason='';
  if(!state.operation?.supportRules||state.operation.status!=='active'||!q)reason='Support unavailable in this scenario';
  else if(!grenade&&q.kind!=='mortar')reason='Select a mortar team';
  else if(checkBusy&&state.operation.supportMissions?.some(m=>m.squadId===q.id&&['preparing','flight'].includes(m.stage)))reason='Support mission already in progress';
  else if(ammo<1)reason=`No ${SUPPORT_NAMES[kind].toLowerCase()} ammunition`;
  else if(!grenade&&q.order.type==='move')reason='Team moving · Hold [H] before setting up the mortar';
  else if(!pack)reason='Ammunition carrier unavailable: pinned, asleep or treating a casualty';
  else if(!grenade&&crew.length<2)reason='Need 2 ready crew within 12 m · regroup the team';
  else if(!grenade&&terrain&&[pack,...crew].some(s=>{const id=terrain.buildingAt(s);return id!==undefined&&state.buildingChanges?.find(b=>b.id===id)?.condition!=='ruined';}))reason='Mortar needs an open-air position clear of roofs';
  return {ammo:Math.floor(ammo),crew:crew.length,reason};
}
export function selectedSupportTeam(state:BattlefieldState,ids:ReadonlySet<number>,kind:SupportKind,terrain?:TerrainSystem):number|undefined{
  const teams=state.squads.filter(q=>ids.has(q.id)&&q.faction!=='enemy'&&(kind==='smokeGrenades'||q.kind==='mortar'));
  return (teams.find(q=>!supportReadiness(state,kind,q.id,terrain).reason)??teams[0])?.id;
}
export function supportMissionText(m:SupportMission,now:number):string{
  return m.stage==='preparing'?`Preparing · ${Math.max(0,Math.ceil(m.launchAt-now))} s to fire`:m.stage==='flight'?`Round in flight · ${Math.max(0,Math.ceil(m.impactAt-now))} s to impact`:m.stage==='complete'?'Impact complete':m.reason;
}
export interface SupportMission {id:number;squadId:number;kind:SupportKind;target:Vec2;impact:Vec2;requestedAt:number;launchAt:number;impactAt:number;stage:'preparing'|'flight'|'complete'|'cancelled';reason:string;dangerRadius:number;confirmedRisk:boolean}
export interface SmokeField extends Vec2 {id:number;radius:number;until:number;born:number}
export interface BlastEvent extends Vec2 {id:number;at:number;radius:number}
export function requestSupport(state:BattlefieldState,kind:SupportKind,squadId:number,target:Vec2,confirmedRisk=false,terrain?:TerrainSystem):{accepted:boolean;warning?:boolean;reason:string} {
  const op=state.operation,q=state.squads.find(q=>q.id===squadId);if(!op?.supportRules||op.status!=='active'||!q||![target.x,target.z].every(Number.isFinite))return{accepted:false,reason:'Support unavailable'};
  const ready=supportReadiness(state,kind,squadId,terrain),range=distance(q,target),grenade=kind==='smokeGrenades';
  if(ready.reason)return{accepted:false,reason:ready.reason};
  if(range>(grenade?30:900)||!grenade&&range<50)return{accepted:false,reason:grenade?'Smoke grenade exceeds 30m throw':'Mortar target must be 50–900m away'};
  if((op.supportMissions??[]).some(m=>m.squadId===q.id&&['preparing','flight'].includes(m.stage)))return{accepted:false,reason:'Support mission already in progress'};
  const dangerRadius=kind==='mortarHE'?40:0,side=q.faction??'player';
  const risk=dangerRadius>0&&state.soldiers.some(s=>s.needs?.life!=='dead'&&state.squads.some(other=>other.id===s.squadId&&(other.faction??'player')===side)&&distance(s,target)<dangerRadius);
  if(risk&&!confirmedRisk)return{accepted:false,warning:true,reason:'Explosive danger area includes friendly troops (40m). Confirm or choose another area.'};
  const id=state.nextEntityId++,spread=grenade?2:18,angle=hash2D(id,q.id,state.seed+3)*Math.PI*2,r=Math.sqrt(hash2D(q.id,id,state.seed+7))*spread;
  const impact={x:target.x+Math.sin(angle)*r,z:target.z+Math.cos(angle)*r},launchAt=state.elapsed+(grenade?1.5:15);
  (op.supportMissions??=[]).push({id,squadId:q.id,kind,target:{...target},impact,requestedAt:state.elapsed,launchAt,impactAt:launchAt+(grenade?1.5:3+range/130),stage:'preparing',reason:'Preparing support mission',dangerRadius,confirmedRisk});
  return{accepted:true,reason:grenade?'Smoke throw ordered':'Mortar mission preparing · dispersed area fire'};
}
export function stepSupport(state:BattlefieldState,terrain:TerrainSystem):void {
  const op=state.operation;if(!op?.supportRules)return;
  op.smokeFields=(op.smokeFields??[]).filter(s=>s.until>state.elapsed);
  op.blastEvents=(op.blastEvents??[]).filter(b=>state.elapsed-b.at<1);
  for(const mission of op.supportMissions??[]){
    if(mission.stage==='preparing'){
      const squad=state.squads.find(q=>q.id===mission.squadId)!,people=state.soldiers.filter(s=>s.squadId===squad.id&&s.needs?.life==='active'&&s.suppression<70&&s.action!=='sleeping'&&!s.combat?.careTask),grenade=mission.kind==='smokeGrenades';
      const pack=people.find(s=>(s.carried?.[mission.kind]??0)>=1);
      const ready=supportReadiness(state,mission.kind,mission.squadId,terrain,false);
      if(ready.reason||!pack){mission.stage='cancelled';mission.reason='Cancelled: '+(ready.reason||'Ammunition carrier unavailable');continue;}
      if(state.elapsed<mission.launchAt)continue;
      if(grenade&&distance(pack,mission.target)>30){mission.stage='cancelled';mission.reason='Thrower moved beyond grenade range';continue;}
      const side=squad.faction??'player',danger=mission.kind==='mortarHE'&&state.soldiers.some(s=>s.needs?.life!=='dead'&&state.squads.some(q=>q.id===s.squadId&&(q.faction??'player')===side)&&distance(s,mission.target)<mission.dangerRadius);
      if(danger&&!mission.confirmedRisk){mission.stage='cancelled';mission.reason='Friendly troops entered danger area before launch';continue;}
      consume(state,pack.carried!,mission.kind,1);mission.stage='flight';mission.reason='Round in flight';
    }
    if(mission.stage==='flight'&&state.elapsed>=mission.impactAt){
      mission.stage='complete';mission.reason='Mission complete';
      if(mission.kind!=='mortarHE'){op.smokeFields.push({id:mission.id,...mission.impact,radius:mission.kind==='smokeGrenades'?11:18,born:state.elapsed,until:state.elapsed+60});continue;}
      op.blastEvents.push({id:mission.id,...mission.impact,at:state.elapsed,radius:18});
      for(const s of state.soldiers){
        const d=distance(s,mission.impact);if(d>40||s.needs?.life==='dead'||s.combat?.wound?.care==='evacuated')continue;
        const body=bodyVolume(terrain,s),y=terrain.heightAt(mission.impact.x,mission.impact.z)+.7,clear=terrain.objects.trace(mission.impact,s,y,body.y,false,true).clear;
        const pressure=(1-d/40)*(clear?85:15);s.suppression=Math.min(100,s.suppression+pressure);s.morale=Math.max(0,s.morale-pressure*.15);registerIncoming(s,state.elapsed,Math.atan2(mission.impact.x-s.x,mission.impact.z-s.z));
        if(state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy')signalEngagement(state);
        if(d<18&&clear)combatWound(state,s,{id:mission.id,at:state.elapsed,shooterId:0,squadId:mission.squadId,from:{...mission.impact,y},to:body,hitId:s.id,energy:Math.max(.1,1-d/20)});
      }
      // This impact is resolved against the structure that intercepted it;
      // preset damage affects subsequent shots, never exposes occupants retroactively.
      for(const [id,b] of terrain.buildings.entries())if(distance(b,mission.impact)<24){let change=state.buildingChanges?.find(v=>v.id===id);if(!change){change={id,condition:'intact',damage:0};(state.buildingChanges??=[]).push(change);}change.damage+=Math.max(0,24-distance(b,mission.impact))*3;change.condition=change.damage>=120?'ruined':change.damage>=50?'damaged':'intact';}
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
