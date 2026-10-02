import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import {hash2D} from '../core/random';
import {smokeTransmission} from '../combat/SupportWeapons';

export interface SmokeAwareness {turn:Vec2;until:number;reviewAt:number}
/** Local confidence only: orders, topology, destinations and path ownership do
 * not change. Both sides sample the exact same physical smoke transmission. */
export function smokeMovement(state:BattlefieldState,s:SoldierState,target:Vec2):number {
  if(!state.operation?.smokeFields?.some(c=>c.until>state.elapsed&&distance(s,c)<c.radius+6)){delete s.smokeAwareness;return 1;}
  const d=Math.max(.01,distance(s,target)),look={x:s.x+(target.x-s.x)*6/d,z:s.z+(target.z-s.z)*6/d};
  const obscurity=1-smokeTransmission(state,s,look);
  if(obscurity<.35){delete s.smokeAwareness;return 1;}
  const heading=Math.atan2(target.x-s.x,target.z-s.z),turn=Math.abs(Math.atan2(Math.sin(heading-s.heading),Math.cos(heading-s.heading)));
  let memory=s.smokeAwareness;
  if(turn>.55&&obscurity>.65&&(!memory||state.elapsed>=memory.reviewAt&&distance(memory.turn,target)>2)){
    memory=s.smokeAwareness={turn:{...target},until:state.elapsed+.45+hash2D(s.id,Math.floor(state.elapsed),state.seed)*.45,reviewAt:state.elapsed+3};
  }
  if(memory&&state.elapsed<memory.until){s.action='reorienting in smoke';return 0;}
  // Small stable individual differences stretch following spacing without
  // introducing random wrong turns, hard body blockage or repeated replanning.
  return 1-obscurity*(.23+hash2D(s.id,0,state.seed)*.09);
}
