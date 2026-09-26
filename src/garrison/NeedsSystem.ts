import { clamp, type BattlefieldState, type SoldierState } from '../core/types';
import { consume } from './Inventory';
import { type Needs } from './types';
import {isWalkingAction} from '../core/SoldierActions';
import {recordDeath} from '../simulation/DeathRecord';
export {dropCargo} from '../simulation/DeathRecord';

export const CAMPAIGN_HOURS_PER_SECOND=24/1800;
export const NEED_RULES=Object.freeze({hungerPerHour:4,thirstPerHour:6,awakeLossPerHour:4,travelLossPerHour:6,workLossPerHour:8,sleepRecoveryPerHour:12,floorSleepRecoveryPerHour:10,restRecoveryPerHour:3,fieldRestRecoveryPerSecond:20/45});
export const freshNeeds=(fatigue=0):Needs=>({energy:100-clamp(fatigue,0,100),hunger:10,thirst:10,life:'active',hungryHours:0,thirstyHours:0,sleepHours:0,day:0,watchHours:0,interruptedSleep:0,taskChanges:0});
export function updateNeeds(state:BattlefieldState,s:SoldierState,dt:number):void {
  const w=state.living!,n=s.needs??=freshNeeds(s.fatigue),hours=dt*CAMPAIGN_HOURS_PER_SECOND;
  if(n.life==='dead'){s.action='dead';return;}
  if(s.combat?.wound?.care==='evacuated'){s.action='evacuated';return;}
  n.day=Math.floor(w.campaignHours/24);
  const arrived=s.duty?.arrivedAt!==undefined&&!s.selfCare&&s.combat?.owner!=='reaction'&&s.combat?.owner!=='casualty',kind=arrived&&s.duty?.rationUntil===undefined?s.duty!.kind:undefined;
  const asleep=kind==='sleep'||Boolean(s.selfCare?.kind==='sleep'&&s.action==='sleeping'&&s.combat?.owner==='self-care')||Boolean(s.building?.recovering&&s.action==='sleeping'&&s.combat?.owner==='building'),resting=kind==='rest'||n.life==='incapacitated';
  const fieldRest=Boolean((s.selfCare?.kind==='field-rest'||s.selfCare?.recovering)&&s.action==='resting'&&s.combat?.owner==='self-care');
  const shelter=asleep&&w.facilities.some(f=>f.id===s.duty?.facilityId&&f.kind==='rest'&&f.progress===1&&Math.hypot(s.x-f.x,s.z-f.z)<4);
  const exertion=s.action==='digging'||s.action==='clearing spoil'||kind==='construct'?NEED_RULES.workLossPerHour:isWalkingAction(s.action)||kind==='haul'?NEED_RULES.travelLossPerHour:NEED_RULES.awakeLossPerHour;
  // Food gives a modest recovery benefit, never a health or duty veto. Water
  // remains accounted physical cargo but has no inaccessible survival penalty.
  const nourishment=n.hunger>=80?.9:1;
  n.energy=clamp(n.energy+(fieldRest?dt*NEED_RULES.fieldRestRecoveryPerSecond*nourishment:hours*(asleep?(shelter?NEED_RULES.sleepRecoveryPerHour:NEED_RULES.floorSleepRecoveryPerHour)*nourishment:resting?NEED_RULES.restRecoveryPerHour*nourishment:-exertion)),0,100);
  // Rolling sleep credit: eight hours asleep balances sixteen awake. Field
  // recovery cannot erase sleep debt, nor can an accelerated midnight reset it.
  n.sleepHours=clamp(n.sleepHours+hours*(asleep?1:-.5),0,8);if(kind==='watch')n.watchHours+=hours;
  n.hunger=clamp(n.hunger+hours*NEED_RULES.hungerPerHour,0,100);n.thirst=clamp(n.thirst+hours*NEED_RULES.thirstPerHour,0,100);
  n.hungrySeconds=n.hunger>=95?(n.hungrySeconds??n.hungryHours/CAMPAIGN_HOURS_PER_SECOND)+dt:0;
  n.thirstySeconds=n.thirst>=95?(n.thirstySeconds??n.thirstyHours/CAMPAIGN_HOURS_PER_SECOND)+dt:0;
  n.hungryHours=n.hungrySeconds*CAMPAIGN_HOURS_PER_SECOND;n.thirstyHours=n.thirstySeconds*CAMPAIGN_HOURS_PER_SECOND;
  // Personal rations are usable while stopped, but never appear from a nearby depot.
  if(!s.duty&&!s.selfCare&&(s.action==='holding'||s.building&&['watching','sleeping','waiting at doorway'].includes(s.action))&&s.carried){
    if(n.hunger>45&&s.carried.food>0)n.hunger=Math.max(0,n.hunger-40*consume(state,s.carried,'food',Math.min(1,s.carried.food)));
    if(n.thirst>40&&s.carried.water>0)n.thirst=Math.max(0,n.thirst-50*consume(state,s.carried,'water',Math.min(1,s.carried.water)));
  }
  const critical=n.energy<10;
  if(critical)w.metrics.criticalNeedHours+=hours;
  // lethalNeeds is retained only to read old saves. Sustenance never causes
  // damage; old death records and untreated combat wounds remain untouched.
  if(!s.combat?.wound&&(resting||asleep))s.health=Math.min(100,s.health+hours*6*nourishment);
  const g=w.garrisons.find(g=>g.id===s.garrisonId),dutyStress=g?Math.max(0,g.watchRequired-g.watchPresent)/Math.max(1,g.watchRequired):0;
  s.morale=clamp(s.morale+hours*((critical?-4:asleep?shelter?1.5:.5:.4)-dutyStress-(g?.lossRate??0)),0,100);
  s.fatigue=100-n.energy;
  if(s.health<=0)recordDeath(state,s,s.combat?.wound?.origin??{cause:'other',at:state.elapsed});
  else if(n.energy<=.1||s.health<15){n.life='incapacitated';s.action='incapacitated';}
  else if(n.life==='incapacitated'&&!s.combat?.wound&&n.energy>20&&s.health>=25)n.life='active';
}
