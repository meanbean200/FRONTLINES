import {distance,distanceToSegment,type BattlefieldState,type Vec2,type TrenchState} from '../core/types';
import {atDistance} from '../core/Polyline';
import {excavatedSpan} from '../core/TrenchGeometry';
import type {Facility} from '../garrison/types';

export const WEAPON_POSITIONS={
  emplacement:{name:'MG position',crew:2,workers:2,category:'inline',radius:1.8},
  mortar:{name:'Mortar pit',crew:2,workers:2,category:'adjacent',radius:3},
} as const;
export const placementCategory=(kind:Facility['kind'])=>kind==='emplacement'?'inline':kind==='mortar'?'adjacent':'rear';
/** Exact saved-polyline anchor; never a screen coordinate or renderer-owned socket. */
export function trenchAnchorAt(t:TrenchState,p:Vec2){
  const span=excavatedSpan(t);let along=0,best:{trenchId:number;along:number;distance:number;point:Vec2;tangent:Vec2}|undefined;
  for(let i=1;i<t.points.length;i++){
    const a=t.points[i-1],b=t.points[i],length=distance(a,b);if(length<.001)continue;
    const hit=distanceToSegment(p,a,b),value=along+hit.t*length;
    if(value>=span.start-.001&&value<=span.end+.001&&(!best||hit.distance<best.distance))best={trenchId:t.id,along:value,distance:hit.distance,point:{x:a.x+(b.x-a.x)*hit.t,z:a.z+(b.z-a.z)*hit.t},tangent:{x:(b.x-a.x)/length,z:(b.z-a.z)/length}};
    along+=length;
  }return best;
}
export function inlineGeometry(t:TrenchState,along:number,facing:number){
  const center=atDistance(t.points,along),before=atDistance(t.points,Math.max(0,along-.2)),after=atDistance(t.points,along+.2),length=distance(before,after)||1;
  const tangent={x:(after.x-before.x)/length,z:(after.z-before.z)/length};
  const side=Math.sign(Math.sin(facing)*tangent.z-Math.cos(facing)*tangent.x)||1,normal={x:tangent.z*side,z:-tangent.x*side};
  return {center,tangent,normal,position:{x:center.x+normal.x*t.width*.43,z:center.z+normal.z*t.width*.43}};
}
export function weaponCrewPoint(state:BattlefieldState,f:Facility,index:number):Vec2{
  const t=state.trenches.find(t=>t.id===(f.trenchAnchor?.trenchId??f.connectorId));
  if(t&&f.trenchAnchor){const a=inlineGeometry(t,f.trenchAnchor.along,f.facing??0);return {x:a.center.x+a.normal.x*t.width*.395+a.tangent.x*(index?1.25:0),z:a.center.z+a.normal.z*t.width*.395+a.tangent.z*(index?1.25:0)};}
  const a=t?.points.at(-2),b=t?.points.at(-1),length=a&&b?distance(a,b)||1:1,dx=a&&b?(b.x-a.x)/length:0,dz=a&&b?(b.z-a.z)/length:1;
  return {x:f.x-dx*.8+dz*(index?-.7:.7),z:f.z-dz*.8-dx*(index?-.7:.7)};
}
export function facilityName(state:BattlefieldState,f:Facility):string{
  const names={emplacement:'MG position',mortar:'Mortar pit',aid:'Aid post',ammo:'Ammo store',store:'Supply store',rest:'Rest dugout',meal:'Meal bay'};
  const index=state.living!.facilities.filter(p=>p.kind===f.kind&&state.living!.garrisons.find(g=>g.id===p.garrisonId)?.faction!=='enemy').findIndex(p=>p.id===f.id)+1;
  return `${names[f.kind]} ${String(index).padStart(2,'0')}`;
}
