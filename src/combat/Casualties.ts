import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import {hasEquipment} from './Equipment';
import {hash2D} from '../core/random';
import {consume,transfer} from '../garrison/Inventory';
import {dropCargo} from '../garrison/NeedsSystem';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {squadContacts} from '../operations/Visibility';
import type {ShotEvent} from './types';
import {beginBuildingTravel} from '../simulation/BuildingSystem';

export interface Wound {severity:'legacy'|'minor'|'disabling'|'critical'|'fatal';at:number;bleedUntil?:number;stabilized:boolean;care:'untreated'|'stabilized'|'aid-post'|'transport'|'evacuated';returnAt?:number}
export interface CareTask {patientId:number;stage:'approach'|'treat'|'carry'|'evacuate';route:Vec2[];index:number;progress:number;destination:Vec2;facilityId?:number;blockedFor:number;buildingExit?:boolean}
export interface RescueDecision {patientId:number;side:'player'|'enemy';reason:string;choice:'pending'|'hold'|'approved';reviewAt:number}
export function combatWound(state:BattlefieldState,s:SoldierState,event:ShotEvent):void {
  if(s.needs?.life==='dead')return;
  const c=s.combat??={shotSequence:0},r=hash2D(event.id,s.id,state.seed+9841);
  const severity:Wound['severity']=event.energy>.75?(r<.24?'fatal':r<.52?'critical':r<.9?'disabling':'minor'):(r<.2?'critical':r<.55?'disabling':'minor');
  const previous=c.wound;
  if(previous&&previous.severity!=='minor'&&previous.severity!=='legacy'&&severity==='minor')return;
  c.wound={severity,at:state.elapsed,stabilized:false,care:'untreated',bleedUntil:severity==='critical'?state.elapsed+240:undefined};
  s.health=severity==='fatal'?0:Math.min(s.health,severity==='minor'?80:severity==='critical'?20:45);s.lastHitAt=state.elapsed;s.morale=Math.max(0,s.morale-25);
  if(severity!=='minor'){
    s.needs!.life=severity==='fatal'?'dead':'incapacitated';s.action=s.needs!.life;delete s.duty;dropCargo(state,s);
    if(severity==='fatal')state.living!.metrics.deaths++;
  }
}
const serious=(w:Wound)=>w.severity==='disabling'||w.severity==='critical';

