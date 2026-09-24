import type {Vec2} from './types';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
function segmentDistance(p:Vec2,a:Vec2,b:Vec2):{distance:number;t:number}{const x=b.x-a.x,z=b.z-a.z,d=x*x+z*z,t=d?clamp(((p.x-a.x)*x+(p.z-a.z)*z)/d,0,1):0;return {distance:Math.hypot(p.x-a.x-x*t,p.z-a.z-z*t),t};}

/** Routes are immutable after creation. Cache arc lengths rather than rescanning per soldier. */
const cache=new WeakMap<Vec2[],{length:number;ends:number[]}>();
export function routeMetrics(points:Vec2[]):{length:number;ends:number[]} {
  let metrics=cache.get(points);
  if(!metrics){const ends=[0];for(let i=1;i<points.length;i++)ends.push(ends[i-1]+distance(points[i-1],points[i]));metrics={length:ends.at(-1)??0,ends};cache.set(points,metrics);}
  return metrics;
}
export function atDistance(points:Vec2[],along:number):Vec2 {
  if(!points.length)return {x:0,z:0};
  const {length,ends}=routeMetrics(points);along=clamp(along,0,length);
  let low=1,high=points.length-1;
  while(low<high){const mid=(low+high)>>1;if(ends[mid]<along)low=mid+1;else high=mid;}
  if(!points[low])return {...points[0]};
  const a=points[low-1],b=points[low],t=(along-ends[low-1])/Math.max(.0001,ends[low]-ends[low-1]);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
}
export function closestAlong(points:Vec2[],point:Vec2):number {
  const {ends}=routeMetrics(points);let best=Infinity,along=0;
  for(let i=1;i<points.length;i++){const hit=segmentDistance(point,points[i-1],points[i]);if(hit.distance<best){best=hit.distance;along=ends[i-1]+(ends[i]-ends[i-1])*hit.t;}}
  return along;
}
/** Removes pointer jitter, not meaningful turns. */
export function simplifyRoute(points:Vec2[],tolerance=.75):Vec2[] {
  const clean=points.filter((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&(i===0||distance(p,points[i-1])>.05));
  if(clean.length<3)return clean.map(p=>({...p}));
  const keep=new Set([0,clean.length-1]),stack=[[0,clean.length-1]];
  while(stack.length){const [a,b]=stack.pop()!;let best=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=segmentDistance(clean[i],clean[a],clean[b]).distance;if(d>best){best=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
  return [...keep].sort((a,b)=>a-b).map(i=>({...clean[i]}));
}
