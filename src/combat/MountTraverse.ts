import type {Facility} from '../garrison/types';
export const MOUNT_TURN_RATE=Math.PI/3;
export const angleDelta=(to:number,from:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
/** A missed targeting visit cannot bank up instantaneous rotation. */
export function traverseMount(f:Facility,heading:number,now:number):boolean {
  const t=f.traverse??={yaw:f.facing??heading,at:now};
  const step=Math.max(0,Math.min(.1,now-t.at))*MOUNT_TURN_RATE;
  t.yaw+=Math.max(-step,Math.min(step,angleDelta(heading,t.yaw)));t.at=now;
  return Math.abs(angleDelta(heading,t.yaw))<.015;
}
