import {distance,WORLD_HALF,type Vec2} from '../core/types';
import type {TerrainSystem} from './TerrainSystem';
import {treesForChunk,treeCleared,type TreeSite} from './WorldFeatures';
import {MATERIALS} from './BuildingGeometry';

export interface SightRay {clear:boolean;transmission:number;blockedBy?:'terrain'|'building'|'trunk';point?:Vec2;energy?:number}
/** Segment/box slab intersection; finite 3D volumes, not infinitely tall obstacles. */
export function boxIntersection(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},box:{x:number;y:number;z:number;rx:number;ry:number;rz:number}):[number,number]|undefined {
  let enter=0,leave=1;
  for(const [start,delta,center,r] of [[a.x,b.x-a.x,box.x,box.rx],[a.y,b.y-a.y,box.y,box.ry],[a.z,b.z-a.z,box.z,box.rz]]){
    if(Math.abs(delta)<1e-9){if(Math.abs(start-center)>r)return;continue;}
    const t1=(center-r-start)/delta,t2=(center+r-start)/delta;
    enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));if(enter>leave)return;
  }return leave>0&&enter<1?[enter,leave]:undefined;
}
function sphereIntersection(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},c:{x:number;y:number;z:number},rx:number,ry:number):number {
  const x=(a.x-c.x)/rx,y=(a.y-c.y)/ry,z=(a.z-c.z)/rx,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,dz=(b.z-a.z)/rx;
  const aa=dx*dx+dy*dy+dz*dz,bb=2*(x*dx+y*dy+z*dz),cc=x*x+y*y+z*z-1,disc=bb*bb-4*aa*cc;
  if(disc<=0||aa<1e-9)return 0;
  return Math.max(0,Math.min(1,(-bb+Math.sqrt(disc))/(2*aa))-Math.max(0,(-bb-Math.sqrt(disc))/(2*aa)))*Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
}

