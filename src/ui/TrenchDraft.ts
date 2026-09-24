import {distance,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';

/** Read-only drawn-line check using the same 2m terrain sampling and 4m
 * clearance as construction. Smoothing/crew assignment is still authoritative
 * on release; this preview never creates temporary simulation trenches. */
export function trenchDraft(points:Vec2[],terrain:Pick<TerrainSystem,'clampToWorld'|'obstacleAt'|'groundTypeAt'>){
  const bounded=points.map(p=>terrain.clampToWorld(p));let length=0;
  const blocked:{a:Vec2;b:Vec2}[]=[];
  for(let i=1;i<bounded.length;i++){
    const a=bounded[i-1],b=bounded[i],d=distance(a,b);length+=d;
    const steps=Math.max(1,Math.ceil(d/2));
    for(let j=0;j<=steps;j++){
      const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;
      if(terrain.obstacleAt(x,z,4)||terrain.groundTypeAt(x,z)==='river'){blocked.push({a,b});break;}
    }
  }
  return {length,blocked,tooShort:length<=20};
}
