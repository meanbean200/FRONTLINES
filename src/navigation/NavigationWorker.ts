import type {BattlefieldState,Vec2} from '../core/types';
import {TerrainSystem} from '../terrain/TerrainSystem';
import {SquadNavigation} from './SquadNavigation';

export interface RouteRequest {id:number;start:Vec2;goal:Vec2;world:Pick<BattlefieldState,'seed'|'trenches'|'craters'|'buildingChanges'>}
export interface RouteResponse {id:number;route:Vec2[]}
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<RouteRequest>)=>void)|null;postMessage:(response:RouteResponse)=>void};
scope.onmessage=event=>{
  const request=event.data;
  const state:BattlefieldState={schemaVersion:1,...request.world,soldiers:[],squads:[],elapsed:0,simSpeed:0,nextEntityId:1};
  const navigation=new SquadNavigation(new TerrainSystem(state));
  try{scope.postMessage({id:request.id,route:navigation.plan(request.start,request.goal)});}
  catch{scope.postMessage({id:request.id,route:[]});}
};
