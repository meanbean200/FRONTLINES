import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import {hasEquipment} from './Equipment';
import {hash2D} from '../core/random';
import {consume,transfer} from '../garrison/Inventory';
import {dropCargo} from '../garrison/NeedsSystem';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {ShotEvent} from './types';
import {beginBuildingTravel} from '../simulation/BuildingSystem';
import {RESCUE_LIMITS,careRouteLength,nearbyAidPost,rescueExposed,treatmentSeconds} from './CasualtyTriage';
import {insideWorld} from '../terrain/WorldLayout';
import {recordDeath,type DamageOrigin} from '../simulation/DeathRecord';

export interface Wound {severity:'legacy'|'minor'|'disabling'|'critical'|'fatal';at:number;bleedUntil?:number;stabilized:boolean;care:'untreated'|'stabilized'|'aid-post'|'awaiting-transport'|'transport'|'evacuated';returnAt?:number;origin?:DamageOrigin}
export interface CareTask {patientId:number;stage:'approach'|'treat'|'carry'|'evacuate';route:Vec2[];index:number;progress:number;destination:Vec2;facilityId?:number;blockedFor:number;buildingExit?:boolean;reviewAt?:number;legStartedAt?:number}
export interface RescueDecision {patientId:number;side:'player'|'enemy';reason:string;choice:'pending'|'hold'|'approved';reviewAt:number}
export function combatWound(state:BattlefieldState,s:SoldierState,event:ShotEvent):void {
  if(s.needs?.life==='dead')return;
  const c=s.combat??={shotSequence:0},r=hash2D(event.id,s.id,state.seed+9841);
  const severity:Wound['severity']=event.energy>.75?(r<.24?'fatal':r<.52?'critical':r<.9?'disabling':'minor'):(r<.2?'critical':r<.55?'disabling':'minor');
  const previous=c.wound;
  if(previous&&previous.severity!=='minor'&&previous.severity!=='legacy'&&severity==='minor')return;
  const origin:DamageOrigin={cause:event.cause??'combat-fire',at:state.elapsed,eventId:event.id,shooterId:event.shooterId,squadId:event.squadId};
  c.wound={severity,at:state.elapsed,stabilized:false,care:'untreated',bleedUntil:severity==='critical'?state.elapsed+240:undefined,origin};
  if(severity==='fatal')recordDeath(state,s,origin);
  else s.health=Math.min(s.health,severity==='minor'?80:severity==='critical'?20:45);
  s.lastHitAt=state.elapsed;s.morale=Math.max(0,s.morale-25);
  if(severity!=='minor'){
    s.needs!.life=severity==='fatal'?'dead':'incapacitated';s.action=s.needs!.life;delete s.duty;dropCargo(state,s);
  }
}
const serious=(w:Wound)=>w.severity==='disabling'||w.severity==='critical';

