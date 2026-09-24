import { type Vec2, WORLD_HALF, distance } from '../core/types';
import type { TerrainSystem } from '../terrain/TerrainSystem';
import {doorPoint} from '../terrain/BuildingGeometry';
import {insideWorld} from '../terrain/WorldLayout';

interface Node {x:number;z:number;g:number;f:number;parent?:Node}
class MinHeap {
  private values:Node[]=[];
  get size():number{return this.values.length;}
  push(node:Node):void {let i=this.values.length;this.values.push(node);while(i>0){const p=(i-1)>>1;if(this.values[p].f<=node.f)break;this.values[i]=this.values[p];i=p;}this.values[i]=node;}
  pop():Node|undefined {const first=this.values[0],last=this.values.pop();if(!first||!last||!this.values.length)return first;let i=0;while(i*2+1<this.values.length){let c=i*2+1;if(c+1<this.values.length&&this.values[c+1].f<this.values[c].f)c++;if(this.values[c].f>=last.f)break;this.values[i]=this.values[c];i=c;}this.values[i]=last;return first;}
}

/** One route per squad order. Local searches resolve building footprints at 8 m. */
export class SquadNavigation {
  constructor(private readonly terrain:TerrainSystem){}
  freeDestination(point:Vec2):Vec2 {
    const target=this.terrain.clampToWorld(point);
    if(!this.terrain.obstacleAt(target.x,target.z,8))return target;
    for(let radius=8;radius<=60;radius+=4)for(let i=0;i<16;i++){
      const p={x:target.x+Math.cos(i*Math.PI/8)*radius,z:target.z+Math.sin(i*Math.PI/8)*radius};
      if(insideWorld(p,10)&&!this.terrain.obstacleAt(p.x,p.z,8))return p;
    }
    return target;
  }
  plan(start:Vec2,requestedGoal:Vec2,avoid?: (point:Vec2)=>boolean):Vec2[] {
    const interior=this.terrain.buildingAt(start);
    if(interior!==undefined){const b=this.terrain.buildings[interior],out=doorPoint(b,8),rest=this.plan(out,requestedGoal,avoid);return rest.length?[{x:b.x,z:b.z},doorPoint(b,-1),out,...rest]:[];}
    const goal=this.freeDestination(requestedGoal),range=distance(start,goal);
    const clear=(a:Vec2,b:Vec2,margin:number)=>this.segmentClear(a,b,margin,avoid);
    // Garrison approaches already sample every metre, including trench walls.
    // A clear 200+ m approach does not need an expensive grid search per person.
    if((avoid||range<200)&&clear(start,goal,4))return [goal];
    const cell=avoid?8:range<700?8:60,ox=avoid?start.x:0,oz=avoid?start.z:0;
    const sx=Math.round((start.x-ox)/cell),sz=Math.round((start.z-oz)/cell),gx=Math.round((goal.x-ox)/cell),gz=Math.round((goal.z-oz)/cell);
    const key=(x:number,z:number)=>`${x},${z}`;
    const open=new MinHeap(),best=new Map<string,number>(),costs=new Map<string,number>();
    open.push({x:sx,z:sz,g:0,f:0});best.set(key(sx,sz),0);
    let found:Node|undefined;
    for(let iteration=0;iteration<(avoid?8000:30000)&&open.size;iteration++){
      const current=open.pop()!;
      if(current.g!==(best.get(key(current.x,current.z))??Infinity))continue;
      const point={x:ox+current.x*cell,z:oz+current.z*cell};
      // Like the direct-approach shortcut and route compaction, an external
      // search can finish with a fully checked visible leg. Requiring it to
      // enter the final grid cell can exhaust the budget on costly terrain
      // despite an already clear entrance. This is not a least-cost guarantee.
      if((avoid?distance(point,goal)<180:Math.hypot(current.x-gx,current.z-gz)<1.5)&&clear(point,goal,2)){found=current;break;}
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
        if(!dx&&!dz)continue;
        const nx=current.x+dx,nz=current.z+dz,x=ox+nx*cell,z=oz+nz*cell;
        if(Math.abs(x)>WORLD_HALF-5||Math.abs(z)>WORLD_HALF-5||this.terrain.obstacleAt(x,z,cell<10?5:8)||avoid?.({x,z}))continue;
        if(!clear(point,{x,z},2))continue;
        // Geometry is fixed during this synchronous search. Cache only here,
        // never across excavation changes, saves or another world's terrain.
        const nodeKey=key(nx,nz);let cost=costs.get(nodeKey);
        if(cost===undefined){cost=this.terrain.navigationCostAt(x,z);costs.set(nodeKey,cost);}
        const nextG=current.g+Math.hypot(dx,dz)*cost;
        if(nextG>=(best.get(nodeKey)??Infinity))continue;
        best.set(nodeKey,nextG);open.push({x:nx,z:nz,g:nextG,f:nextG+Math.hypot(nx-gx,nz-gz)*.8,parent:current});
      }
    }
    if(!found)return [];
    const route:Vec2[]=[goal];let cursor:Node|undefined=found;
    while(cursor?.parent){route.push({x:ox+cursor.x*cell,z:oz+cursor.z*cell});cursor=cursor.parent;}
    route.reverse();
    // Drop a waypoint only if the entire replacement segment clears footprints.
    const compact:Vec2[]=[];let anchor=start;
    for(let i=0;i<route.length;i++){
      if(i+1<route.length&&clear(anchor,route[i+1],6)&&distance(anchor,route[i+1])<180)continue;
      compact.push(route[i]);anchor=route[i];
    }
    return compact;
  }
  segmentClear(a:Vec2,b:Vec2,clearance:number,avoid?: (point:Vec2)=>boolean):boolean {
    const steps=Math.max(1,Math.ceil(distance(a,b)/(avoid?1:4)));
    for(let i=1;i<=steps;i++){
      const t=i/steps;
      const p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      if(this.terrain.obstacleAt(p.x,p.z,clearance)||avoid?.(p))return false;
    }
    return true;
  }
}
