import {clamp,distance,distanceToSegment,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {Reaction} from './types';

const severity:Record<Reaction,number>={steady:0,'under-fire':1,shaken:2,pinned:3,broken:4};
const duration:Record<Reaction,number>={steady:0,'under-fire':4,shaken:8,pinned:6,broken:20};
export const ownsAction=(s:SoldierState,owner:'order'|'duty')=>!s.combat?.owner||s.combat.owner===owner;
export function registerIncoming(s:SoldierState,at:number,heading:number):void {
  const c=s.combat??={shotSequence:0};c.lastIncoming=at;c.threatDirection=heading;
}

/** One priority decision per fixed tick. Orders themselves are never replaced. */
export function prepareActions(state:BattlefieldState,terrain:TerrainSystem,navigation:SquadNavigation,dt:number):void {
  const squads=new Map(state.squads.map(q=>[q.id,q]));
  for(const s of state.soldiers){
    if(!state.operation&&!s.combat)continue;
    const c=s.combat??={shotSequence:0},q=squads.get(s.squadId)!;
    if(s.needs?.life!=='active'){c.owner='casualty';continue;}
    const now=state.elapsed,recent=now-(c.lastIncoming??-1000)<4;
    if(!recent&&s.suppression<15)s.morale=clamp(s.morale+dt*.12,0,100);
    const desired:Reaction=s.morale<18?'broken':s.suppression>=70?'pinned':s.morale<38?'shaken':s.suppression>=22||recent?'under-fire':'steady';
    const current=c.reaction??'steady';
    if(severity[desired]>severity[current]||now>=(c.reactionUntil??0)&&
      (current==='broken'?s.morale>=35&&s.suppression<20:current==='pinned'?s.suppression<40:true)){
      if(desired!==current){c.reaction=desired;c.reactionUntil=now+duration[desired];delete c.reactionRoute;c.coverReview=0;}
    }
    const reaction=c.reaction??'steady';
    c.owner=s.duty?'duty':'order';delete c.pauseReason;
    if(c.careTask&&reaction!=='pinned'&&reaction!=='broken'){c.owner='casualty';continue;}
    if(reaction!=='pinned'&&reaction!=='broken'&&state.operation?.supportMissions?.some(m=>m.squadId===q.id&&m.stage==='preparing')){c.owner='support';s.action='preparing support weapon';c.pauseReason='Preparing support mission';continue;}
    if(reaction==='steady')continue;
    if(reaction==='pinned'){c.owner='reaction';s.action='pinned';c.pauseReason='Pinned by incoming fire';continue;}
    if(s.building&&terrain.buildingAt(s)===s.building.id){if(reaction!=='broken'){c.owner='reaction';s.action='crouching';c.pauseReason='Take cover below the window';}continue;}
    if(reaction==='broken'){
      c.owner='reaction';c.pauseReason='Broken · withdrawing to rally point';
      if(!c.reactionRoute){
        const side=q.faction??'player',g=state.living!.garrisons.filter(g=>(g.faction??'player')===side).sort((a,b)=>distance(a.forward,s)-distance(b.forward,s))[0];
        const rally=g?.forward??(side==='enemy'?state.living!.enemySupply?.rear:state.living!.rear)??{x:s.x+80,z:s.z};
        c.reactionRoute=navigation.plan(s,rally);c.reactionIndex=0;
      }
      followReaction(s,terrain,dt,'falling back');continue;
    }
    if(q.order.pushThrough||q.order.intent==='fall-back')continue;
    if(s.duty?.kind==='sleep'&&s.duty.arrivedAt!==undefined){s.needs!.interruptedSleep++;delete s.duty.arrivedAt;}
    c.owner='reaction';c.pauseReason=reaction==='shaken'?'Shaken · waiting to recover':'Taking nearby cover · route retained';
    if(now>=(c.coverReview??0)){
      c.coverReview=now+5;
      const angle=c.threatDirection??s.heading,threat={x:s.x+Math.sin(angle)*80,z:s.z+Math.cos(angle)*80};
      const path=q.order.drawnPath,withinRoute=(p:Vec2)=>!path||path.slice(1).some((b,i)=>distanceToSegment(p,path[i],b).distance<=12);
      const score=(p:Vec2)=>(terrain.objects.trace(threat,p,terrain.heightAt(threat.x,threat.z)+1.4,terrain.heightAt(p.x,p.z)+.65,false).clear?0:20)-distance(s,p);
      const best:{point:Vec2;score:number}[]=[{point:{x:s.x,z:s.z},score:score(s)}];
      for(const radius of [3,6,10])for(let n=0;n<8;n++){
        const p={x:s.x+Math.sin(n*Math.PI/4)*radius,z:s.z+Math.cos(n*Math.PI/4)*radius};
        if(withinRoute(p)&&!terrain.obstacleAt(p.x,p.z,.6)&&navigation.segmentClear(s,p,.6))best.push({point:p,score:score(p)});
      }
      best.sort((a,b)=>b.score-a.score);c.reactionRoute=[best[0].point];c.reactionIndex=0;
    }
    followReaction(s,terrain,dt,'seeking cover');
  }
}
function followReaction(s:SoldierState,terrain:TerrainSystem,dt:number,action:string):void {
  const c=s.combat!,route=c.reactionRoute??[],i=c.reactionIndex??0,target=route[i];
  if(!target){s.action=c.reaction==='broken'?'rallying':'crouching';return;}
  const d=distance(s,target);if(d<.25){c.reactionIndex=i+1;s.action='crouching';return;}
  const amount=Math.min(d,dt*(c.reaction==='broken'?2:1.2)),x=s.x+(target.x-s.x)/d*amount,z=s.z+(target.z-s.z)/d*amount;
  if(terrain.obstacleAt(x,z,.6)){s.action='sheltering';c.pauseReason='Cover route blocked';return;}
  s.heading=Math.atan2(target.x-s.x,target.z-s.z);s.x=x;s.z=z;s.action=action;s.cover=terrain.coverAt(x,z);
}
