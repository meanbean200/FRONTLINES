import type {SquadState,Vec2} from '../core/types';

/** Destination spacing is local to the click, never scaled by route length.
 * Centre the actual occupied cells, including incomplete rows and small crews. */
export function moveFootprint(squads:readonly SquadState[],center:Vec2):Vec2[]{
  if(!squads.length)return [];
  const columns=Math.ceil(Math.sqrt(squads.length));
  const cells=squads.map((q,i)=>({x:i%columns,z:Math.floor(i/columns),weight:Math.max(1,q.soldierIds.length)}));
  const total=cells.reduce((n,c)=>n+c.weight,0);
  const cx=cells.reduce((n,c)=>n+c.x*c.weight,0)/total,cz=cells.reduce((n,c)=>n+c.z*c.weight,0)/total;
  const radius=Math.max(...cells.map(c=>Math.hypot(c.x-cx,c.z-cz)),1);
  const spacing=Math.min(10,18/radius);
  return cells.map(c=>({x:center.x+(c.x-cx)*spacing,z:center.z+(c.z-cz)*spacing}));
}
