import {distance,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import type {TerrainSystem} from '../terrain/TerrainSystem';
import type {SquadNavigation} from '../navigation/SquadNavigation';
import {insideWorld} from '../terrain/WorldLayout';
import {squadContacts} from '../operations/Visibility';

/** Gameplay limits for automatic care, not historical/medical survival claims. */
export const RESCUE_LIMITS=Object.freeze({buddyApproach:30,medicApproach:120,carry:120,pickup:60,review:3,legTimeout:240});
export const treatmentSeconds=(medic:boolean)=>medic?8:14;
export function careRouteLength(from:Vec2,route:readonly Vec2[],index=0):number {
  let total=0,previous=from;
  for(const point of route.slice(index)){if(!insideWorld(point))return Infinity;total+=distance(previous,point);previous=point;}
  return total;
}
export function rescueExposed(state:BattlefieldState,terrain:TerrainSystem,helper:SoldierState,route:readonly Vec2[]):boolean {
  if(helper.suppression>25)return true;
  const contacts=squadContacts(state,helper.squadId).filter(c=>c.active&&state.elapsed-c.lastSeen<12);
  if(!contacts.length)return false;
  // Test the actual route, using local reports only. No hidden live coordinates.
  const samples:Vec2[]=[helper];let previous:Vec2=helper;
  for(const point of route){const steps=Math.max(1,Math.ceil(distance(previous,point)/10));for(let i=1;i<=steps;i++)samples.push({x:previous.x+(point.x-previous.x)*i/steps,z:previous.z+(point.z-previous.z)*i/steps});previous=point;}
  return samples.some(p=>contacts.some(c=>distance(c,p)<100&&terrain.objects.trace(c,p,terrain.heightAt(c.x,c.z)+1.6,terrain.heightAt(p.x,p.z)+.4,false).clear));
}
export function nearbyAidPost(state:BattlefieldState,navigation:SquadNavigation,patient:SoldierState,from:Vec2,side:'player'|'enemy'){
  const w=state.living!,posts=w.facilities.filter(f=>f.kind==='aid'&&f.progress===1&&distance(from,f)<=RESCUE_LIMITS.carry&&w.garrisons.some(g=>g.id===f.garrisonId&&(g.faction??'player')===side));
  const choices=[];
  for(const post of posts){
    const occupants=new Set(state.soldiers.filter(s=>s.id!==patient.id&&s.needs?.life!=='dead'&&s.combat?.wound?.care==='aid-post'&&distance(s,post)<4).map(s=>s.id));
    for(const s of state.soldiers)if(s.combat?.careTask?.facilityId===post.id&&s.combat.careTask.patientId!==patient.id)occupants.add(s.combat.careTask.patientId);
    if(occupants.size>=post.capacity)continue;
    const route=navigation.plan(from,post),length=careRouteLength(from,route);
    if(route.length&&length<=RESCUE_LIMITS.carry&&distance(route.at(-1)!,post)<4)choices.push({post,route,length});
  }
  return choices.sort((a,b)=>a.length-b.length||a.post.id-b.post.id)[0];
}
