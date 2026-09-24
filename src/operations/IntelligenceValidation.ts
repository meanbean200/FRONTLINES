import type {BattlefieldState} from '../core/types';
import type {Contact,Faction} from './types';
export function validIntelligence(state:BattlefieldState):boolean {
  const intel=state.operation?.intelligence;if(intel===undefined)return true;
  const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
  const sideOf=(id:number)=>state.squads.find(q=>q.id===id)?.faction??'player';
  const contacts=(rows:Contact[],side:Faction)=>Array.isArray(rows)&&new Set(rows.map(c=>c?.soldierId)).size===rows.length&&rows.every(c=>c&&state.soldiers.some(s=>s.id===c.soldierId&&s.squadId===c.squadId)&&sideOf(c.squadId)!==side&&[c.x,c.z,c.lastSeen].every(finite)&&c.lastSeen>=0&&c.lastSeen<=state.elapsed+.001&&typeof c.visible==='boolean'&&typeof c.active==='boolean'&&(c.status===undefined||['confirmed','last-reported'].includes(c.status))&&(c.uncertainty===undefined||finite(c.uncertainty)&&c.uncertainty>=0));
  if(!intel||!Array.isArray(intel.squads)||!Array.isArray(intel.reports)||!Array.isArray(intel.sounds)||!intel.command||!contacts(intel.command.player,'player')||!contacts(intel.command.enemy,'enemy'))return false;
  if(new Set(intel.squads.map(r=>r?.squadId)).size!==intel.squads.length)return false;
  for(const row of intel.squads){
    if(!row||!state.squads.some(q=>q.id===row.squadId)||!['connected','isolated'].includes(row.link)||!finite(row.nextReport)||!contacts(row.contacts,sideOf(row.squadId))||!Array.isArray(row.exposure))return false;
    if(!row.exposure.every(e=>e&&finite(e.exposure)&&e.exposure>=0&&e.exposure<=1&&state.soldiers.some(s=>s.id===e.soldierId&&sideOf(s.squadId)!==sideOf(row.squadId))))return false;
  }
  for(const r of intel.reports)if(!r||!state.squads.some(q=>q.id===r.squadId)||r.side!==sideOf(r.squadId)||!finite(r.deliverAt)||r.deliverAt<0||!contacts(r.contacts,r.side))return false;
  return intel.sounds.every(s=>s&&['player','enemy'].includes(s.side)&&[s.x,s.z,s.radius,s.at].every(finite)&&s.radius>0&&s.at<=state.elapsed+.001&&s.status==='suspected');
}
