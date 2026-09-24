import {distance,distanceToSegment,type BattlefieldState,type SoldierState,type SquadState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';

export const COVER_BUDGET=49;
/** Once per tick, allied occupancy/reservations only. Hidden enemy positions do
 * not enter this index. Reviews reuse it instead of scanning the whole army. */
export class CoverSpace {
  private cells=new Map<string,{id:number;point:Vec2}[]>();
  constructor(state:BattlefieldState){
    const sides=new Map(state.squads.map(q=>[q.id,q.faction??'player']));
    for(const s of state.soldiers)if(s.needs?.life==='active'){
      this.add(s.id,sides.get(s.squadId)!,s);
      const c=s.combat,p=c?.reactionRoute?.[c.reactionIndex??0];if(p)this.add(s.id,sides.get(s.squadId)!,p);
    }
  }
  add(id:number,side:string,p:Vec2){const key=`${side}:${Math.floor(p.x/4)},${Math.floor(p.z/4)}`,row=this.cells.get(key)??[];row.push({id,point:{x:p.x,z:p.z}});this.cells.set(key,row);}
  occupied(s:SoldierState,q:SquadState,p:Vec2):boolean{
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if(this.cells.get(`${q.faction??'player'}:${Math.floor(p.x/4)+x},${Math.floor(p.z/4)+z}`)?.some(o=>o.id!==s.id&&distance(o.point,p)<.95))return true;
    return false;
  }
}

export function chooseLocalCover(s:SoldierState,q:SquadState,terrain:TerrainSystem,nav:SquadNavigation,space:CoverSpace,pinned=false){
  const radius=pinned?5:12,angle=s.combat?.threatDirection;
  // Only a bearing is known, not the shooter's actual location or identity.
  const threat=angle===undefined?undefined:{x:s.x+Math.sin(angle)*28,z:s.z+Math.cos(angle)*28};
  const threatY=threat?terrain.heightAt(threat.x,threat.z)+1.4:0;
  const height=s.posture==='prone'?.35:.85;
  const quality=(p:Vec2)=>{
    const cover=terrain.coverAt(p.x,p.z),earth=Math.max(0,terrain.baseHeightAt(p.x,p.z)-terrain.heightAt(p.x,p.z));
    const ray=threat?terrain.objects.trace(threat,p,threatY,terrain.heightAt(p.x,p.z)+height,true):undefined;
    // Solid protection is distinct from foliage concealment.
    return (ray&&!ray.clear?24:0)+(ray?.clear?(1-ray.transmission)*3:0)+Math.min(8,earth*4)+(cover==='trench'?7:cover==='forest'?2:cover==='low-ground'?2:0);
  };
  const baseline=quality(s),candidates:Vec2[]=[...terrain.localCoverAnchors(s,radius)];
  for(const r of pinned?[1.5,3,5]:[2,5,9,12])for(let n=0;n<8;n++){
    const a=n*Math.PI/4+(s.id%4)*.19;candidates.push({x:s.x+Math.sin(a)*r,z:s.z+Math.cos(a)*r});
  }
  const path=q.order.drawnPath,withinRoute=(p:Vec2)=>!path||path.slice(1).some((b,i)=>distanceToSegment(p,path[i],b).distance<=12);
  let best:Vec2|undefined,bestScore=baseline+(pinned?7:3),tested=0;
  for(const p of candidates.slice(0,COVER_BUDGET-1)){
    tested++;
    if(distance(s,p)>radius||distance(s,p)<.4||!withinRoute(p)||space.occupied(s,q,p)||terrain.obstacleAt(p.x,p.z,.5)||!nav.segmentClear(s,p,.5))continue;
    const score=quality(p)-distance(s,p)*(pinned?1:.45);
    if(score>bestScore){best=p;bestScore=score;}
  }
  if(best)space.add(s.id,q.faction??'player',best);
  return {point:best,quality:bestScore,baseline,tested};
}
