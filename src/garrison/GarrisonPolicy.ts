import { clamp, type BattlefieldState, type SoldierState } from '../core/types';
import { effectiveReadiness, type Garrison } from './types';
import { localInventory } from './Inventory';

export const OBSERVATION_VERSION=2;
export const RULES_VERSION='combat-43-target-continuity-nonlethal-field-rest-world2';
export const DUTY_PRIORITIES=['watch','patrol','recovery','meals','hauling','construction'] as const;
export const OBSERVATION_SIZE=32;
export interface GarrisonPolicy { decide(observation:readonly number[]):number[] }
export function observation(state:BattlefieldState,g:Garrison,people:SoldierState[]):number[]{
  const w=state.living!,count=Math.max(1,people.length),hour=w.campaignHours%24,readiness=effectiveReadiness(g,state.elapsed);
  const mean=(fn:(s:SoldierState)=>number)=>people.reduce((sum,s)=>sum+fn(s),0)/count;
  const local=localInventory(state,g),facilities=w.facilities.filter(f=>f.garrisonId===g.id),deliveries=w.trucks.filter(t=>t.garrisonId===g.id&&['loading','outbound','unloading','blocked'].includes(t.state));
  return [Math.sin(hour/24*Math.PI*2),Math.cos(hour/24*Math.PI*2),people.length/300,
    readiness==='routine'?0:readiness==='alert'?.5:1,g.watchRequired/count,g.watchPresent/count,
    mean(s=>s.needs!.energy/100),mean(s=>s.needs!.hunger/100),mean(s=>s.needs!.thirst/100),mean(s=>s.morale/100),
    mean(s=>Number(s.needs!.energy<30)),mean(s=>Number(s.needs!.hunger>60)),mean(s=>Number(s.needs!.thirst>60)),
    mean(s=>Math.min(1,s.needs!.sleepHours/8)),mean(s=>Number(s.duty?.kind==='watch')),mean(s=>Number(s.duty?.kind==='haul')),
    Math.min(1,local.food/count),Math.min(1,local.water/count),Math.min(1,g.forwardStock.food/count),Math.min(1,g.forwardStock.water/count),
    w.facilities.filter(f=>f.garrisonId===g.id&&f.progress===1).length/3,
    Math.min(1,g.capacity/count),mean(s=>Number((s.duty?.blockedFor??0)>1)),mean(s=>Math.min(1,s.needs!.watchHours/8)),
    Math.min(1,facilities.filter(f=>f.kind==='rest'&&f.progress===1).reduce((n,f)=>n+f.capacity,0)/count),
    Math.min(1,facilities.filter(f=>f.kind==='meal'&&f.progress===1).reduce((n,f)=>n+f.capacity,0)/count),
    Math.min(1,local.materials/30),Math.min(1,deliveries.reduce((n,t)=>n+t.cargo.food,0)/count),
    Math.min(1,deliveries.reduce((n,t)=>n+t.cargo.water,0)/count),deliveries.filter(t=>t.state==='blocked').length/4,
    clamp((w.nextDelivery-state.elapsed)/450,0,1),facilities.filter(f=>f.progress<1).length/3];
}
export class RulePolicy implements GarrisonPolicy {
  decide(o:readonly number[]):number[]{
    return [clamp(.6+o[4]-o[5],0,1),.18,clamp((1-o[6])*.9+o[10]*.4+(o[1]>.25?.3:0),0,1),
      clamp(Math.max(o[7],o[8])+.15,0,1),clamp(1.5-Math.min(o[16],o[17]),0,1),o[31]>0?.5:.5*(1-clamp(o[20],0,1))];
  }
}
export function applyPolicy(g:Garrison,base:number[],action:readonly number[]):number[]{
  if(action.length!==6||action.some(x=>!Number.isFinite(x)))throw new Error('Invalid policy output');
  return action.map((x,i)=>g.policy==='hybrid'?clamp(base[i]+clamp(x,-1,1)*.25,0,1):(clamp(x,-1,1)+1)/2);
}
