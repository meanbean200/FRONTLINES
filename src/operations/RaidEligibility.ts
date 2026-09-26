import type {BattlefieldState} from '../core/types';
/** Formation orders cannot split a squad. Retain a mixed formation at home
 * rather than silently pulling its assigned gun crew away with the rifles. */
export function raidEligibility(state:BattlefieldState,ids:readonly number[],includeWeaponCrews=false){
  const assigned=new Set(state.living?.facilities.flatMap(f=>f.weaponCrewIds??[])??[]);
  const formations=state.squads.filter(q=>q.faction!=='enemy'&&ids.includes(q.id));
  const protectedIds=formations.filter(q=>state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active'&&assigned.has(s.id))).map(q=>q.id);
  const eligible=formations.filter(q=>(includeWeaponCrews||!protectedIds.includes(q.id))&&state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active')).map(q=>q.id);
  const people=state.soldiers.filter(s=>eligible.includes(s.squadId)&&s.needs?.life==='active').length;
  return {eligible,protectedIds,people};
}