export class WorldOcclusion {
  private chunks=new Map<string,TreeSite[]>();
  private clearances=new WeakMap<TreeSite,{revision:number;cleared:boolean}>();
  private rays=new Map<string,SightRay>();
  private rayRevision=-1;
  private rayKeys:string[]=[];
  private rayCursor=0;
  constructor(private terrain:TerrainSystem){}
  reset():void{this.chunks.clear();this.clearances=new WeakMap();this.rays.clear();this.rayKeys=[];this.rayCursor=0;this.rayRevision=-1;}
  trees(x0:number,z0:number):TreeSite[]{
    if(x0< -WORLD_HALF||z0< -WORLD_HALF||x0>=WORLD_HALF||z0>=WORLD_HALF)return [];
    const key=`${x0},${z0}`;let trees=this.chunks.get(key);if(!trees){trees=treesForChunk(this.terrain,x0,z0);this.chunks.set(key,trees);}return trees;
  }
  private cleared(tree:TreeSite):boolean {
    const cached=this.clearances.get(tree);if(cached?.revision===this.terrain.revision)return cached.cleared;
    const cleared=treeCleared(this.terrain,tree);this.clearances.set(tree,{revision:this.terrain.revision,cleared});return cleared;
  }
  trace(from:Vec2,to:Vec2,fromY:number,toY:number,foliage=true,precise=false):SightRay {
    if(this.rayRevision!==this.terrain.revision){this.rays.clear();this.rayKeys=[];this.rayCursor=0;this.rayRevision=this.terrain.revision;}
    // Exact endpoints: no rounding across the edge of a narrow trunk or wall.
    const key=`${from.x},${from.z},${fromY}:${to.x},${to.z},${toY}:${foliage}:${precise}`;
    const cached=this.rays.get(key);if(cached)return cached;
    const ray=this.traceUncached(from,to,fromY,toY,foliage,precise);
    // A ring avoids repeatedly scanning deleted Map entries during a moving battle.
    if(this.rayKeys.length<12000)this.rayKeys.push(key);else{this.rays.delete(this.rayKeys[this.rayCursor]);this.rayKeys[this.rayCursor]=key;this.rayCursor=(this.rayCursor+1)%12000;}
    this.rays.set(key,ray);return ray;
  }
  private traceUncached(from:Vec2,to:Vec2,fromY:number,toY:number,foliage:boolean,precise:boolean):SightRay {
    const a={x:from.x,z:from.z,y:fromY},b={x:to.x,z:to.z,y:toY},length=distance(from,to);
    let nearest=Infinity,blockedBy:SightRay['blockedBy'];
    const penetrations:{enter:number;leave:number;resistance:number}[]=[];
    for(const box of this.terrain.supportProtection()){const hit=boxIntersection(a,b,box);if(hit&&hit[0]<nearest){nearest=hit[0];blockedBy='terrain';}}
    for(const [id,building] of this.terrain.buildings.entries()){
      if(building.x+building.width/2<Math.min(a.x,b.x)||building.x-building.width/2>Math.max(a.x,b.x)||building.z+building.depth/2<Math.min(a.z,b.z)||building.z-building.depth/2>Math.max(a.z,b.z))continue;
      const base=this.terrain.baseHeightAt(building.x,building.z);
      for(const box of this.terrain.structure(id)){
        const hit=boxIntersection(a,b,{...box,y:box.y+base});
        if(hit){const material=MATERIALS[box.material];if(!foliage&&!material.stopsSmallArms)penetrations.push({enter:hit[0],leave:hit[1],resistance:material.resistance});else if(hit[0]<nearest){nearest=hit[0];blockedBy='building';}}
      }
    }
    if(foliage&&Number.isFinite(nearest))return {clear:false,transmission:0,blockedBy};
    let opticalDepth=0;
    // Test nearby ground first. A hidden target behind a bank does not require
    // visiting every tree along the rest of a long ray.
    const steps=Math.max(1,Math.ceil(length/(precise?.5:3)));
    let understory=false;
    for(let i=1;i<steps;i++){
      const t=i/steps;if(t>=nearest)break;
      const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=fromY+(toY-fromY)*t;
      if(this.terrain.heightAt(x,z)>y+(foliage?.12:0)){
        let low=(i-1)/steps,high=t;
        if(precise)for(let n=0;n<8;n++){const mid=(low+high)/2;if(this.terrain.heightAt(a.x+(b.x-a.x)*mid,a.z+(b.z-a.z)*mid)>fromY+(toY-fromY)*mid)high=mid;else low=mid;}
        nearest=high;blockedBy='terrain';if(foliage)return {clear:false,transmission:0,blockedBy};break;
      }
      // Understory is broad vegetation, sampled every 12m; individual trunks
      // and crowns still receive their own finite geometric tests below.
      if(foliage&&i%4===1)understory=this.terrain.groundTypeAt(x,z)==='forest';
      if(foliage&&understory&&y<this.terrain.baseHeightAt(x,z)+2)opticalDepth+=length/steps*.018;
      // Once transmission is below any recognition threshold, farther foliage
      // cannot restore it. Bullet traces never take this optical shortcut.
      if(foliage&&opticalDepth>3.5)return {clear:true,transmission:Math.exp(-opticalDepth)};
    }
    for(let x=Math.floor((Math.min(a.x,b.x)-10)/500)*500;x<=Math.floor((Math.max(a.x,b.x)+10)/500)*500;x+=500)
      for(let z=Math.floor((Math.min(a.z,b.z)-10)/500)*500;z<=Math.floor((Math.max(a.z,b.z)+10)/500)*500;z+=500){
        for(const tree of this.trees(x,z)){
          if(tree.x<Math.min(a.x,b.x)-10||tree.x>Math.max(a.x,b.x)+10||tree.z<Math.min(a.z,b.z)-10||tree.z>Math.max(a.z,b.z)+10)continue;
          const u=Math.max(0,Math.min(1,((tree.x-a.x)*(b.x-a.x)+(tree.z-a.z)*(b.z-a.z))/Math.max(.001,length*length)));
          if(Math.hypot(tree.x-a.x-(b.x-a.x)*u,tree.z-a.z-(b.z-a.z)*u)>tree.size*1.5||this.cleared(tree))continue;
          const base=this.terrain.baseHeightAt(tree.x,tree.z),height=tree.size*1.8;
          const trunk=boxIntersection(a,b,{x:tree.x,y:base+height/2,z:tree.z,rx:.34,ry:height/2,rz:.34});
          if(trunk&&trunk[0]<nearest){nearest=trunk[0];blockedBy='trunk';}
          if(foliage&&trunk)return {clear:false,transmission:0,blockedBy:'trunk'};
          if(foliage)for(let layer=0;layer<3;layer++){
            const angle=layer*2.4+tree.index,radius=tree.size*(.85-layer*.1);
            opticalDepth+=sphereIntersection(a,b,{x:tree.x+Math.cos(angle)*tree.size*.45,y:base+tree.size*(1.8+layer*.25),z:tree.z+Math.sin(angle)*tree.size*.45},radius,tree.size*(1.05-layer*.13))*.22;
          }
        }
      }
    // Real heightfield (including earthworks), not a flat range circle. Dense
    // understory adds gradual concealment; it is not an invisible bullet wall.
    let energy=1;const rayLength=Math.hypot(length,toY-fromY);
    for(const piece of penetrations.sort((a,b)=>a.enter-b.enter)){if(piece.enter>=nearest)break;const loss=(Math.min(piece.leave,nearest)-piece.enter)*rayLength*piece.resistance;if(energy-loss<=.2){nearest=piece.enter+(energy-.2)/(rayLength*piece.resistance);blockedBy='building';energy=.2;break;}energy-=loss;}
    return Number.isFinite(nearest)?{clear:false,transmission:0,blockedBy,energy,point:{x:a.x+(b.x-a.x)*nearest,z:a.z+(b.z-a.z)*nearest}}:{clear:true,transmission:Math.exp(-opticalDepth),energy};
  }
}
