import type {BattlefieldState} from '../core/types';
import {buildingsForSeed} from './WorldFeatures';
import {buildingFloors,floorHeight} from './BuildingGeometry';
export function validBuildings(s:BattlefieldState):boolean {
  if(!s.buildingChanges&&!s.soldiers.some(p=>p?.building)&&!s.squads.some(q=>q?.order?.building))return true;
  const sites=buildingsForSeed(s.seed),id=(n:number)=>Number.isInteger(n)&&n>=0&&n<sites.length;
  const point=(p:{x:number;z:number})=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
  if(s.buildingChanges&&(!Array.isArray(s.buildingChanges)||new Set(s.buildingChanges.map(b=>b?.id)).size!==s.buildingChanges.length||!s.buildingChanges.every(b=>b&&id(b.id)&&['intact','damaged','ruined'].includes(b.condition)&&Number.isFinite(b.damage)&&b.damage>=0)))return false;
  for(const q of s.squads){const b=q.order?.building;if(b&&(!id(b.id)||![0,1].includes(b.floor)||b.floor>=buildingFloors(sites[b.id])))return false;}
  for(const p of s.soldiers){const b=p.building;if(!b)continue;
    if(b.recovering!==undefined&&typeof b.recovering!=='boolean')return false;
    if(b.routeReviewAt!==undefined&&(!Number.isFinite(b.routeReviewAt)||b.routeReviewAt<0||b.routeReviewAt>s.elapsed+3.001))return false;
    if(b.stairFrom!==undefined&&!point(b.stairFrom)||b.exitRequested!==undefined&&typeof b.exitRequested!=='boolean')return false;
    if(!id(b.id)||![0,1].includes(b.floor)||![0,1].includes(b.targetFloor)||b.floor>=buildingFloors(sites[b.id])||b.targetFloor>=buildingFloors(sites[b.id])||!Number.isFinite(b.vertical)||b.vertical<0||b.vertical>floorHeight(sites[b.id])||!['approach','inside','stairs','station','exit'].includes(b.stage)||!Array.isArray(b.route)||!b.route.every(point)||!Number.isInteger(b.index)||b.index<0||b.index>b.route.length||!Number.isFinite(b.stairTime)||b.stairTime<0||b.stairTime>8||!point(b.target))return false;
  }return true;
}
