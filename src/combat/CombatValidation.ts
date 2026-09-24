import type {BattlefieldState} from '../core/types';
import {WEAPONS} from './Weapons';
import {RULES_VERSION} from '../garrison/GarrisonPolicy';
import {supportSourceMatchesSide,type SupportSource} from './SupportWeapons';

// Saved histories already support explicitly unknown/scripted provenance on
// either side. Preserve those tags, but still require a real, matching owner.
// This compatibility path is NOT used to authorize new commands.
const storedSupportSource=(side:'player'|'enemy',source:SupportSource)=>
  source==='LEGACY_UNKNOWN'||source==='SCRIPTED_SCENARIO'||supportSourceMatchesSide(side,source);
export function validCombatSystems(state:BattlefieldState):boolean {
  const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v),nonnegative=(v:unknown)=>finite(v)&&v>=0;
  const point=(v:unknown):boolean=>!!v&&typeof v==='object'&&finite((v as {x:number}).x)&&finite((v as {z:number}).z);
  const ids=new Set(state.soldiers.map(s=>s.id));
  if(state.combatRules===RULES_VERSION&&state.soldiers.some(s=>!s.equipment||!s.posture))return false;
  if(state.living?.facilities.some(f=>f.facing!==undefined&&!finite(f.facing)))return false;
  const patients=new Set<number>();
  for(const s of state.soldiers){
    const kit=s.equipment;
    if(kit&&(kit.version!==1||!Object.hasOwn(WEAPONS,kit.weapon)||![kit.tools,kit.mortar,kit.medicalKit].every(v=>typeof v==='boolean')||s.combat?.weapon&&s.combat.weapon.id!==kit.weapon))return false;
    const c=s.combat;if(!c)continue;
    if(c.nextCareReview!==undefined&&!nonnegative(c.nextCareReview))return false;
    const w=c.wound;
    if(w&&(!['legacy','minor','disabling','critical','fatal'].includes(w.severity)||!nonnegative(w.at)||w.at>state.elapsed+.001||typeof w.stabilized!=='boolean'||!['untreated','stabilized','aid-post','transport','evacuated'].includes(w.care)||w.bleedUntil!==undefined&&(!nonnegative(w.bleedUntil)||w.severity!=='critical'||w.stabilized)||w.returnAt!==undefined&&!nonnegative(w.returnAt)))return false;
    const t=c.careTask;
    if(t?.buildingExit!==undefined&&typeof t.buildingExit!=='boolean')return false;
    if(t){if(!ids.has(t.patientId)||t.patientId===s.id||patients.has(t.patientId)||!['approach','treat','carry','evacuate'].includes(t.stage)||!Array.isArray(t.route)||!t.route.every(point)||!Number.isInteger(t.index)||t.index<0||t.index>t.route.length||!point(t.destination)||![t.progress,t.blockedFor].every(nonnegative)||t.facilityId!==undefined&&!state.living?.facilities.some(f=>f.id===t.facilityId&&f.kind==='aid'))return false;patients.add(t.patientId);}
  }
  const passengers=new Set<number>();
  for(const truck of state.living?.trucks??[])if(truck.passengers!==undefined){if(!Array.isArray(truck.passengers)||truck.passengers.length>2)return false;for(const id of truck.passengers){if(!ids.has(id)||passengers.has(id)||patients.has(id))return false;passengers.add(id);}}
  const op=state.operation;if(!op)return true;
  if(op.forceModel!==undefined&&op.forceModel!=='infantry-equipment-v1')return false;
  for(const flag of [op.casualtyRules,op.supportRules])if(flag!==undefined&&typeof flag!=='boolean')return false;
  if(op.rescueDecisions!==undefined&&(!Array.isArray(op.rescueDecisions)||!op.rescueDecisions.every(d=>d&&ids.has(d.patientId)&&['player','enemy'].includes(d.side)&&['pending','hold','approved'].includes(d.choice)&&typeof d.reason==='string'&&nonnegative(d.reviewAt))))return false;
  if(op.supportMissions!==undefined){
    if(!Array.isArray(op.supportMissions)||op.supportMissions.length>64)return false;
    for(const m of op.supportMissions){
      if(!m||!Number.isInteger(m.id)||m.id<1||m.id>=state.nextEntityId||!state.squads.some(q=>q.id===m.squadId))return false;
      if(!['mortarHE','mortarSmoke','smokeGrenades'].includes(m.kind)||!['preparing','flight','complete','cancelled'].includes(m.stage))return false;
      if(m.source!==undefined&&!['PLAYER','ENEMY_AI','CAMPAIGN_AI','SCRIPTED_SCENARIO','LEGACY_UNKNOWN'].includes(m.source)||m.side!==undefined&&!['player','enemy'].includes(m.side)||m.ammoConsumed!==undefined&&![0,1].includes(m.ammoConsumed))return false;
      const side=state.squads.find(q=>q.id===m.squadId)!.faction??'player';
      if(m.side!==undefined&&m.side!==side||m.source!==undefined&&!storedSupportSource(side,m.source))return false;
      if(m.crewIds!==undefined&&(!Array.isArray(m.crewIds)||m.crewIds.length<1||m.crewIds.length>2||new Set(m.crewIds).size!==m.crewIds.length||!m.crewIds.every(id=>state.soldiers.some(s=>s.id===id&&s.squadId===m.squadId))))return false;
      if(![m.requestedAt,m.launchAt,m.impactAt,m.dangerRadius].every(nonnegative)||m.impactAt<m.launchAt||!point(m.target)||!point(m.impact)||typeof m.confirmedRisk!=='boolean'||typeof m.reason!=='string')return false;
    }
  }
  if(op.supportRequests!==undefined&&(!Array.isArray(op.supportRequests)||op.supportRequests.length>64||!op.supportRequests.every(r=>r&&nonnegative(r.at)&&Number.isInteger(r.squadId)&&['player','enemy'].includes(r.side)&&['PLAYER','ENEMY_AI','CAMPAIGN_AI','SCRIPTED_SCENARIO','LEGACY_UNKNOWN'].includes(r.source)&&['mortarHE','mortarSmoke','smokeGrenades'].includes(r.kind)&&point(r.target)&&typeof r.accepted==='boolean'&&typeof r.reason==='string')))return false;
  for(const request of op.supportRequests??[]){
    const q=state.squads.find(q=>q.id===request.squadId);
    if(!q||request.side!==(q.faction??'player')||!storedSupportSource(request.side,request.source))return false;
  }
  if(op.smokeFields!==undefined&&(!Array.isArray(op.smokeFields)||!op.smokeFields.every(s=>s&&point(s)&&Number.isInteger(s.id)&&[s.radius,s.until,s.born].every(nonnegative)&&s.until>=s.born)))return false;
  if(op.blastEvents!==undefined&&(!Array.isArray(op.blastEvents)||!op.blastEvents.every(b=>b&&point(b)&&[b.at,b.radius].every(nonnegative))))return false;
  return true;
}
