import {distance,distanceToSegment,type Vec2} from '../core/types';
/** Closest reachable local intercept; never force a trip to the formation centroid. */
export function routeJoin(route:Vec2[],person:Vec2,clear:(a:Vec2,b:Vec2)=>boolean):{index:number;point:Vec2;along:number}|undefined {
  let best:{index:number;point:Vec2;along:number;distance:number}|undefined,along=0;
  if(route.length===1&&clear(person,route[0]))return {index:0,point:{...route[0]},along:0};
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],length=distance(a,b),hit=distanceToSegment(person,a,b),point={x:a.x+(b.x-a.x)*hit.t,z:a.z+(b.z-a.z)*hit.t};
    const progress=along+length*hit.t;along+=length;
    if(best&&(hit.distance>best.distance+.001||Math.abs(hit.distance-best.distance)<.001&&progress<=best.along))continue;
    if(clear(person,point))best={index:i,point,along:progress,distance:hit.distance};
  }
  return best;
}
