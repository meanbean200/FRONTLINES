import {distance,type BattlefieldState,type Vec2,type TrenchState} from '../core/types';
import {atDistance} from '../core/Polyline';
import {excavatedSpan} from '../core/TrenchGeometry';
import {visibilitySignal} from './Visibility';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import {TrenchNetwork} from '../garrison/TrenchNetwork';

export interface ObservedTrench {id:number;sourceId:number;cell:number;points:[Vec2,Vec2];width:number;at:number;side:'player'|'enemy'}
export interface TerrainKnowledge {nextReview:number;sections:ObservedTrench[]}
const graphs=new WeakMap<BattlefieldState,TrenchNetwork>();
/** Own construction and controlled networks are known; enemy geometry is not returned. */
export function ownedTrenchIds(state:BattlefieldState,side:'player'|'enemy',graph?:TrenchNetwork):Set<number>{
  let network=graph??graphs.get(state);if(!network){network=new TrenchNetwork();graphs.set(state,network);}network.sync(state.trenches);
  const controlled=new Set(state.living?.garrisons.filter(g=>(g.faction??'player')===side).map(g=>network!.component(g.trenchId)).filter(c=>c!==undefined));
  const hostile=new Set(state.living?.garrisons.filter(g=>(g.faction??'player')!==side).map(g=>network!.component(g.trenchId)).filter(c=>c!==undefined));
  const builders=new Set(state.squads.filter(q=>(q.faction??'player')===side).map(q=>q.id));
  return new Set(state.trenches.filter(t=>{const c=network!.component(t.id);return c!==undefined&&controlled.has(c)||!(c!==undefined&&hostile.has(c))&&t.engineerSquadId!==undefined&&builders.has(t.engineerSquadId);}).map(t=>t.id));
}
/** Terrain memory contains only observed four-metre sections, never live occupants or stocks. */
export function observeTrenches(state:BattlefieldState,terrain:TerrainSystem,network?:TrenchNetwork):void {
  if(!state.operation)return;
  const memory=state.terrainKnowledge??={nextReview:0,sections:[]};
  if(state.elapsed<memory.nextReview)return;memory.nextReview=(Math.floor(state.elapsed)+1);
  const sides=new Map(state.squads.map(q=>[q.id,q.faction??'player']));
  const observers=state.soldiers.filter(s=>s.needs?.life==='active'&&s.action!=='sleeping');
  const existing=new Map(memory.sections.map(s=>[`${s.side}:${s.sourceId}:${s.cell}`,s]));
  const owned={player:ownedTrenchIds(state,'player',network),enemy:ownedTrenchIds(state,'enemy',network)};
  for(const t of state.trenches){
    const span=excavatedSpan(t);if(span.end-span.start<1)continue;
    for(let cell=Math.floor(span.start/4);cell<Math.ceil(span.end/4);cell++){
      const a=atDistance(t.points,Math.max(span.start,cell*4)),b=atDistance(t.points,Math.min(span.end,(cell+1)*4));if(distance(a,b)<.3)continue;
      const mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
      for(const side of ['player','enemy'] as const){
        if(owned[side].has(t.id))continue;
        // This is the same environmental sight model as soldiers, not a distance reveal.
        const seen=observers.some(s=>sides.get(s.squadId)===side&&distance(s,mid)<500&&[a,mid,b].every(p=>visibilitySignal(state,terrain,s,p)>=.24));
        if(!seen)continue;
        const key=`${side}:${t.id}:${cell}`,old=existing.get(key);
        if(old){old.points=[a,b];old.at=state.elapsed;old.width=t.width;}
        else {const section:ObservedTrench={id:state.nextEntityId++,sourceId:t.id,cell,points:[a,b],width:t.width,at:state.elapsed,side};memory.sections.push(section);existing.set(key,section);}
      }
    }
  }
}
export interface KnownTrenchNetwork {id:number;name:string;sections:ObservedTrench[];point:Vec2;length:number}
const cache=new WeakMap<TerrainKnowledge,{key:string;rows:KnownTrenchNetwork[]}>();
export function knownTrenchNetworks(state:BattlefieldState,side:'player'|'enemy'='player'):KnownTrenchNetwork[]{
  const memory=state.terrainKnowledge;if(!memory)return [];
  const friendlyIds=ownedTrenchIds(state,side);
  const key=side+':'+memory.nextReview+':'+[...friendlyIds].join(',');const saved=cache.get(memory);if(saved?.key===key)return saved.rows;
  const known=memory.sections.filter(s=>s.side===side&&!friendlyIds.has(s.sourceId));
  const graph=new TrenchNetwork();graph.sync(known.map(s=>({id:s.id,points:s.points,width:s.width,depth:1,progress:1,status:'complete'}) as TrenchState));
  // Separate glimpses of the same physical section retain one identity, but only
  // their recorded geometry is drawn. Never bridge gaps with hidden live points.
  const parent=new Map<number,number>(),sources=new Map<number,number>();
  const root=(n:number):number=>{const p=parent.get(n);if(p===undefined||p===n)return n;const r=root(p);parent.set(n,r);return r;};
  for(const s of known){const c=graph.component(s.id)??s.id,other=sources.get(s.sourceId);if(other!==undefined)parent.set(root(c),root(other));sources.set(s.sourceId,c);}
  const groups=new Map<number,ObservedTrench[]>();for(const s of known){const c=root(graph.component(s.id)??s.id),list=groups.get(c)??[];list.push(s);groups.set(c,list);}
  const rows=[...groups.values()].map(sections=>{const first=[...sections].sort((a,b)=>a.id-b.id)[0],id=Math.min(...sections.map(s=>s.sourceId));return {id,name:`Enemy network ${id}`,sections,point:{x:(first.points[0].x+first.points[1].x)/2,z:(first.points[0].z+first.points[1].z)/2},length:sections.reduce((n,s)=>n+distance(...s.points),0)};});
  cache.set(memory,{key,rows});return rows;
}
export function validTerrainKnowledge(state:BattlefieldState):boolean {
  const k=state.terrainKnowledge;if(!k)return true;
  if(!Number.isFinite(k.nextReview)||k.nextReview<0||!Array.isArray(k.sections)||k.sections.length>50000)return false;
  const ids=new Set<number>(),cells=new Set<string>();
  return k.sections.every(s=>{if(!s||typeof s!=='object')return false;const key=`${s.side}:${s.sourceId}:${s.cell}`;if(ids.has(s.id)||cells.has(key))return false;ids.add(s.id);cells.add(key);return Number.isInteger(s.id)&&s.id>0&&Number.isInteger(s.sourceId)&&s.sourceId>0&&Number.isInteger(s.cell)&&s.cell>=0&&['player','enemy'].includes(s.side)&&Number.isFinite(s.at)&&s.at>=0&&s.at<=state.elapsed+.001&&Number.isFinite(s.width)&&s.width>0&&s.width<=20&&Array.isArray(s.points)&&s.points.length===2&&s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=2000&&Math.abs(p.z)<=2000)&&distance(...s.points)<=4.01;});
}
