import type {BattlefieldState,Vec2} from '../core/types';
import {SIGHT_RULES} from '../operations/SightRules';

export interface ContactGroup extends Vec2 {
  id:number; visible:boolean; lastSeen:number; members:number[];heard?:boolean;
}

/** Presentation only. Nearby observed positions share a generic contact symbol;
 * never consult hidden soldier positions, health, squad names or equipment.
 * Anchor to one remembered observation rather than averaging the changing set
 * of visible soldiers. Losing one member must not make the entire marker jump.
 */
export function contactGroups(state:BattlefieldState):ContactGroup[]{
  const contacts=(state.operation?.contacts?.player??[])
    .filter(c=>c.active&&state.elapsed-c.lastSeen<=SIGHT_RULES.memorySeconds)
    .slice().sort((a,b)=>a.soldierId-b.soldierId);
  const groups:ContactGroup[]=[];
  for(const c of contacts){
    const near=groups.find(g=>Math.hypot(g.x-c.x,g.z-c.z)<=45);
    if(near){near.members.push(c.soldierId);near.visible||=c.visible;near.lastSeen=Math.max(near.lastSeen,c.lastSeen);}
    else groups.push({id:c.soldierId,x:c.x,z:c.z,visible:c.visible,lastSeen:c.lastSeen,members:[c.soldierId]});
  }
  return groups;
}

export const contactDescription=(visible:boolean)=>visible
  ?'Enemy contact area\nTroops observed here · nearby sightings grouped'
  :'Last-known enemy area\nSight lost · not live tracking';

/** Approximate reports contain no soldier identity and never imply visual confirmation. */
export function reportAnnotations(state:BattlefieldState):ContactGroup[]{
  const groups=contactGroups(state);
  for(const sound of state.operation?.intelligence?.sounds??[]){
    if(sound.side!=='player'||state.elapsed-sound.at>15||groups.some(g=>Math.hypot(g.x-sound.x,g.z-sound.z)<60))continue;
    const x=Math.round(sound.x/60)*60,z=Math.round(sound.z/60)*60;
    groups.push({id:-1-(Math.round(x/60)+100)*201-Math.round(z/60)-100,x,z,visible:false,lastSeen:sound.at,members:[],heard:true});
  }return groups;
}
