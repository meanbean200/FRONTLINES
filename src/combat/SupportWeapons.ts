import {distance,type BattlefieldState,type Vec2} from '../core/types';
import {hash2D} from '../core/random';
import {consume} from '../garrison/Inventory';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {bodyVolume} from './Ballistics';
import {combatWound} from './Casualties';
import {registerIncoming} from './Reactions';
import {signalEngagement} from './Engagement';
export type SupportKind='mortarHE'|'mortarSmoke'|'smokeGrenades';
export interface SupportMission {id:number;squadId:number;kind:SupportKind;target:Vec2;impact:Vec2;requestedAt:number;launchAt:number;impactAt:number;stage:'preparing'|'flight'|'complete'|'cancelled';reason:string;dangerRadius:number;confirmedRisk:boolean}
export interface SmokeField extends Vec2 {id:number;radius:number;until:number;born:number}
export interface BlastEvent extends Vec2 {id:number;at:number;radius:number}
export function requestSupport(state:BattlefieldState,kind:SupportKind,squadId:number,target:Vec2,confirmedRisk=false):{accepted:boolean;warning?:boolean;reason:string} {
  const op=state.operation,q=state.squads.find(q=>q.id===squadId);if(!op?.supportRules||op.status!=='active'||!q||![target.x,target.z].every(Number.isFinite))return{accepted:false,reason:'Support unavailable'};
  const people=state.soldiers.filter(s=>s.squadId===q.id&&s.needs?.life==='active'),ammo=people.reduce((n,s)=>n+(s.carried?.[kind]??0),0),range=distance(q,target),grenade=kind==='smokeGrenades';
  if(!grenade&&q.kind!=='mortar')return{accepted:false,reason:'Select a mortar team'};
  if(!people.length||!grenade&&people.length<2||ammo<1)return{accepted:false,reason:'Crew or ammunition unavailable'};
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
      const crew=people.filter(s=>distance(s,squad)<12),pack=people.find(s=>(s.carried?.[mission.kind]??0)>=1);
      if(!pack||!grenade&&(crew.length<2||squad.order.type==='move')){mission.stage='cancelled';mission.reason='Mission cancelled: crew moved, pinned or ammunition unavailable';continue;}
      if(!grenade&&[pack,...crew].some(s=>{const id=terrain.buildingAt(s);return id!==undefined&&state.buildingChanges?.find(b=>b.id===id)?.condition!=='ruined';})){
        mission.stage='cancelled';mission.reason='Mortar needs an open-air position clear of roofs';continue;
      }
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
