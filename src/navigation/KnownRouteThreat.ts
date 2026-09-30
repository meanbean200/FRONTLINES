import {distance,lerpVec,type BattlefieldState,type SoldierState,type Vec2} from '../core/types';
import {squadContacts} from '../operations/Visibility';
import type {TerrainSystem} from '../terrain/TerrainSystem';

/** A snapshot of THIS formation's delivered observations. No enemy-state lookup.
 * A contact marks a risky area, not a magically exact hostile exclusion body. */
export function knownRouteThreat(state:BattlefieldState,person:SoldierState,terrain?:TerrainSystem,urgentAmmo=false){
  const zones=new Map<string,Vec2&{incoming?:boolean}>();
  for(const c of squadContacts(state,person.squadId))if(c.active&&state.elapsed-c.lastSeen<20){
    const p={x:Math.round(c.x/8)*8,z:Math.round(c.z/8)*8};zones.set(`${p.x},${p.z}`,p);
  }
  // Nearby fire experienced by the same formation is local knowledge. Mark
  // the victim's area, never the hidden shooter's position or identity.
  for(const s of state.soldiers)if(s.squadId===person.squadId&&s.id!==person.id&&state.elapsed-(s.combat?.lastIncoming??-Infinity)<6&&s.suppression>=25&&distance(person,s)>24){
    const p={x:Math.round(s.x/8)*8,z:Math.round(s.z/8)*8,incoming:true};
    if(!zones.has(`${p.x},${p.z}`))zones.set(`${p.x},${p.z}`,p);
  }
  const points=[...zones.values()].sort((a,b)=>distance(person,a)-distance(person,b)).slice(0,24);
  const unsafe=(p:Vec2)=>points.some(c=>{
    const protectedGround=terrain?.coverAt(p.x,p.z)==='trench'||terrain?.buildingAt(p)!==undefined;
    const radius=c.incoming?(protectedGround?12:urgentAmmo?18:30):protectedGround?32:urgentAmmo?65:100;
    // Someone already inside a newly reported zone may leave it, not move
    // deeper into it. The minimum radius never permits crossing the contact.
    return distance(p,c)<Math.min(radius,Math.max(16,distance(person,c)-2));
  });
  const segment=(a:Vec2,b:Vec2)=>{const n=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=1;i<=n;i++)if(unsafe(lerpVec(a,b,i/n)))return true;return false;};
  return {active:points.length>0,unsafe,segment,route:(from:Vec2,path:Vec2[])=>path.some((p,i)=>segment(i?path[i-1]:from,p))};
}
