export interface ProjectedPoint {x:number;y:number;visible:boolean;inFront?:boolean}
/** Clip before giving coordinates to SVG. Never join across the camera near plane. */
export function clippedPaths(points:ProjectedPoint[],width:number,height:number):ProjectedPoint[][] {
  const result:ProjectedPoint[][]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(![a,b].every(p=>(p.inFront??p.visible)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e7&&Math.abs(p.y)<1e7))continue;
    const dx=b.x-a.x,dy=b.y-a.y;let low=0,high=1,valid=true;
    for(const [p,q] of [[-dx,a.x],[dx,width-a.x],[-dy,a.y],[dy,height-a.y]]){if(p===0){if(q<0)valid=false;}else{const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);}}
    if(!valid||low>high)continue;
    const start={x:a.x+dx*low,y:a.y+dy*low,visible:true},end={x:a.x+dx*high,y:a.y+dy*high,visible:true},previous=result.at(-1)?.at(-1);
    if(previous&&Math.hypot(previous.x-start.x,previous.y-start.y)<.01)result.at(-1)!.push(end);else result.push([start,end]);
  }return result;
}
