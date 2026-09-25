import { distance, distanceToSegment, lerpVec, type TrenchState, type Vec2 } from '../core/types';
import { CapacityCells } from './CapacityCells';
import {excavatedPoints,excavationKey} from '../core/TrenchGeometry';

interface Segment { a: Vec2; b: Vec2; width: number; trench: number; cuts: number[] }
export interface NetworkEdge { a: number; b: number; length: number; width: number; trenches: number[]; portal?:boolean }
export interface NetworkNode extends Vec2 { id: number; component: number; edges: number[] }
const cross = (a: Vec2, b: Vec2) => a.x * b.z - a.z * b.x;
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });

/** Finished excavation graph. Touching corridors connect only when the overlap admits a body. */
export class TrenchNetwork {
  nodes: NetworkNode[] = [];
  edges: NetworkEdge[] = [];
  revision = 0;
  private signature = '';
  private cache = new Map<string, string[]>();
  private nodeLookup = new Map<string, number>();
  changedTrenches=new Set<number>();
  private trenchSignatures=new Map<number,string>();
  private capacities=new Map<number,number>();
  private components=new Map<number,number>();
  private anchors=new Map<number,number>();
  private corridorBuckets=new Map<string,number[]>();
  sync(trenches: TrenchState[]): boolean {
    const signature = trenches.map(t => `${t.id}:${t.width}:${excavationKey(t,1)}:${t.points.map(p => `${p.x},${p.z}`).join(';')}`).join('|');
    if (signature === this.signature) return false;
    const next=new Map(trenches.map(t=>[t.id,`${t.width}:${excavationKey(t,.01)}:${JSON.stringify(t.points)}`]));
    this.changedTrenches=new Set([...this.trenchSignatures.keys(),...next.keys()].filter(id=>this.trenchSignatures.get(id)!==next.get(id)));this.trenchSignatures=next;
    this.signature = signature; this.revision++; this.nodes = []; this.edges = [];
    const segments: Segment[] = [],portals:{a:Vec2;b:Vec2;width:number;trenches:number[]}[]=[];
    for (const t of trenches) {
      const built=excavatedPoints(t,1);
      for (let i = 1; i < built.length; i++) {
        const a = built[i - 1], length = distance(a, built[i]);
        if (length < .01) continue;
        segments.push({ a, b: built[i], width: t.width, trench: t.id, cuts: [0, 1] });
      }
    }
    const buckets = new Map<string, number[]>(), pairs = new Set<string>();
    segments.forEach((s, i) => {
      for (let x = Math.floor((Math.min(s.a.x,s.b.x)-s.width)/32); x <= Math.floor((Math.max(s.a.x,s.b.x)+s.width)/32); x++)
        for (let z = Math.floor((Math.min(s.a.z,s.b.z)-s.width)/32); z <= Math.floor((Math.max(s.a.z,s.b.z)+s.width)/32); z++) {
          const key = `${x},${z}`, list = buckets.get(key) ?? [];
          for (const j of list) {
            const pair = `${j}:${i}`; if (pairs.has(pair)) continue; pairs.add(pair);
            const t = segments[j], r = sub(s.b,s.a), q = sub(t.b,t.a), d = sub(t.a,s.a), determinant = cross(r,q);
            if (Math.abs(determinant) > 1e-8) {
              const u = cross(d,q)/determinant, v = cross(d,r)/determinant;
              if(u>=-1e-7&&u<=1+1e-7&&v>=-1e-7&&v<=1+1e-7){s.cuts.push(Math.max(0,Math.min(1,u)));t.cuts.push(Math.max(0,Math.min(1,v)));}
            } else {
              for(const p of [s.a,s.b]){const h=distanceToSegment(p,t.a,t.b);if(h.distance<.005)t.cuts.push(h.t);}
              for(const p of [t.a,t.b]){const h=distanceToSegment(p,s.a,s.b);if(h.distance<.005)s.cuts.push(h.t);}
            }
            // Endpoint-to-segment portals also handle overlapping offset parallel drawings.
            const candidates=[...([0,1] as const).map(u=>{const p=lerpVec(s.a,s.b,u),h=distanceToSegment(p,t.a,t.b);return {u,v:h.t,d:h.distance};}),...([0,1] as const).map(v=>{const p=lerpVec(t.a,t.b,v),h=distanceToSegment(p,s.a,s.b);return {u:h.t,v,d:h.distance};})];
            for(const c of candidates)if(c.d>.005&&c.d<(s.width+t.width)*.4-.6){
              s.cuts.push(c.u);t.cuts.push(c.v);portals.push({a:lerpVec(s.a,s.b,c.u),b:lerpVec(t.a,t.b,c.v),width:Math.max(.65,(s.width+t.width)*.4-c.d),trenches:[s.trench,t.trench]});
            }
          }
          list.push(i); buckets.set(key,list);
        }
    });
    const points = new Map<string, number>(), edges = new Map<string, NetworkEdge>();
    const node = (p: Vec2): number => {
      const key = `${Math.round(p.x*100)},${Math.round(p.z*100)}`;
      let id = points.get(key); if(id === undefined){id=this.nodes.length;points.set(key,id);this.nodes.push({...p,id,component:-1,edges:[]});} return id;
    };
    for(const s of segments){
      const cuts=[...new Set(s.cuts.map(t=>Math.round(t*1e8)/1e8))].sort((a,b)=>a-b);
      for(let i=1;i<cuts.length;i++){
        const from=lerpVec(s.a,s.b,cuts[i-1]),to=lerpVec(s.a,s.b,cuts[i]);
        if(distance(from,to)<.01)continue;
        const a=node(from),b=node(to),key=a<b?`${a}:${b}`:`${b}:${a}`,old=edges.get(key);
        if(old){old.width=Math.max(old.width,s.width);if(!old.trenches.includes(s.trench))old.trenches.push(s.trench);}
        else edges.set(key,{a,b,length:distance(from,to),width:s.width,trenches:[s.trench]});
      }
    }
    for(const p of portals){const a=node(p.a),b=node(p.b),key=a<b?`${a}:${b}`:`${b}:${a}`;if(!edges.has(key))edges.set(key,{a,b,width:p.width,length:distance(p.a,p.b),trenches:p.trenches,portal:true});}
    this.edges=[...edges.values()];
    // Membership is a local question, used at every route-search sample. Keep
    // exact segment tests, but do not scan every distant garrison's edges.
    this.corridorBuckets.clear();
    this.edges.forEach((e,i)=>{
      const a=this.nodes[e.a],b=this.nodes[e.b],r=e.width*.43;
      for(let x=Math.floor((Math.min(a.x,b.x)-r)/32);x<=Math.floor((Math.max(a.x,b.x)+r)/32);x++)
        for(let z=Math.floor((Math.min(a.z,b.z)-r)/32);z<=Math.floor((Math.max(a.z,b.z)+r)/32);z++){
          const key=`${x},${z}`,bucket=this.corridorBuckets.get(key)??[];bucket.push(i);this.corridorBuckets.set(key,bucket);
        }
    });
    this.nodeLookup=points;
    this.edges.forEach((e,i)=>{this.nodes[e.a].edges.push(i);this.nodes[e.b].edges.push(i);});
    for(const n of this.nodes){if(n.component>=0)continue;const queue=[n.id];n.component=n.id;while(queue.length){const id=queue.pop()!;for(const ei of this.nodes[id].edges){const e=this.edges[ei],other=e.a===id?e.b:e.a;if(this.nodes[other].component<0){this.nodes[other].component=n.id;queue.push(other);}}}}
    this.components.clear();this.anchors.clear();
    for(const e of this.edges)for(const id of e.trenches){const component=this.nodes[e.a].component;this.components.set(id,component);this.anchors.set(component,Math.min(this.anchors.get(component)??Infinity,id));}
    const affected=new Set(this.edges.filter(e=>e.trenches.some(id=>this.changedTrenches.has(id))).map(e=>this.nodes[e.a].component));
    for(const [key,path] of this.cache)if(path.some(p=>{const id=this.nodeLookup.get(p);return id===undefined||affected.has(this.nodes[id].component);}))this.cache.delete(key);
    this.measureCapacity();
    return true;
  }
  component(trenchId:number):number|undefined {return this.components.get(trenchId);}
  /** Oldest persistent segment ID is the identity; graph node indices are not saved IDs. */
  anchor(trenchId:number):number {return this.anchors.get(this.component(trenchId)??-1)??trenchId;}
  capacity(component:number):number {return this.capacities.get(component)??0;}
  private measureCapacity():void {
    // Half-metre scanline union of usable corridor rectangles. A shared cell is counted once,
    // including overlapping corridors too narrow to connect. It is not a permanent soldier slot.
    const cells=new CapacityCells(),h=.5;
    for(const e of this.edges){
      if(e.portal)continue;
      // Widening permits passing without multiplying linear occupancy capacity.
      const a=this.nodes[e.a],b=this.nodes[e.b],r=Math.min(4.2,e.width)*.4,dx=(b.x-a.x)/e.length,dz=(b.z-a.z)/e.length;
      const polygon=[{x:a.x+dz*r,z:a.z-dx*r},{x:b.x+dz*r,z:b.z-dx*r},{x:b.x-dz*r,z:b.z+dx*r},{x:a.x-dz*r,z:a.z+dx*r}];
      const minZ=Math.min(...polygon.map(p=>p.z)),maxZ=Math.max(...polygon.map(p=>p.z));
      for(let iz=Math.floor(minZ/h);iz<Math.ceil(maxZ/h);iz++){
        const low=Math.max(minZ,iz*h),high=Math.min(maxZ,(iz+1)*h),z=(low+high)/2,xs:number[]=[];
        for(let i=0;i<4;i++){const p=polygon[i],q=polygon[(i+1)%4];if((p.z<=z&&q.z>z)||(q.z<=z&&p.z>z))xs.push(p.x+(q.x-p.x)*(z-p.z)/(q.z-p.z));}
        xs.sort((a,b)=>a-b);if(xs.length<2)continue;
        for(let ix=Math.floor(xs[0]/h);ix<Math.ceil(xs.at(-1)!/h);ix++){const area=Math.max(0,Math.min(xs.at(-1)!,(ix+1)*h)-Math.max(xs[0],ix*h))*(high-low);cells.add(ix,iz,a.component,area);}
      }
    }
    this.capacities.clear();const areas=cells.areas();
    // Standard 4.2 m trench: 3.36 m usable width and 2.5 m of length per person.
    for(const [id,area] of areas)this.capacities.set(id,Math.max(0,Math.floor((area-6*3.36)/(2.5*3.36))));
  }
  nearest(p:Vec2,component?:number):{point:Vec2;edge:number;t:number;distance:number}|undefined {
    let best:ReturnType<TrenchNetwork['nearest']>;
    this.edges.forEach((e,i)=>{if(component!==undefined&&this.nodes[e.a].component!==component)return;const hit=distanceToSegment(p,this.nodes[e.a],this.nodes[e.b]);if(!best||hit.distance<best.distance)best={point:lerpVec(this.nodes[e.a],this.nodes[e.b],hit.t),edge:i,...hit};});return best;
  }
  samples(component:number,spacing=5):Vec2[]{
    const result:Vec2[]=[];for(const e of this.edges){if(this.nodes[e.a].component!==component)continue;const count=Math.max(1,Math.floor(e.length/spacing));for(let i=0;i<count;i++)result.push(lerpVec(this.nodes[e.a],this.nodes[e.b],(i+.5)/count));}return result;
  }
  route(from:Vec2,to:Vec2,component?:number):Vec2[]{
    const a=this.nearest(from,component),b=this.nearest(to,component);if(!a||!b)return [];
    const ae=this.edges[a.edge],be=this.edges[b.edge];if(this.nodes[ae.a].component!==this.nodes[be.a].component)return [];
    if(a.edge===b.edge)return [a.point,b.point];
    let best:number[]|undefined,bestCost=Infinity;
    for(const start of [ae.a,ae.b])for(const end of [be.a,be.b]){
      const path=this.shortest(start,end);if(!path.length)continue;
      let cost=distance(a.point,this.nodes[start])+distance(b.point,this.nodes[end]);for(let i=1;i<path.length;i++)cost+=distance(this.nodes[path[i-1]],this.nodes[path[i]]);
      if(cost<bestCost){bestCost=cost;best=path;}
    }
    return best?[a.point,...best.map(i=>({x:this.nodes[i].x,z:this.nodes[i].z})),b.point]:[];
  }
  private shortest(start:number,end:number):number[]{
    const coord=(id:number)=>`${Math.round(this.nodes[id].x*100)},${Math.round(this.nodes[id].z*100)}`;
    const key=`${coord(start)}:${coord(end)}`,cached=this.cache.get(key);
    if(cached){const ids=cached.map(p=>this.nodeLookup.get(p));if(ids.every((id,i)=>id!==undefined&&(i===0||this.nodes[id].edges.some(e=>this.edges[e].a===ids[i-1]||this.edges[e].b===ids[i-1]))))return ids as number[];this.cache.delete(key);}
    const costs=new Map<number,number>([[start,0]]),parent=new Map<number,number>(),open=new Set([start]);
    while(open.size){let at=-1,best=Infinity;for(const id of open){const cost=costs.get(id)!+distance(this.nodes[id],this.nodes[end]);if(cost<best){at=id;best=cost;}}
      open.delete(at);if(at===end){const path=[at];while(parent.has(path[0]))path.unshift(parent.get(path[0])!);if(this.cache.size>4096)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,path.map(coord));return path;}
      for(const i of this.nodes[at].edges){const e=this.edges[i],next=e.a===at?e.b:e.a,cost=costs.get(at)!+e.length;if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);parent.set(next,at);open.add(next);}}
    }return [];
  }
  corridorClearance(p:Vec2):number {let best=Infinity;for(const e of this.edges)best=Math.min(best,distanceToSegment(p,this.nodes[e.a],this.nodes[e.b]).distance-e.width*.43);return best;}
  corridorContains(p:Vec2):boolean {
    return (this.corridorBuckets.get(`${Math.floor(p.x/32)},${Math.floor(p.z/32)}`)??[]).some(i=>{
      const e=this.edges[i];return distanceToSegment(p,this.nodes[e.a],this.nodes[e.b]).distance-e.width*.43<=0;
    });
  }
  segmentInside(a:Vec2,b:Vec2):boolean {const steps=Math.max(1,Math.ceil(distance(a,b)));for(let i=0;i<=steps;i++)if(!this.corridorContains(lerpVec(a,b,i/steps)))return false;return true;}
}