export function updateCasualtyCare(state:BattlefieldState,terrain:TerrainSystem,navigation:SquadNavigation,dt:number):void {
  const op=state.operation;if(!op?.casualtyRules)return;
  const byId=new Map(state.soldiers.map(s=>[s.id,s])),squads=new Map(state.squads.map(q=>[q.id,q])),w=state.living!;
  op.rescueDecisions??=[];
  const blockedRescues=new Set(op.rescueDecisions.filter(d=>d.choice!=='approved'&&d.reason.startsWith('Casualty route blocked')&&(d.side==='player'||state.elapsed<d.reviewAt)).map(d=>d.patientId));
  const reportBlocked=(patientId:number,side:'player'|'enemy',reason:string)=>{
    let decision=op.rescueDecisions!.find(d=>d.patientId===patientId);
    if(!decision){decision={patientId,side,reason,choice:side==='player'?'pending':'hold',reviewAt:state.elapsed+30};op.rescueDecisions!.push(decision);}
    else {decision.reason=reason;decision.choice=side==='player'?'pending':'hold';decision.reviewAt=state.elapsed+30;}
    blockedRescues.add(patientId);
  };
  for(const s of state.soldiers){
    const wound=s.combat?.wound;if(!wound||s.needs?.life==='dead')continue;
    if(wound.bleedUntil!==undefined&&!wound.stabilized&&state.elapsed>=wound.bleedUntil){s.health=0;s.needs!.life='dead';s.action='dead';wound.severity='fatal';delete wound.bleedUntil;w.metrics.deaths++;dropCargo(state,s);continue;}
    if(wound.care==='evacuated'){s.action='evacuated';continue;}
  }
  // Passengers are physical truck cargo in their own two-stretcher capacity.
  for(const truck of w.trucks){
    truck.passengers??=[];
    for(const id of truck.passengers){const patient=byId.get(id);if(!patient?.combat?.wound)continue;patient.x=truck.x;patient.z=truck.z;patient.action='casualty transport';}
    const rear=truck.faction==='enemy'?w.enemySupply?.rear:w.rear;
    if(rear&&distance(truck,rear)<5)for(const id of truck.passengers.splice(0)){
      const patient=byId.get(id);if(!patient?.combat?.wound)continue;
      patient.combat.wound.care='evacuated';patient.combat.wound.returnAt=w.campaignHours+72;patient.action='evacuated';
      delete patient.garrisonId;delete patient.trenchId;delete patient.trenchAlong;
    }
  }
  for(const helper of state.soldiers){
    const c=helper.combat??={shotSequence:0};let task=c.careTask;
    if(helper.needs?.life!=='active'){
      if(task){const p=byId.get(task.patientId);if(p){p.x=helper.x;p.z=helper.z;}delete c.careTask;}continue;
    }
    if(c.owner==='reaction'||c.owner==='support'||c.reaction==='pinned'||c.reaction==='broken')continue;
    const squad=squads.get(helper.squadId)!,side=squad.faction??'player',medic=hasEquipment(state,helper,'medicalKit');
    if(!task&&(medic||helper.duty?.kind!=='watch')&&state.elapsed>=(c.nextCareReview??0)){
      c.nextCareReview=state.elapsed+3+(helper.id%5)*.2;
      // Do not keep interrupting people to re-treat an already stabilized
      // casualty while there is nowhere reachable to take them.
      const postAvailable=(p:SoldierState)=>!p.combat!.wound!.stabilized||w.facilities.some(f=>f.kind==='aid'&&f.progress===1&&w.garrisons.some(g=>g.id===f.garrisonId&&(g.faction??'player')===side)&&state.soldiers.filter(p=>p.combat?.careTask?.facilityId===f.id).length<f.capacity&&navigation.plan(p,f).length>0);
      const patient=state.soldiers.filter(p=>p!==helper&&!blockedRescues.has(p.id)&&p.needs?.life!=='dead'&&(squads.get(p.squadId)?.faction??'player')===side&&p.combat?.wound&&p.combat.wound.severity!=='legacy'&&p.combat.wound.severity!=='fatal'&&!['transport','evacuated'].includes(p.combat.wound.care)&&(!p.combat.wound.stabilized||serious(p.combat.wound))&&distance(p,helper)<(medic?120:30)&&!state.soldiers.some(s=>s.combat?.careTask?.patientId===p.id)&&postAvailable(p)).sort((a,b)=>distance(helper,a)-distance(helper,b)||a.id-b.id)[0];
      if(patient&&(patient.combat!.wound!.stabilized||(helper.carried?.medical??0)>=1)){
        const dangerous=helper.suppression>25||squadContacts(state,helper.squadId).some(contact=>contact.active&&state.elapsed-contact.lastSeen<12&&distance(contact,patient)<100&&terrain.objects.trace(contact,patient,terrain.heightAt(contact.x,contact.z)+1.6,terrain.heightAt(patient.x,patient.z)+.4,false).clear);
        let decision=op.rescueDecisions.find(d=>d.patientId===patient.id);
        if(dangerous&&decision?.choice!=='approved'){
          if(!decision){decision={patientId:patient.id,side,reason:'Rescue exposed to reported enemy fire',choice:side==='player'?'pending':'hold',reviewAt:state.elapsed+15};op.rescueDecisions.push(decision);}
          continue;
        }
        if(decision?.choice==='hold'&&state.elapsed<decision.reviewAt)continue;
        const route=navigation.plan(helper,patient);
        if(!route.length){reportBlocked(patient.id,side,'Casualty route blocked');continue;}
        task=c.careTask={patientId:patient.id,stage:'approach',route,index:0,progress:0,destination:{x:patient.x,z:patient.z},blockedFor:0};
        if(decision)decision.choice='approved';
      }
    }
    if(!task)continue;
    const patient=byId.get(task.patientId),wound=patient?.combat?.wound;
    if(!patient||!wound||patient.needs?.life==='dead'){delete c.careTask;continue;}
    c.owner='casualty';c.pauseReason=`${task.stage==='treat'?'Treating':'Rescuing'} soldier ${patient.id}`;
    const patientInside=patient.building&&terrain.buildingAt(patient)===patient.building.id;
    if(task.stage==='approach'&&patientInside){
      if(!helper.building){if(!beginBuildingTravel(helper,patient.building!.id,patient.building!.floor,patient,terrain,navigation)){c.pauseReason='Casualty building entrance blocked';}continue;}
      if(helper.building.id===patient.building!.id){
        helper.building.target={x:patient.x,z:patient.z};
        if(helper.building.stage==='station'&&helper.building.floor===patient.building!.floor){if(distance(helper,patient)>1.5){helper.building.stage='inside';helper.building.route=[{x:patient.x,z:patient.z}];helper.building.index=0;continue;}task.index=task.route.length;}
        else continue;
      }
    }
    if(helper.building&&task.stage!=='treat'&&!(task.stage==='approach'&&patientInside)){task.buildingExit=true;continue;}
    if(task.buildingExit&&!helper.building){delete patient.building;task.route=navigation.plan(helper,task.destination);task.index=0;delete task.buildingExit;if(!task.route.length){c.pauseReason='Casualty route blocked';continue;}}
    if(task.index<task.route.length){
      const target=task.route[task.index],d=distance(helper,target),amount=Math.min(d,dt*(task.stage==='carry'||task.stage==='evacuate'?.8:1.7));
      if(d<.25){task.index++;continue;}
      const x=helper.x+(target.x-helper.x)/d*amount,z=helper.z+(target.z-helper.z)/d*amount;
      if(terrain.obstacleAt(x,z,.45)){
        task.blockedFor+=dt;helper.action='casualty route blocked';
        if(task.blockedFor>5){reportBlocked(patient.id,side,'Casualty route blocked');delete c.careTask;c.nextCareReview=state.elapsed+30;}continue;
      }
      task.blockedFor=0;helper.heading=Math.atan2(target.x-helper.x,target.z-helper.z);helper.x=x;helper.z=z;helper.action=task.stage==='carry'||task.stage==='evacuate'?'carrying casualty':'moving to casualty';
      if(task.stage==='carry'||task.stage==='evacuate'){patient.x=x;patient.z=z;patient.action='being carried';}continue;
    }
    if(task.stage==='approach'){if(distance(helper,patient)>1.5){task.route=navigation.plan(helper,patient);task.index=0;continue;}task.stage='treat';task.progress=0;}
    if(task.stage==='treat'){
      helper.action='treating';task.progress+=dt;
      if(task.progress<(medic?8:14))continue;
      if(!wound.stabilized){if(consume(state,helper.carried!,'medical',1)<1){delete c.careTask;continue;}wound.stabilized=true;wound.care='stabilized';delete wound.bleedUntil;}
      if(!serious(wound)){patient.health=Math.max(patient.health,90);delete patient.combat!.wound;delete c.careTask;continue;}
      const post=w.facilities.filter(f=>f.kind==='aid'&&f.progress===1&&w.garrisons.some(g=>g.id===f.garrisonId&&(g.faction??'player')===side)&&state.soldiers.filter(p=>p.combat?.careTask?.facilityId===f.id).length<f.capacity).sort((a,b)=>distance(a,patient)-distance(b,patient)).find(f=>navigation.plan(helper,f).length);
      if(!post){helper.action='casualty stabilized · aid post needed';patient.combat!.pauseReason='Stabilized · build a reachable aid post';c.pauseReason='Build a reachable aid post';reportBlocked(patient.id,side,'Casualty route blocked: build a reachable aid post, then retry rescue');delete c.careTask;c.nextCareReview=state.elapsed+20;continue;}
      delete patient.combat!.pauseReason;
      task.stage='carry';task.progress=0;task.facilityId=post.id;task.destination={x:post.x,z:post.z};task.route=navigation.plan(helper,post);task.index=0;
    }else if(task.stage==='carry'){
      wound.care='aid-post';task.progress+=dt;helper.action='treating at aid post';
      if(task.progress<24)continue;
      const g=w.garrisons.find(g=>g.id===w.facilities.find(f=>f.id===task.facilityId)?.garrisonId);
      if(!g){delete c.careTask;continue;}
      task.stage='evacuate';task.destination={...g.forward};task.route=navigation.plan(helper,g.forward);task.index=0;
      if(!task.route.length){task.stage='carry';task.progress=0;c.pauseReason='Evacuation route blocked';}
      else delete task.facilityId;
    }else if(task.stage==='evacuate'){
      helper.action='waiting for casualty transport';
      const truck=w.trucks.find(t=>t.role==='shuttle'&&(t.faction??'player')===side&&['returning','unloading'].includes(t.state)&&distance(t,helper)<5&&(t.passengers?.length??0)<2);
      if(truck){(truck.passengers??=[]).push(patient.id);wound.care='transport';patient.x=truck.x;patient.z=truck.z;delete c.careTask;}
    }
  }
  // Medics draw supplies only while physically at a friendly store or cache.
  for(const s of state.soldiers.filter(s=>hasEquipment(state,s,'medicalKit')&&s.needs?.life==='active'))for(const g of w.garrisons.filter(g=>(g.faction??'player')===(squads.get(s.squadId)?.faction??'player'))){if(distance(s,g.entrance)<4)transfer(g.cache,s.carried!,'medical',Math.min(dt,8-s.carried!.medical));for(const f of w.facilities.filter(f=>f.garrisonId===g.id&&f.progress===1))if(distance(s,f)<4)transfer(f.stock,s.carried!,'medical',Math.min(dt,8-s.carried!.medical));}
  op.rescueDecisions=op.rescueDecisions.filter(d=>byId.get(d.patientId)?.needs?.life!=='dead'&&byId.get(d.patientId)?.combat?.wound?.care!=='evacuated');
}
