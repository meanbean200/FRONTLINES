import type {BattlefieldState} from '../core/types';
import {previewAssault} from './AssaultPlan';
/** Compatibility readout; eligibility is now individual, not a whole-squad veto. */
export function raidEligibility(state:BattlefieldState,ids:readonly number[],includeWeaponCrews=false){
  const assigned=new Set(state.living?.facilities.flatMap(f=>f.weaponCrewIds??[])??[]);
  const formations=state.squads.filter(q=>q.faction!=='enemy'&&ids.includes(q.id));
  const protectedIds=formations.filter(q=>state.soldiers.some(s=>s.squadId===q.id&&s.needs?.life==='active'&&assigned.has(s.id))).map(q=>q.id);
  const preview=previewAssault(state,ids,includeWeaponCrews?'all-in':'normal');
  const eligible=formations.filter(q=>q.soldierIds.some(id=>preview.participantIds.includes(id))).map(q=>q.id);
  return {eligible,protectedIds,people:preview.participantIds.length,preview};
}
