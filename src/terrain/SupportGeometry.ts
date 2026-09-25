import type {Facility} from '../garrison/types';
import type {TrenchState,Vec2} from '../core/types';
export function facilityFrame(f:Facility,connector?:TrenchState){
  const points=connector?.points,a=points?.[Math.max(0,points.length-2)],b=points?.at(-1);
  return {x:f.x,z:f.z,angle:a&&b?Math.atan2(b.x-a.x,b.z-a.z):(f.facing??0)+Math.PI};
}
export function facilityPoint(frame:ReturnType<typeof facilityFrame>,x:number,z:number):Vec2{
  const c=Math.cos(frame.angle),s=Math.sin(frame.angle);return {x:frame.x+x*c+z*s,z:frame.z-x*s+z*c};
}
/** Earth-filled low parapets. The rear stays open; people may step over them. */
export function emplacementBoxes(f:Facility):{x:number;y:number;z:number;rx:number;ry:number;rz:number;angle:number}[]{
  if(!['emplacement','mortar'].includes(f.kind)||f.progress<1)return [];
  const angle=f.facing??Math.PI,c=Math.cos(angle),s=Math.sin(angle);
  return [[0,2.3,2.7,.35],[-2.3,0,.35,2.3],[2.3,0,.35,2.3]].map(([x,z,rx,rz])=>({x:f.x+x*c+z*s,y:.5,z:f.z-x*s+z*c,rx,ry:.5,rz,angle}));
}
