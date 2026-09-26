import {distance,polylineLength,type BattlefieldState,type Vec2} from '../core/types';
import {CAMPAIGN_HOURS_PER_SECOND,NEED_RULES} from '../garrison/NeedsSystem';
import {routeJoin} from '../navigation/RouteJoin';

/** Conservative planning estimate, not a path/visibility or survival promise.
 * Only the selected people's current state and carried rations contribute. */
export function marchPreview(state:BattlefieldState,ids:ReadonlySet<number>,route:Vec2[]){
  const people=state.soldiers.filter(s=>ids.has(s.squadId)&&s.needs?.life==='active');
  const length=polylineLength(route);let travelSeconds=0,restSeconds=0,enduranceSeconds=Infinity,atRisk=0;
  for(const s of people){
    // Direct access is an optimistic lower bound: terrain can require more.
    const join=routeJoin(route,s,()=>true),metres=join?length-join.along+distance(s,join.point):0;
    const travel=metres/1.8,n=s.needs!,loss=NEED_RULES.travelLossPerHour*CAMPAIGN_HOURS_PER_SECOND;
    const initial=n.energy<=25?45-n.energy:0;
    const breaks=Math.ceil(Math.max(0,travel*loss-Math.max(0,n.energy+initial-25))/20);
    const recovery=(breaks*20+initial)/(NEED_RULES.floorSleepRecoveryPerHour*CAMPAIGN_HOURS_PER_SECOND);
    const food=Math.max(0,85-n.hunger+(s.carried?.food??0)*40)/(NEED_RULES.hungerPerHour*CAMPAIGN_HOURS_PER_SECOND);
    const water=Math.max(0,85-n.thirst+(s.carried?.water??0)*50)/(NEED_RULES.thirstPerHour*CAMPAIGN_HOURS_PER_SECOND);
    const endurance=Math.min(food,water);
    if(travel+recovery>endurance)atRisk++;
    travelSeconds=Math.max(travelSeconds,travel);restSeconds=Math.max(restSeconds,recovery);enduranceSeconds=Math.min(enduranceSeconds,endurance);
  }
  return {length,people:people.length,travelSeconds,restSeconds,enduranceSeconds:people.length?enduranceSeconds:0,atRisk};
}
export const marchMinutes=(seconds:number)=>seconds<60?`${Math.ceil(seconds/5)*5} s`:`${Math.ceil(seconds/60)} min`;
