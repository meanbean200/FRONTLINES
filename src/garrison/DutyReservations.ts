import {distance,type SoldierState,type Vec2} from '../core/types';

/** First unoccupied temporary destination, preserving the caller's priority order. */
export function firstAvailablePoint(candidates:readonly Vec2[],person:SoldierState,people:readonly SoldierState[],bodyRadius:number,reservationRadius:number):Vec2|undefined {
  if(!candidates.length)return undefined;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const p of candidates){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
  // One conservative broad-phase scan, then the original exact distance checks.
  // Incoming reservations matter even when their owner is far away. Rebuild on
  // every call: earlier assignments and movement in this same tick are visible.
  const margin=Math.max(bodyRadius,reservationRadius)+1e-6;
  minX-=margin;maxX+=margin;minZ-=margin;maxZ+=margin;
  const inside=(p:Vec2)=>p.x>=minX&&p.x<=maxX&&p.z>=minZ&&p.z<=maxZ;
  const nearby=people.filter(o=>o!==person&&o.needs?.life!=='dead'&&(inside(o)||o.duty&&inside(o.duty.destination)));
  return candidates.find(p=>!nearby.some(o=>distance(o,p)<bodyRadius||o.duty&&distance(o.duty.destination,p)<reservationRadius));
}
