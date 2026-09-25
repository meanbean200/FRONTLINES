import type {Vec2} from '../core/types';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';

/** One asset per site, spread across the front rather than along the firing axis. */
export function artilleryLayout(center:Vec2,facing:number,network:TrenchNetwork,component:number|undefined,size:1|4){
  return Array.from({length:size},(_,index)=>{
    const offset=size===1?0:(index-1.5)*12;
    const position={x:center.x+Math.cos(facing)*offset,z:center.z-Math.sin(facing)*offset};
    return {position,origin:network.nearest(position,component)?.point,index};
  });
}