export function updateCasualtyCare(state:BattlefieldState,terrain:TerrainSystem,navigation:SquadNavigation,dt:number):void {
  const op=state.operation;if(!op?.casualtyRules)return;
  const byId=new Map(state.soldiers.map(s=>[s.id,s])),squads=new Map(state.squads.map(q=>[q.id,q])),w=state.living!;
  op.rescueDecisions??=[];
  // Routine failures are passive status, not requests for permission. Recheck
  // both factions on the same bounded cadence. An explicit legacy Hold persists.
  const blockedRescues=new Set(op.rescueDecisions.filter(d=>d.choice!=='approved'&&(d.choice==='hold'&&d.side==='player'||state.elapsed<d.reviewAt)).map(d=>d.patientId));
  const reportBlocked=(patientId:number,side:'player'|'enemy',reason:string)=>{
    let decision=op.rescueDecisions!.find(d=>d.patientId===patientId);
    if(!decision){decision={patientId,side,reason,choice:side==='player'?'pending':'hold',reviewAt:state.elapsed+30};op.rescueDecisions!.push(decision);}
    else {decision.reason=reason;decision.choice=side==='player'?'pending':'hold';decision.reviewAt=state.elapsed+30;}
    blockedRescues.add(patientId);
  };
  const release=(helper:SoldierState)=>{
    const c=helper.combat!,task=c.careTask,patient=task?byId.get(task.patientId):undefined;
    // Never pull an uncollected patient to a dead helper's distant position.
    if(patient?.needs?.life==='incapacitated'&&['carry','evacuate'].includes(task!.stage))patient.action=patient.combat?.wound?.care==='aid-post'?'at aid post':'incapacitated';
    delete c.careTask;c.nextCareReview=state.elapsed+RESCUE_LIMITS.review;
    if(c.owner==='casualty'){c.owner=helper.duty?'duty':'order';delete c.pauseReason;if(helper.needs?.life==='active')helper.action='holding';}
  };
  for(const s of state.soldiers){
    const wound=s.combat?.wound;if(!wound||s.needs?.life==='dead')continue;
    if(s.action==='being carried'&&!state.soldiers.some(h=>h.combat?.careTask?.patientId===s.id&&['carry','evacuate'].includes(h.combat.careTask.stage)))s.action='incapacitated';
    if(wound.bleedUntil!==undefined&&!wound.stabilized&&state.elapsed>=wound.bleedUntil){recordDeath(state,s,wound.origin??{cause:'legacy-unknown',at:wound.at});wound.severity='fatal';delete wound.bleedUntil;continue;}
    if(wound.care==='evacuated'){s.action='evacuated';continue;}
  }
  // Passengers are physical truck cargo in their own two-stretcher capacity.
  for(const truck of w.trucks){
    truck.passengers=(truck.passengers??[]).filter(id=>byId.get(id)?.needs?.life!=='dead');
    if(truck.role==='shuttle'&&['unloading','returning'].includes(truck.state))for(const patient of state.soldiers){
      if(truck.passengers.length>=2)break;
      if(patient.needs?.life!=='incapacitated'||patient.combat?.wound?.care!=='awaiting-transport'||(squads.get(patient.squadId)?.faction??'player')!==(truck.faction??'player')||distance(patient,truck)>=5)continue;
      truck.passengers.push(patient.id);patient.combat.wound.care='transport';delete patient.combat.pauseReason;
    }
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
      if(task)release(helper);continue;
    }
    const squad=squads.get(helper.squadId)!,side=squad.faction??'player',medic=hasEquipment(state,helper,'medicalKit');
    if(task&&(!byId.get(task.patientId)?.combat?.wound||byId.get(task.patientId)?.needs?.life==='dead')){release(helper);continue;}
    if(c.owner==='reaction'||c.owner==='support'||c.reaction==='pinned'||c.reaction==='broken'){
      if(task&&(c.reaction==='pinned'||c.reaction==='broken')){reportBlocked(task.patientId,side,'Rescue interrupted: helper pinned or withdrawing');release(helper);}continue;
    }
    if(!task&&(medic||helper.duty?.kind!=='watch')&&state.elapsed>=(c.nextCareReview??0)){
      c.nextCareReview=state.elapsed+3+(helper.id%5)*.2;
      const team=state.soldiers.filter(s=>s.squadId===helper.squadId&&s.needs?.life==='active');
      const buddyLimit=Math.min(team.length-1,Math.max(1,Math.floor(team.length/4)));
      if((helper.needs?.energy??100)<25||!medic&&team.filter(s=>s.combat?.careTask&&!hasEquipment(state,s,'medicalKit')).length>=buddyLimit)continue;
      const radius=medic?RESCUE_LIMITS.medicApproach:RESCUE_LIMITS.buddyApproach;
      const urgency=(p:SoldierState)=>p.combat!.wound!.stabilized?2:p.combat!.wound!.severity==='critical'?0:1;
      const patients=state.soldiers.filter(p=>p!==helper&&!blockedRescues.has(p.id)&&p.needs?.life!=='dead'&&(squads.get(p.squadId)?.faction??'player')===side&&p.combat?.wound&&p.combat.wound.severity!=='legacy'&&p.combat.wound.severity!=='fatal'&&!['awaiting-transport','transport','evacuated'].includes(p.combat.wound.care)&&(!p.combat.wound.stabilized||serious(p.combat.wound))&&distance(p,helper)<radius&&!state.soldiers.some(s=>s.combat?.careTask?.patientId===p.id)).sort((a,b)=>urgency(a)-urgency(b)||distance(helper,a)-distance(helper,b)||a.id-b.id);
      for(const patient of patients){
        const wound=patient.combat!.wound!,decision=op.rescueDecisions.find(d=>d.patientId===patient.id);
        if(!wound.stabilized&&(helper.carried?.medical??0)<1)continue;
        if(wound.stabilized&&!nearbyAidPost(state,navigation,patient,patient,side)){reportBlocked(patient.id,side,'Stabilized locally · waiting for an available aid post within 120 m walking');continue;}
        const route=navigation.plan(helper,patient);
        if(!route.length){reportBlocked(patient.id,side,'Casualty route blocked');continue;}
        const length=careRouteLength(helper,route),stairs=patient.building?.floor===1?16:0;
        if(length>radius)continue;
        if(wound.bleedUntil!==undefined&&!wound.stabilized&&state.elapsed+length/1.7+stairs+treatmentSeconds(medic)>=wound.bleedUntil){patient.combat!.pauseReason='Critical · waiting for aid that can arrive in time';continue;}
        if(rescueExposed(state,terrain,helper,route)&&decision?.choice!=='approved'){reportBlocked(patient.id,side,'Rescue exposed to reported enemy fire');continue;}
        task=c.careTask={patientId:patient.id,stage:'approach',route,index:0,progress:0,destination:{x:patient.x,z:patient.z},blockedFor:0,reviewAt:state.elapsed,legStartedAt:state.elapsed};
        if(decision?.choice!=='approved')op.rescueDecisions=op.rescueDecisions.filter(d=>d.patientId!==patient.id);
        delete patient.combat!.pauseReason;break;
      }
    }
    if(!task)continue;
    const patient=byId.get(task.patientId),wound=patient?.combat?.wound;
    if(!patient||!wound||patient.needs?.life==='dead'){release(helper);continue;}
    task.legStartedAt??=state.elapsed;
    if(state.elapsed>=(task.reviewAt??0)){
      task.reviewAt=state.elapsed+RESCUE_LIMITS.review;
      const remaining=careRouteLength(helper,task.route,task.index),limit=task.stage==='approach'?(medic?RESCUE_LIMITS.medicApproach:RESCUE_LIMITS.buddyApproach):task.stage==='evacuate'?RESCUE_LIMITS.pickup:RESCUE_LIMITS.carry;
      let reason=remaining>limit?`Casualty route blocked: ${Math.ceil(remaining)} m walk exceeds automatic ${limit} m limit`:state.elapsed-task.legStartedAt>RESCUE_LIMITS.legTimeout?'Casualty route blocked: rescue made no timely progress':undefined;
      if(!reason&&task.stage==='carry'&&!w.facilities.some(f=>f.id===task!.facilityId&&f.progress===1&&w.garrisons.some(g=>g.id===f.garrisonId&&(g.faction??'player')===side)))reason='Casualty route blocked: aid post no longer available';
      if(!reason&&!wound.stabilized&&wound.bleedUntil!==undefined&&state.elapsed+remaining/1.7+Math.max(0,treatmentSeconds(medic)-(task.stage==='treat'?task.progress:0))>=wound.bleedUntil){patient.combat!.pauseReason='Critical · waiting for aid that can arrive in time';release(helper);continue;}
      if(!reason&&op.rescueDecisions.find(d=>d.patientId===patient.id)?.choice!=='approved'&&rescueExposed(state,terrain,helper,task.route.slice(task.index)))reason='Rescue exposed to reported enemy fire';
      if(reason){patient.combat!.pauseReason=reason;reportBlocked(patient.id,side,reason);release(helper);continue;}
    }
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
      if(!insideWorld({x,z})||terrain.obstacleAt(x,z,.45)){
        task.blockedFor+=dt;helper.action='casualty route blocked';
        if(task.blockedFor>5){reportBlocked(patient.id,side,'Casualty route blocked');release(helper);c.nextCareReview=state.elapsed+30;}continue;
      }
      task.blockedFor=0;helper.heading=Math.atan2(target.x-helper.x,target.z-helper.z);helper.x=x;helper.z=z;helper.action=task.stage==='carry'||task.stage==='evacuate'?'carrying casualty':'moving to casualty';
      if(task.stage==='carry'||task.stage==='evacuate'){patient.x=x;patient.z=z;patient.action='being carried';}continue;
    }
    if(task.stage==='approach'){if(distance(helper,patient)>1.5){task.route=navigation.plan(helper,patient);task.index=0;continue;}task.stage='treat';task.progress=0;task.legStartedAt=state.elapsed;}
    if(task.stage==='treat'){
      helper.action='treating';task.progress+=dt;
      if(!wound.stabilized&&task.progress<treatmentSeconds(medic))continue;
      if(!wound.stabilized){if(consume(state,helper.carried!,'medical',1)<1){release(helper);continue;}wound.stabilized=true;wound.care='stabilized';delete wound.bleedUntil;}
      if(!serious(wound)){patient.health=Math.max(patient.health,90);delete patient.combat!.wound;release(helper);continue;}
      const choice=nearbyAidPost(state,navigation,patient,helper,side);
      if(!choice){patient.combat!.pauseReason='Stabilized · nearby aid post needed';reportBlocked(patient.id,side,'Stabilized locally · waiting for an available aid post within 120 m walking');release(helper);continue;}
      delete patient.combat!.pauseReason;
      task.stage='carry';task.progress=wound.care==='aid-post'?24:0;task.facilityId=choice.post.id;task.destination={x:choice.post.x,z:choice.post.z};task.route=choice.route;task.index=0;task.legStartedAt=state.elapsed;task.reviewAt=0;
    }else if(task.stage==='carry'){
      wound.care='aid-post';task.progress+=dt;helper.action='treating at aid post';
      if(task.progress<24)continue;
      const g=w.garrisons.find(g=>g.id===w.facilities.find(f=>f.id===task.facilityId)?.garrisonId);
      const route=g?navigation.plan(helper,g.forward):[],length=careRouteLength(helper,route);
      if(!g||!route.length||length>RESCUE_LIMITS.pickup||distance(route.at(-1)!,g.forward)>=4||!w.trucks.some(t=>t.role==='shuttle'&&(t.faction??'player')===side&&t.state!=='blocked'&&t.fuel>0)){
        patient.action='at aid post';patient.combat!.pauseReason='At aid post · safe nearby transport access needed';reportBlocked(patient.id,side,'Casualty route blocked: aid post needs a usable truck pickup within 60 m walking');release(helper);continue;
      }
      task.stage='evacuate';task.destination={...g.forward};task.route=route;task.index=0;task.legStartedAt=state.elapsed;task.reviewAt=0;delete task.facilityId;
    }else if(task.stage==='evacuate'){
      // The wounded person waits at the actual roadhead, not on a helper's back.
      // The physical truck pass above boards them only when a vehicle arrives.
      wound.care='awaiting-transport';patient.x=helper.x;patient.z=helper.z;patient.action='waiting for casualty transport';patient.combat!.pauseReason='At pickup · waiting for a truck';release(helper);patient.action='waiting for casualty transport';
    }
  }
  // Medics draw supplies only while physically at a friendly store or cache.
  for(const s of state.soldiers.filter(s=>hasEquipment(state,s,'medicalKit')&&s.needs?.life==='active'))for(const g of w.garrisons.filter(g=>(g.faction??'player')===(squads.get(s.squadId)?.faction??'player'))){if(distance(s,g.entrance)<4)transfer(g.cache,s.carried!,'medical',Math.min(dt,8-s.carried!.medical));for(const f of w.facilities.filter(f=>f.garrisonId===g.id&&f.progress===1))if(distance(s,f)<4)transfer(f.stock,s.carried!,'medical',Math.min(dt,8-s.carried!.medical));}
  op.rescueDecisions=op.rescueDecisions.filter(d=>{const p=byId.get(d.patientId),wound=p?.combat?.wound;return wound&&p?.needs?.life!=='dead'&&!['awaiting-transport','transport','evacuated'].includes(wound.care);});
}
