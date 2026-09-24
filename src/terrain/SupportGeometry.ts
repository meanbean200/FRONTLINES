import type {Facility} from '../garrison/types';
/** Earth-filled low parapets. The rear stays open; people may step over them. */
export function emplacementBoxes(f:Facility):{x:number;y:number;z:number;rx:number;ry:number;rz:number}[]{
  if(f.kind!=='emplacement'||f.progress<1)return [];
  const angle=Math.round((f.facing??Math.PI)/(Math.PI/2))*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
  return [[0,2.3,2.7,.35],[-2.3,0,.35,2.3],[2.3,0,.35,2.3]].map(([x,z,rx,rz])=>({x:f.x+x*c+z*s,y:.5,z:f.z-x*s+z*c,rx:Math.abs(c)*rx+Math.abs(s)*rz,ry:.5,rz:Math.abs(s)*rx+Math.abs(c)*rz}));
}
