import {clamp,distance,type BattlefieldState,type SoldierState} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {Reaction} from './types';
import {chooseLocalCover,CoverSpace} from './LocalCover';

const severity:Record<Reaction,number>={steady:0,'under-fire':1,shaken:2,pinned:3,broken:4};
const duration:Record<Reaction,number>={steady:0,'under-fire':4,shaken:8,pinned:6,broken:20};
export const ownsAction=(s:SoldierState,owner:'order'|'duty')=>!s.combat?.owner||s.combat.owner===owner;
export function registerIncoming(s:SoldierState,at:number,heading:number):void {
  const c=s.combat??={shotSequence:0};c.lastIncoming=at;c.threatDirection=heading;
}

/** One priority decision per fixed tick. Orders themselves are never replaced. */
export function prepareActions(state:BattlefieldState,terrain:TerrainSystem,navigation:SquadNavigation,dt:number):void {
  const squads=new Map(state.squads.map(q=>[q.id,q]));
  const space=new CoverSpace(state);
  for(const s of state.soldiers){
    if(!state.operation&&!s.combat)continue;
    const c=s.combat??={shotSequence:0},q=squads.get(s.squadId)!;
    s.posture??='standing';
    if(s.needs&&s.needs.life!=='active'){s.posture='prone';c.owner='casualty';continue;}
    const now=state.elapsed,recent=now-(c.lastIncoming??-1000)<4;
    if(!recent&&s.suppression<15)s.morale=clamp(s.morale+dt*.12,0,100);
    const desired:Reaction=s.morale<18?'broken':s.suppression>=70?'pinned':s.morale<38?'shaken':s.suppression>=22||recent?'under-fire':'steady';
    const current=c.reaction??'steady';
    if(severity[desired]>severity[current]||now>=(c.reactionUntil??0)&&
      (current==='broken'?s.morale>=35&&s.suppression<20:current==='pinned'?s.suppression<40:true)){
      if(desired!==current){c.reaction=desired;c.reactionSince=now;c.reactionUntil=now+duration[desired];delete c.reactionRoute;c.coverReview=0;delete c.coverAnchor;}
    }
    const reaction=c.reaction??'steady';
    c.reactionSince??=Math.max(0,(c.reactionUntil??now)-duration[reaction]);
    c.coverReview??=now+(s.id%40)*.25;
    s.posture=reaction==='pinned'?'prone':reaction==='under-fire'||reaction==='shaken'?'crouched':'standing';
    c.owner=s.duty?'duty':'order';delete c.pauseReason;
    if(c.careTask&&reaction!=='pinned'&&reaction!=='broken'){c.owner='casualty';continue;}
    if(reaction!=='pinned'&&reaction!=='broken'&&state.operation?.supportMissions?.some(m=>m.squadId===q.id&&m.stage==='preparing'&&(!m.crewIds||m.crewIds.includes(s.id)))){c.owner='support';s.action='preparing support weapon';c.pauseReason='Preparing support mission';continue;}
    if(s.building&&terrain.buildingAt(s)===s.building.id){if(reaction==='pinned'){c.owner='reaction';s.action='pinned';c.pauseReason='Pinned · sheltering below the window';}continue;}
    if(reaction==='broken'){
      c.owner='reaction';c.pauseReason='Broken · withdrawing to rally point';
      if(!c.reactionRoute){
        const side=q.faction??'player',g=state.living!.garrisons.filter(g=>(g.faction??'player')===side).sort((a,b)=>distance(a.forward,s)-distance(b.forward,s))[0];
        const rally=g?.forward??(side==='enemy'?state.living!.enemySupply?.rear:state.living!.rear)??{x:s.x+80,z:s.z};
        c.reactionRoute=navigation.plan(s,rally);c.reactionIndex=0;
      }
      followReaction(s,terrain,dt,'falling back');continue;
    }
    if(reaction!=='pinned'&&(q.order.pushThrough||q.order.intent==='fall-back'))continue;
    // Building entry and routine work keep their own authority when not pinned.
    if(reaction==='steady'&&(s.duty||s.building||q.order.type!=='hold'||q.order.building))continue;
    if(s.duty?.kind==='sleep'&&s.duty.arrivedAt!==undefined){s.needs!.interruptedSleep++;delete s.duty.arrivedAt;}
    if(now>=(c.coverReview??0)){
      c.coverReview=now+(reaction==='steady'?10:4)+(s.id%7)*.17;
      // Finish a reserved trip before selecting another; no cover hopping.
      if(!c.reactionRoute?.[c.reactionIndex??0]){
        const choice=chooseLocalCover(s,q,terrain,navigation,space,reaction==='pinned');c.coverTests=choice.tested;
        c.reactionRoute=choice.point?[choice.point]:[];c.reactionIndex=0;
        if(q.order.type==='hold'){c.coverAnchor??={x:s.x,z:s.z};if(choice.point&&distance(c.coverAnchor,choice.point)>12)c.reactionRoute=[];}
        else delete c.coverAnchor;
      }
    }
    if(c.reactionRoute?.[c.reactionIndex??0]){c.owner='reaction';c.pauseReason='Taking nearby cover · route retained';followReaction(s,terrain,dt,reaction==='pinned'?'crawling to cover':'seeking cover',space,q);continue;}
    if(reaction==='pinned'){c.owner='reaction';s.action='pinned';c.pauseReason='Pinned · prone, using available protection';continue;}
    // Brief orientation/hesitation, not an indefinite veto on the player's route.
    if(reaction!=='steady'&&now-(c.reactionSince??now)<(reaction==='shaken'?3:1.5)){c.owner='reaction';s.action='crouching';c.pauseReason='Under fire · lowering exposure';}
    else if(reaction==='steady'&&terrain.coverAt(s.x,s.z)!=='open'&&q.order.type==='hold')s.posture='crouched';
  }
}
function followReaction(s:SoldierState,terrain:TerrainSystem,dt:number,action:string,space?:CoverSpace,q?:import('../core/types').SquadState):void {
  const c=s.combat!,route=c.reactionRoute??[],i=c.reactionIndex??0,target=route[i];
  if(!target){s.action=c.reaction==='broken'?'rallying':'crouching';return;}
  const d=distance(s,target);if(d<.25){c.reactionIndex=i+1;s.action='crouching';return;}
  const amount=Math.min(d,dt*(c.reaction==='broken'?2:c.reaction==='pinned'?.45:1.2)),x=s.x+(target.x-s.x)/d*amount,z=s.z+(target.z-s.z)/d*amount;
  if(terrain.obstacleAt(x,z,.5)||space&&q&&space.occupied(s,q,{x,z})){s.action='sheltering';c.pauseReason='Cover route blocked';c.reactionRoute=[];return;}
  s.heading=Math.atan2(target.x-s.x,target.z-s.z);s.x=x;s.z=z;s.action=action;s.cover=terrain.coverAt(x,z);
}
