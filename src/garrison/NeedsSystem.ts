import { clamp, type BattlefieldState, type SoldierState } from '../core/types';
import { consume } from './Inventory';
import { inventory, type Needs } from './types';
import {isWalkingAction} from '../core/SoldierActions';

export const CAMPAIGN_HOURS_PER_SECOND=24/1800;
export const NEED_RULES=Object.freeze({hungerPerHour:4,thirstPerHour:6,awakeLossPerHour:4,travelLossPerHour:6,workLossPerHour:8,sleepRecoveryPerHour:12,floorSleepRecoveryPerHour:10,restRecoveryPerHour:3,hungerDamageDelayHours:12,thirstDamageDelayHours:6});
export const freshNeeds=(fatigue=0):Needs=>({energy:100-clamp(fatigue,0,100),hunger:10,thirst:10,life:'active',hungryHours:0,thirstyHours:0,sleepHours:0,day:0,watchHours:0,interruptedSleep:0,taskChanges:0});
export function updateNeeds(state:BattlefieldState,s:SoldierState,dt:number):void {
  const w=state.living!,n=s.needs??=freshNeeds(s.fatigue),hours=dt*CAMPAIGN_HOURS_PER_SECOND;
  if(n.life==='dead'){s.action='dead';return;}
  if(s.combat?.wound?.care==='evacuated'){s.action='evacuated';return;}
  const day=Math.floor(w.campaignHours/24);if(day!==n.day){n.day=day;n.sleepHours=0;}
  const arrived=s.duty?.arrivedAt!==undefined&&s.combat?.owner!=='reaction'&&s.combat?.owner!=='casualty',kind=arrived&&s.duty?.rationUntil===undefined?s.duty!.kind:undefined;
  const asleep=kind==='sleep',resting=kind==='rest'||n.life==='incapacitated';
  const shelter=asleep&&w.facilities.some(f=>f.id===s.duty?.facilityId&&f.kind==='rest'&&f.progress===1&&Math.hypot(s.x-f.x,s.z-f.z)<4);
  const exertion=s.action==='digging'||kind==='construct'?NEED_RULES.workLossPerHour:isWalkingAction(s.action)||kind==='haul'?NEED_RULES.travelLossPerHour:NEED_RULES.awakeLossPerHour;
  n.energy=clamp(n.energy+hours*(asleep?shelter?NEED_RULES.sleepRecoveryPerHour:NEED_RULES.floorSleepRecoveryPerHour:resting?NEED_RULES.restRecoveryPerHour:-exertion),0,100);
  if(asleep)n.sleepHours+=hours;if(kind==='watch')n.watchHours+=hours;
  n.hunger=clamp(n.hunger+hours*NEED_RULES.hungerPerHour,0,100);n.thirst=clamp(n.thirst+hours*NEED_RULES.thirstPerHour,0,100);
  n.hungryHours=n.hunger>=95?n.hungryHours+hours:0;n.thirstyHours=n.thirst>=95?n.thirstyHours+hours:0;
  // Personal rations are usable while stopped, but never appear from a nearby depot.
  if(!s.duty&&s.action==='holding'&&s.carried){
    if(n.hunger>45&&s.carried.food>0)n.hunger=Math.max(0,n.hunger-40*consume(state,s.carried,'food',Math.min(1,s.carried.food)));
    if(n.thirst>40&&s.carried.water>0)n.thirst=Math.max(0,n.thirst-50*consume(state,s.carried,'water',Math.min(1,s.carried.water)));
  }
  const critical=n.hunger>90||n.thirst>90||n.energy<10;
  if(critical)w.metrics.criticalNeedHours+=hours;
  // Reserve squads have no autonomous supply organization until assigned to a garrison.
  if(w.lethalNeeds&&s.garrisonId!==undefined&&(n.hungryHours>NEED_RULES.hungerDamageDelayHours||n.thirstyHours>NEED_RULES.thirstDamageDelayHours))s.health=Math.max(0,s.health-hours*(n.thirstyHours>NEED_RULES.thirstDamageDelayHours?12:5));
  else if(!s.combat?.wound&&n.hunger<65&&n.thirst<65&&(resting||asleep))s.health=Math.min(100,s.health+hours*6);
  const g=w.garrisons.find(g=>g.id===s.garrisonId),dutyStress=g?Math.max(0,g.watchRequired-g.watchPresent)/Math.max(1,g.watchRequired):0;
  s.morale=clamp(s.morale+hours*((critical?-4:asleep?shelter?1.5:.5:.4)-dutyStress-(g?.lossRate??0)),0,100);
  s.fatigue=100-n.energy;
  if(s.health<=0){n.life='dead';s.action='dead';w.metrics.deaths++;}
  else if(n.energy<=.1||s.health<15){n.life='incapacitated';s.action='incapacitated';}
  else if(n.life==='incapacitated'&&!s.combat?.wound&&n.energy>20&&s.health>=25&&n.hunger<85&&n.thirst<85)n.life='active';
}
export function dropCargo(state:BattlefieldState,s:SoldierState):void {
  if(!s.carried||!Object.values(s.carried).some(n=>n>0))return;
  state.living!.crates.push({id:state.nextEntityId++,x:s.x,z:s.z,stock:s.carried,droppedBy:s.id});s.carried=inventory();
}
