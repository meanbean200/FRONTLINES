import {WORLD_HALF,WORLD_SIZE,CHUNK_SIZE,CHUNKS_PER_AXIS,clamp,distance,type Vec2} from '../core/types';

/** Shared metre-scale geography. No renderer-only roads or crossings. */
export interface Road {id:string;axis:'x'|'z';width:number;center:(t:number)=>number}
export const supplyRoadZ=(x:number)=>-1330+Math.sin(x/530)*30;
export const riverCenter=(x:number)=>-720+Math.sin((x+600)/760)*310+Math.sin(x/240)*55;
export const riverWidth=(x:number)=>12+(Math.sin(x/440)+1)*5;
export const ROADS:readonly Road[]=[
 {id:'north-supply',axis:'x',width:7,center:supplyRoadZ},
 {id:'south-lateral',axis:'x',width:6,center:x=>920+Math.sin((x-300)/1150)*260},
 {id:'central-lateral',axis:'x',width:5,center:x=>Math.sin(x/780)*30},
 {id:'west-crossing',axis:'z',width:7,center:z=>-1340+Math.sin(z/870)*190},
 {id:'central-crossing',axis:'z',width:5,center:z=>180+Math.sin(z/700)*90},
 {id:'east-crossing',axis:'z',width:6,center:z=>1330+Math.sin(z/650)*100},
];
export const RIVER_CROSSINGS:readonly Vec2[]=ROADS.filter(r=>r.axis==='z').map(road=>{
 let z=-720;for(let i=0;i<20;i++)z=riverCenter(road.center(z));return {x:road.center(z),z};
});
/** Narrow banks/causeways need local mesh detail, including across chunk seams. */
export const intersectsCrossing=(minX:number,maxX:number,minZ:number,maxZ:number)=>RIVER_CROSSINGS.some(p=>p.x+40>=minX&&p.x-40<=maxX&&p.z+40>=minZ&&p.z-40<=maxZ);
export function pointOnRoad(road:Road,t:number):Vec2{return road.axis==='x'?{x:t,z:road.center(t)}:{x:road.center(t),z:t};}
export function roadDistance(x:number,z:number):number{let best=Infinity;for(const r of ROADS)best=Math.min(best,Math.abs(r.axis==='x'?z-r.center(x):x-r.center(z)));return best;}
export function nearestRoad(p:Vec2):{point:Vec2;road:number;t:number}{
 let best={point:{x:0,z:0},road:0,t:0},d=Infinity;
 ROADS.forEach((r,road)=>{const t=clamp(r.axis==='x'?p.x:p.z,-WORLD_HALF+20,WORLD_HALF-20),point=pointOnRoad(r,t),gap=distance(p,point);if(gap<d){d=gap;best={point,road,t};}});return best;
}
export const rearDepot=(enemy=false,road:Road=ROADS[0]):Vec2=>pointOnRoad(road,(enemy?1:-1)*(WORLD_HALF-320));
export const convoyEntry=(enemy=false,depot=rearDepot(enemy)):Vec2=>pointOnRoad(ROADS[nearestRoad(depot).road],(enemy?1:-1)*(WORLD_HALF-20));
export const chunkOrigin=(index:number)=>index*CHUNK_SIZE-WORLD_HALF;
export const WORLD_CHUNKS=Array.from({length:CHUNKS_PER_AXIS**2},(_,i)=>({cx:i%CHUNKS_PER_AXIS,cz:Math.floor(i/CHUNKS_PER_AXIS),x:chunkOrigin(i%CHUNKS_PER_AXIS),z:chunkOrigin(Math.floor(i/CHUNKS_PER_AXIS))}));
export const insideWorld=(p:Vec2,margin=0)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=WORLD_HALF-margin&&Math.abs(p.z)<=WORLD_HALF-margin;
export function mapCenter(p:Vec2,span:number,verticalScale=1):Vec2{return {x:clamp(p.x,-WORLD_HALF+span/2,WORLD_HALF-span/2),z:clamp(p.z,-WORLD_HALF+span*verticalScale/2,WORLD_HALF-span*verticalScale/2)};}
export function mapProject(p:Vec2,center:Vec2,span=WORLD_SIZE,verticalScale=1){return {x:(p.x-center.x)/span+.5,y:(p.z-center.z)/(span*verticalScale)+.5};}
export function mapUnproject(x:number,y:number,center:Vec2,span=WORLD_SIZE,verticalScale=1):Vec2{return {x:center.x+(x-.5)*span,z:center.z+(y-.5)*span*verticalScale};}

// Intersections are solved once. Opposite-axis roads converge with small slopes.
const junctions:{point:Vec2;roads:number[]}[]=[];
ROADS.forEach((a,i)=>ROADS.forEach((b,j)=>{if(j<=i||a.axis===b.axis)return;const h=a.axis==='x'?a:b,v=a.axis==='z'?a:b;let x=v.center(0),z=h.center(x);for(let n=0;n<20;n++){x=v.center(z);z=h.center(x);}junctions.push({point:{x,z},roads:[i,j]});}));
/** A tiny road graph, sampled only when a shipment departs; never teleport cargo. */
export function roadRoute(from:Vec2,to:Vec2):Vec2[]{
 const a=nearestRoad(from),b=nearestRoad(to),nodes=[...junctions,{point:a.point,roads:[a.road]},{point:b.point,roads:[b.road]}],start=nodes.length-2,goal=nodes.length-1;
 const edges=nodes.map(()=>[] as {to:number;road:number;cost:number}[]);
 ROADS.forEach((road,r)=>{const row=nodes.map((n,i)=>({n,i})).filter(v=>v.n.roads.includes(r)).sort((a,b)=>a.n.point[road.axis]-b.n.point[road.axis]);for(let i=1;i<row.length;i++){const a=row[i-1],b=row[i],cost=distance(a.n.point,b.n.point);edges[a.i].push({to:b.i,road:r,cost});edges[b.i].push({to:a.i,road:r,cost});}});
 const costs=nodes.map(()=>Infinity),parents=new Map<number,{from:number;road:number}>(),done=new Set<number>();costs[start]=0;
 while(done.size<nodes.length){let current=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(current<0||costs[i]<costs[current]))current=i;if(current<0||!Number.isFinite(costs[current]))return [];if(current===goal)break;done.add(current);for(const e of edges[current])if(costs[current]+e.cost<costs[e.to]){costs[e.to]=costs[current]+e.cost;parents.set(e.to,{from:current,road:e.road});}}
 const legs:{from:number;to:number;road:number}[]=[];let cursor=goal;while(cursor!==start){const p=parents.get(cursor);if(!p)return [];legs.unshift({from:p.from,to:cursor,road:p.road});cursor=p.from;}
 const result:Vec2[]=[];if(distance(from,a.point)>.01)result.push(a.point);
 for(const leg of legs){const road=ROADS[leg.road],begin=nodes[leg.from].point[road.axis],end=nodes[leg.to].point[road.axis],steps=Math.max(1,Math.ceil(Math.abs(end-begin)/20));for(let i=1;i<=steps;i++)result.push(pointOnRoad(road,begin+(end-begin)*i/steps));}
 if(!result.length)result.push(b.point);return result;
}
