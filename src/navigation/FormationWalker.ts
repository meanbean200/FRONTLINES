import {clamp,distance,type BattlefieldState,type SoldierState,type SquadState,type Vec2,WORLD_HALF} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from './SquadNavigation';
import {ownsAction} from '../combat/Reactions';
import {postureSpeed} from '../combat/Posture';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';
import {insideWorld} from '../terrain/WorldLayout';
import {bodyBlocks,sameSide} from './FriendlyTraffic';
import {routeJoin} from './RouteJoin';

/** Serialized progress belongs to each walker, not the formation's average position. */
export interface FormationTravel {
  orderAt:number; index:number; goal:Vec2; local:Vec2[]; localIndex:number;
  retryAt:number; checkpoint:Vec2; progressAt:number; arrived:boolean;
}
export class FormationWalker {
  private cells=new Map<string,SoldierState[]>();
  private replans=0;
  private state?:BattlefieldState;
  constructor(private terrain:TerrainSystem,private navigation:SquadNavigation){}
  begin(state:BattlefieldState):void{
    this.state=state;
    this.cells.clear();this.replans=0;
    for(const s of state.soldiers)if(s.needs?.life==='active'&&!s.building){const key=this.key(s),row=this.cells.get(key)??[];row.push(s);this.cells.set(key,row);}
  }
  private key(p:Vec2){return `${Math.floor(p.x/4)},${Math.floor(p.z/4)}`;}
  private neighbors(p:Vec2){const rows:SoldierState[]=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)rows.push(...(this.cells.get(`${Math.floor(p.x/4)+x},${Math.floor(p.z/4)+z}`)??[]));return rows;}
  private destination(q:SquadState,i:number,count:number):Vec2{
    const end=q.route.at(-1)!,angle=q.formationHeading??0,row=Math.floor(i/4),size=Math.min(4,count-row*4);
    const lateral=(i%4-(size-1)/2)*2.4,depth=(row-(Math.ceil(count/4)-1)/2)*2.6;
    const desired={x:clamp(end.x+Math.cos(angle)*lateral-Math.sin(angle)*depth,-WORLD_HALF+1,WORLD_HALF-1),z:clamp(end.z-Math.sin(angle)*lateral-Math.cos(angle)*depth,-WORLD_HALF+1,WORLD_HALF-1)};
    if(!this.terrain.walkingObstacleAt(desired.x,desired.z,.8))return desired;
    for(let r=2;r<=20;r+=2)for(let a=0;a<16;a++){
      const p={x:desired.x+Math.sin(a*Math.PI/8)*r,z:desired.z+Math.cos(a*Math.PI/8)*r};
      if(insideWorld(p,1)&&!this.terrain.walkingObstacleAt(p.x,p.z,.8))return p;
    }
    return desired;
  }
  step(state:BattlefieldState,q:SquadState,people:SoldierState[],dt:number):boolean{
    let complete=true;
    for(const [i,s] of people.entries()){
      let t=s.formationTravel;
      if(!t||t.orderAt!==q.order.issuedAt){
        const goal=this.destination(q,i,people.length),join=routeJoin(q.route,s,(a,b)=>this.navigation.segmentClear(a,b,.65));
        const near=distance(s,q.route.at(-1)!)<8&&this.navigation.segmentClear(s,goal,.65);
        t=s.formationTravel={orderAt:q.order.issuedAt,index:near?q.route.length-1:join?.index??0,goal,local:!near&&join&&distance(s,join.point)>.55?[join.point]:[],localIndex:0,retryAt:state.elapsed,checkpoint:{x:s.x,z:s.z},progressAt:state.elapsed,arrived:false};
      }
      if(!ownsAction(s,'order')){complete=false;t.progressAt=state.elapsed;continue;}
      if(t.arrived&&distance(s,t.goal)<1.4)continue;
      const final=t.index>=q.route.length-1;
      let target=final?t.goal:q.route[t.index];
      if(!target){complete=false;continue;}
      if(distance(s,target)<(final?.65:.8)){
        if(final){t.arrived=true;s.action='holding';continue;}
        t.index++;t.local=[];t.localIndex=0;target=t.index>=q.route.length-1?t.goal:q.route[t.index];
      }
      complete=false;t.arrived=false;
      // Checkpoint measures actual displacement, so wall-sliding oscillation
      // cannot reset a blocked timer every frame. Replanning is capped globally.
      if(distance(s,t.checkpoint)>1.8){t.checkpoint={x:s.x,z:s.z};t.progressAt=state.elapsed;}
      if(t.localIndex<t.local.length&&distance(s,t.local[t.localIndex])<.55)t.localIndex++;
      if(t.localIndex>=t.local.length){t.local=[];t.localIndex=0;}
      const review=state.elapsed>=t.retryAt;
      const obstructed=review&&!t.local.length&&!this.navigation.segmentClear(s,target,.8);
      if((obstructed||state.elapsed-t.progressAt>3)&&review&&this.replans<2){
        this.replans++;t.retryAt=state.elapsed+6+(s.id%5)*.2;
        const near=distance(s,target)<65;
        const blockers=this.neighbors(s).filter(p=>p!==s&&!sameSide(state,s,p)&&(!p.formationTravel||p.formationTravel.arrived));
        const avoid=(p:Vec2)=>near&&this.terrain.objects.trunkAt(p.x,p.z,.65)!==undefined||blockers.some(other=>distance(p,other)<1.15&&distance(p,other)<distance(s,other)-.01);
        t.local=this.navigation.plan(s,target,avoid,true,2000);t.localIndex=0;t.progressAt=state.elapsed;
      }
      else if(review&&!obstructed)t.retryAt=state.elapsed+2;
      if(t.local.length)target=t.local[t.localIndex]??target;
      this.walk(s,target,dt);
    }
    q.routeIndex=Math.min(...people.map(s=>s.formationTravel?.index??0));q.movementState='moving';
    return complete;
  }
  walk(s:SoldierState,target:Vec2,dt:number,inside?:TrenchNetwork):void{
    const d=distance(s,target);if(d<.05)return;
    const heading=Math.atan2(target.x-s.x,target.z-s.z),local=this.neighbors(s).filter(p=>p!==s);
    const speed=3.4*postureSpeed(s)/(1+this.terrain.slopeAt(s.x,s.z)*3)*(1-clamp(s.fatigue/180,0,.35))*Math.max(.12,1-s.suppression/110),amount=Math.min(d,speed*dt);
    // Right-hand passing is relative to travel direction, so opposing walkers
    // choose opposite physical sides. Friendly separation is only a soft
    // preference; hostile bodies and physical geometry still constrain travel.
    let best:Vec2|undefined,bestScore=-Infinity;
    for(const turn of [0,.45,-.45,.9,-.9,1.3,-1.3,1.65,-1.65]){
      const a=heading+turn,p={x:s.x+Math.sin(a)*amount,z:s.z+Math.cos(a)*amount};
      if(this.terrain.obstacleAt(p.x,p.z,.65))continue;
      if(inside&&!inside.corridorContains(p))continue;
      const tree=this.terrain.objects.trunkAt(p.x,p.z,.65);
      // Existing saves/spawns can start inside a previously non-colliding trunk.
      // They may walk outward, never further into or across it.
      if(tree&&distance(p,tree)<=distance(s,tree)+1e-6)continue;
      if(turn===0&&!local.some(other=>distance(s,other)<2.1)){best=p;bestScore=1;break;}
      let separation=0,blocked=false;
      for(const other of local){const after=distance(p,other);if(this.state&&bodyBlocks(this.state,s,other,p,.85)){blocked=true;break;}separation+=Math.max(0,1.7-after)**2;}
      if(blocked)continue;
      // Congestion may soften spacing, never reverse or veto onward progress.
      const score=(d-distance(p,target))/Math.max(.01,amount)-Math.min(.2,separation*.08)+(turn>0?.015:0);
      if(score>bestScore){best=p;bestScore=score;}
    }
    if(!best){s.action='yielding · route retained';return;}
    const old=this.key(s);s.heading=Math.atan2(best.x-s.x,best.z-s.z);s.x=best.x;s.z=best.z;
    const key=this.key(s);if(old!==key){const row=this.cells.get(old),index=row?.indexOf(s)??-1;if(index>=0)row!.splice(index,1);const next=this.cells.get(key)??[];next.push(s);this.cells.set(key,next);}
    s.action=bestScore<.15?'yielding · route retained':'advancing';s.cover=this.terrain.coverAt(s.x,s.z);
  }
}
