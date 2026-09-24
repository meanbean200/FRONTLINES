import type {TrenchState,Vec2} from './types';
import {atDistance,routeMetrics} from './Polyline';

/** Inward quantization never turns unfinished ground into usable trench. */
export function excavatedSpan(t:TrenchState,quantum=0):{start:number;end:number} {
  const length=routeMetrics(t.points).length;
  if(t.progress===1)return {start:0,end:length};
  const start=t.excavation?.start??0,end=t.excavation?.end??length*t.progress;
  return quantum?{start:Math.ceil(start/quantum)*quantum,end:Math.floor(end/quantum)*quantum}:{start,end};
}
export function excavationKey(t:TrenchState,quantum:number):string {
  const span=excavatedSpan(t,quantum);return `${span.start}:${span.end}:${t.progress===1}:${t.excavation?.origin??0}`;
}
export function slicePolyline(points:Vec2[],start:number,end:number):Vec2[] {
  if(end-start<=.001)return [];
  const {ends}=routeMetrics(points),result=[atDistance(points,start)];
  for(let i=1;i<points.length-1;i++)if(ends[i]>start+.001&&ends[i]<end-.001)result.push(points[i]);
  result.push(atDistance(points,end));return result;
}
const clipped=new WeakMap<TrenchState,Map<number,{key:string;source:Vec2[];points:Vec2[]}>>();
export function excavatedPoints(t:TrenchState,quantum=0):Vec2[] {
  if(t.progress===1)return t.points;
  const key=excavationKey(t,quantum),entries=clipped.get(t)??new Map();clipped.set(t,entries);
  const old=entries.get(quantum);if(old?.key===key&&old.source===t.points)return old.points;
  const {start,end}=excavatedSpan(t,quantum),points=slicePolyline(t.points,start,end);
  entries.set(quantum,{key,source:t.points,points});return points;
}
export function trenchEntrance(t:TrenchState):Vec2 {
  return atDistance(t.points,t.excavation?.origin??0);
}

/** A distant working front must not rebuild every already-finished terrain chunk. */
export function excavationBoundsKey(t:TrenchState,x:number,z:number,size=500):string {
  const points=excavatedPoints(t,.5),parts:string[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];let low=0,high=1;
    for(const [start,delta,min,max] of [[a.x,b.x-a.x,x-10,x+size+10],[a.z,b.z-a.z,z-10,z+size+10]]){
      if(Math.abs(delta)<1e-9){if(start<min||start>max){high=-1;break;}}
      else {const from=(min-start)/delta,to=(max-start)/delta;low=Math.max(low,Math.min(from,to));high=Math.min(high,Math.max(from,to));}
    }
    if(low>high)continue;
    parts.push([a.x+(b.x-a.x)*low,a.z+(b.z-a.z)*low,a.x+(b.x-a.x)*high,a.z+(b.z-a.z)*high].map(n=>n.toFixed(3)).join(','));
  }
  return parts.length?`${t.id}:${t.width}:${t.depth}:${t.excavation?.origin??0}:${parts.join(';')}`:'';
}
