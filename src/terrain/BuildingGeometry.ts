import type {BuildingSite} from './WorldFeatures';
import type {Vec2} from '../core/types';
export type BuildingCondition='intact'|'damaged'|'ruined';
export interface BuildingChange {id:number;condition:BuildingCondition;damage:number}
export interface StructureBox {x:number;y:number;z:number;rx:number;ry:number;rz:number;material:'masonry'|'timber';layer:number;role:'wall'|'floor'|'roof'|'stair'}
export const MATERIALS={masonry:{stopsSmallArms:true,resistance:20,concealment:1},timber:{stopsSmallArms:false,resistance:2,concealment:1},foliage:{stopsSmallArms:false,resistance:0,concealment:.22}} as const;
export const buildingFloors=(b:BuildingSite)=>b.height>6?2:1;
export const floorHeight=(b:BuildingSite)=>b.height/buildingFloors(b);
export const buildingContains=(b:BuildingSite,p:Vec2,margin=0)=>Math.abs(p.x-b.x)<b.width/2-margin&&Math.abs(p.z-b.z)<b.depth/2-margin;
export const doorPoint=(b:BuildingSite,outside=0):Vec2=>({x:b.x,z:b.z-b.depth/2-outside});
export const stairPoint=(b:BuildingSite):Vec2=>({x:b.x+b.width/2-2,z:b.z});
/** Shared finite volumes: rendering, sight, fire and local pedestrian collision. */
export function structureBoxes(b:BuildingSite,condition:BuildingCondition='intact'):StructureBox[]{
  const out:StructureBox[]=[],floors=buildingFloors(b),fh=floorHeight(b);
  const add=(x:number,y:number,z:number,w:number,h:number,d:number,layer:number,role:StructureBox['role'],material:StructureBox['material']='masonry')=>{if(w>.001&&h>.001&&d>.001)out.push({x:b.x+x,y,z:b.z+z,rx:w/2,ry:h/2,rz:d/2,layer,role,material});};
  for(let level=0;level<floors;level++){
    const base=level*fh;
    // Upper floor has a real stair opening, rather than a renderer-only stair.
    if(level===0)add(0,.07,0,b.width,.14,b.depth,level,'floor','timber');
    else {add(-1,base,0,b.width-2,.16,b.depth,level,'floor','timber');add(b.width/2-1,base,-b.depth/4-1,2,.16,b.depth/2-2,level,'floor','timber');add(b.width/2-1,base,b.depth/4+1,2,.16,b.depth/2-2,level,'floor','timber');}
    for(const face of [-1,1]){
      const wallHeight=condition==='ruined'?1.05:fh;
      const openings=[{a:-b.width*.28-.7,b:-b.width*.28+.7,low:1,high:2.4},{a:-1.05,b:1.05,low:level===0?0:1,high:level===0?2.3:2.4},{a:b.width*.28-.7,b:b.width*.28+.7,low:1,high:2.4}];
      let cursor=-b.width/2;
      for(const gap of openings){add((cursor+gap.a)/2,base+wallHeight/2,face*b.depth/2,gap.a-cursor,wallHeight,.42,level,'wall');add((gap.a+gap.b)/2,base+Math.min(gap.low,wallHeight)/2,face*b.depth/2,gap.b-gap.a,Math.min(gap.low,wallHeight),.42,level,'wall');if(wallHeight>gap.high)add((gap.a+gap.b)/2,base+(gap.high+wallHeight)/2,face*b.depth/2,gap.b-gap.a,wallHeight-gap.high,.42,level,'wall');cursor=gap.b;}
      add((cursor+b.width/2)/2,base+wallHeight/2,face*b.depth/2,b.width/2-cursor,wallHeight,.42,level,'wall');
      // Side window; damaged presets open the eastern wall into a broad breach.
      const breach=condition!=='intact'&&face===1,half=breach?1.8:.8,low=breach?0:1,high=breach?fh:2.4;
      for(const zside of [-1,1])add(face*b.width/2,base+wallHeight/2,zside*(b.depth/4+half/2),.42,wallHeight,b.depth/2-half,level,'wall');
      add(face*b.width/2,base+Math.min(low,wallHeight)/2,0,.42,Math.min(low,wallHeight),half*2,level,'wall');if(wallHeight>high)add(face*b.width/2,base+(high+wallHeight)/2,0,.42,wallHeight-high,half*2,level,'wall');
    }
  }
  if(floors===2)for(let step=0;step<12;step++){const h=(step+1)/12*fh;add(b.width/2-2,h/2,-2+(step+.5)/12*4,1.25,h,4/12,0,'stair','timber');}
  if(condition!=='ruined')add(0,b.height+.14,0,b.width+.8,.28,b.depth+.8,2,'roof','timber');
  return out;
}
export function firingPoints(b:BuildingSite):Vec2[]{
  return [-1,1].flatMap(side=>[-1,0,1].map(col=>({x:b.x+col*b.width*.28,z:b.z+side*(b.depth/2-.8)}))).concat([-1,1].map(side=>({x:b.x+side*(b.width/2-.8),z:b.z})));
}
