import {distance,type SoldierState,type Vec2} from '../core/types';
import type {TrenchNetwork} from './TrenchNetwork';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {bankPoint} from './DefensivePositions';
import {firstAvailablePoint} from './DutyReservations';

/** Temporary floor destinations, not extra beds or permanent soldier slots.
 * Coarse routine spacing is preferred. Under pressure inspect the actual width
 * before declaring floor full; never fall back to an occupied random sample. */
export function waitingSpace(network:TrenchNetwork,terrain:TerrainSystem,component:number,front:number,person:SoldierState,people:SoldierState[],entrance:Vec2,facilities:Vec2[]):Vec2|undefined {
  const junctions=network.nodes.filter(n=>n.component===component&&n.edges.length>2);
  const legal=(p:Vec2,clearance:number)=>distance(p,entrance)>=clearance&&facilities.every(f=>distance(f,p)>=3)&&junctions.every(n=>distance(n,p)>=3)&&network.corridorContains(p)&&!terrain.obstacleAt(p.x,p.z,.4);
  const closest=(a:Vec2,b:Vec2)=>distance(a,person)-distance(b,person)||a.x-b.x||a.z-b.z;
  const coarse=network.samples(component,5).map(p=>bankPoint(network,p,front,false)).filter(p=>legal(p,14)).sort(closest);
  const normal=firstAvailablePoint(coarse,person,people,.7,1.1);if(normal)return normal;
  // Both berms are usable waiting space. Inspect cross-section width too, but
  // keep a continuous centre lane rather than packing routine rest on its axis.
  const dense=network.samples(component,1.25).flatMap(p=>{
    const hit=network.nearest(p,component)!,edge=network.edges[hit.edge],a=network.nodes[edge.a],b=network.nodes[edge.b];
    if(edge.portal)return [];
    const offsets:number[]=[];for(let offset=Math.min(.6,edge.width*.27);offset<=edge.width*.4;offset+=1.2)offsets.push(-offset,offset);
    return offsets.map(offset=>({x:p.x+(b.z-a.z)/edge.length*offset,z:p.z-(b.x-a.x)/edge.length*offset}));
  }).filter(p=>legal(p,3)).sort(closest);
  return firstAvailablePoint(dense,person,people,.7,1.1);
}
