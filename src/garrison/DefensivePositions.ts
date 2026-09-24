import {distance,distanceToSegment,type SoldierState,type Vec2} from '../core/types';
import type {TrenchNetwork} from './TrenchNetwork';
import type {TerrainSystem} from '../terrain/TerrainSystem';

/** The front is a world direction, never the polyline's drawing order. */
export function bankPoint(network:TrenchNetwork,p:Vec2,front:number,forward=true):Vec2 {
  const hit=network.nearest(p);if(!hit)return p;
  const e=network.edges[hit.edge],a=network.nodes[e.a],b=network.nodes[e.b];
  const nx=(b.z-a.z)/e.length,nz=-(b.x-a.x)/e.length;
  const side=(nx*Math.sin(front)+nz*Math.cos(front)>=0?1:-1)*(forward?1:-1);
  const offset=forward?Math.min(1.48,e.width*.35):Math.min(1.15,e.width*.27);
  return {x:p.x+nx*offset*side,z:p.z+nz*offset*side};
}

export function defensivePost(network:TrenchNetwork,terrain:TerrainSystem,component:number,front:number,s:SoldierState,people:SoldierState[],entrance:Vec2,excluded:Vec2[],sector?:Vec2,frontage?:Vec2[]):Vec2|undefined {
  const fx=Math.sin(front),fz=Math.cos(front),posts=people.filter(o=>o!==s&&o.needs?.life!=='dead'&&o.duty?.kind==='watch').map(o=>o.duty!.watchPost??o.duty!.destination);
  const transverse=network.edges.some(e=>{const a=network.nodes[e.a],b=network.nodes[e.b];return !e.portal&&a.component===component&&Math.abs((b.z-a.z)/e.length*fx-(b.x-a.x)/e.length*fz)>=.35;});
  const candidates=network.samples(component,3).flatMap(p=>{
    const hit=network.nearest(p,component)! ,e=network.edges[hit.edge],a=network.nodes[e.a],b=network.nodes[e.b];
    if(e.portal||transverse&&Math.abs((b.z-a.z)/e.length*fx-(b.x-a.x)/e.length*fz)<.35)return [];
    const point=bankPoint(network,p,front),forward=p.x*fx+p.z*fz;
    if(frontage&&!frontage.slice(1).some((b,i)=>distanceToSegment(point,frontage[i],b).distance<40))return [];
    if(distance(point,entrance)<10||excluded.some(v=>distance(v,point)<6)||terrain.coverAt(point.x,point.z)!=='trench')return [];
    if(network.nodes.some(n=>n.edges.length>2&&distance(n,point)<3)||people.some(o=>o!==s&&o.needs?.life!=='dead'&&(distance(o,point)<.8||o.duty&&distance(o.duty.destination,point)<1.3)))return [];
    const separation=Math.min(16,...posts.map(post=>distance(point,post)));
    return [{point,forward,score:forward*.16+separation*.9-distance(s,point)*.06-(sector?distance(point,sector)*.8:0)}];
  });
  const leading=Math.max(...candidates.map(c=>c.forward));
  const shortlist=candidates.filter(c=>c.forward>=leading-30).sort((a,b)=>b.score-a.score||a.point.x-b.point.x||a.point.z-b.point.z).slice(0,10);
  // Prefer a useful field of observation, while keeping post/relief reservations stable.
  for(const c of shortlist){
    let clear=0;for(const arc of [-.45,0,.45]){
      const to={x:c.point.x+Math.sin(front+arc)*70,z:c.point.z+Math.cos(front+arc)*70};
      if(terrain.objects.trace(c.point,to,Math.max(terrain.heightAt(c.point.x,c.point.z)+1.6,terrain.baseHeightAt(c.point.x,c.point.z)+.45),terrain.heightAt(to.x,to.z)+1.6).transmission>.2)clear++;
    }c.score+=clear*3;
  }
  return shortlist.sort((a,b)=>b.score-a.score||a.point.x-b.point.x||a.point.z-b.point.z)[0]?.point;
}
