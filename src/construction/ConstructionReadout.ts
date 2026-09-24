import {distance,type BattlefieldState,type SquadState,type Vec2} from '../core/types';
import type {Facility,Garrison} from '../garrison/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import type {TrenchNetwork} from '../garrison/TrenchNetwork';

export const MIN_TRENCH_LENGTH=10;
export const SUPPORT_WORKS:Record<Facility['kind'],{name:string;cost:number;description:string}>={
  rest:{name:'Rest dugout',cost:12,description:'Sheltered rest · 8 places'},
  meal:{name:'Meal bay',cost:8,description:'Meals and water · 6 places'},
  store:{name:'Supply store',cost:10,description:'Stores delivered supplies'},
  ammo:{name:'Ammunition dugout',cost:14,description:'Stores delivered ammunition'},
  aid:{name:'Aid post',cost:18,description:'Treatment and evacuation · 4 places'},
  emplacement:{name:'Weapon emplacement',cost:16,description:'Prepared cover · bring your own crew'},
};
export function fitEngineers(state:BattlefieldState):SquadState[]{
  return state.squads.filter(q=>q.kind==='engineer'&&q.faction!=='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.health>0&&(!s.needs||s.needs.life==='active')));
}
export function chooseEngineer(state:BattlefieldState,selected:Set<number>):SquadState|undefined{
  const teams=fitEngineers(state);
  return teams.find(q=>selected.has(q.id))??teams.find(q=>q.order.type==='hold')??teams.find(q=>q.order.type==='occupy-trench')??teams[0];
}
/** The preview and construction command use precisely the same site checks. */
export function facilitySiteReason(state:BattlefieldState,g:Garrison,from:Vec2,to:Vec2,terrain:TerrainSystem,navigation:SquadNavigation,network:TrenchNetwork):string|undefined{
  if(!Number.isFinite(to.x)||!Number.isFinite(to.z))return 'Choose a point on the battlefield.';
  const length=distance(from,to);
  if(length<6)return 'Too close to the trench · move at least 6 m away.';
  if(length>40)return 'Too far from completed trench · maximum connector is 40 m.';
  if(state.living!.facilities.some(f=>distance(f,to)<8))return 'Another worksite is too close · leave 8 m clearance.';
  if(terrain.groundTypeAt(to.x,to.z)==='river')return 'Cannot build in water.';
  if(terrain.obstacleAt(to.x,to.z,6))return 'The structure overlaps a building or blocked ground.';
  if((network.nearest(from,network.component(g.trenchId))?.distance??Infinity)>=.3)return 'Connect to a completed part of this trench network.';
  if(!navigation.segmentClear(from,to,5))return 'The connecting trench crosses blocked ground.';
  if((to.x-from.x)*Math.sin(g.front)+(to.z-from.z)*Math.cos(g.front)>=0)return 'Build on the rear side of the line, opposite its facing.';
  return undefined;
}
export interface FacilityPreview {name:string;valid:boolean;reason:string;origin?:Vec2;position:Vec2;cost:number;materials:number}
