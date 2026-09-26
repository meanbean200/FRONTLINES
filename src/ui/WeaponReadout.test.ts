import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {equipWeapon} from '../combat/Weapons';
import {crewWeaponReadout,actionableWeaponReason,supportPositionStatus} from './WeaponReadout';
import {selectionReadout} from './FieldReadout';
import {createPlayableSandbox} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {preparedPosition} from '../combat/testing/PositionFixture';

describe('honest crew weapon feedback',()=>{
  it('shows actual support activity without pretending a fired gun is available',()=>{
    const state=createOperation('campaign'),q=state.squads.find(q=>q.faction==='player')!;
    state.soldiers.find(s=>s.squadId===q.id)!.equipment!.mortar=true;
    const f=preparedPosition(state,q.id,'mortar'),helper=state.soldiers.find(s=>s.id===f.weaponCrewIds![1])!;
    expect(supportPositionStatus(state,f,'No indirect he ammunition')).toBe('No HE shells');
    helper.action='sleeping';expect(supportPositionStatus(state,f,'Need 2 ready crew within 12 m · regroup the team')).toContain('Crew resting');
    helper.needs!.life='incapacitated';expect(supportPositionStatus(state,f,'Need 2 ready crew within 12 m · regroup the team')).toContain('replacement needed');helper.needs!.life='active';
    helper.suppression=80;expect(supportPositionStatus(state,f,'Need 2 ready crew within 12 m · regroup the team')).toContain('heavy suppression');helper.suppression=0;
    state.operation!.supportMissions=[{id:999,squadId:q.id,positionId:f.id,kind:'mortarHE',target:{x:0,z:100},impact:{x:0,z:100},requestedAt:0,launchAt:10,impactAt:15,stage:'flight',reason:'Round in flight',dangerRadius:40,confirmedRisk:false,ammoConsumed:1}];state.elapsed=11;
    const before=JSON.stringify(state);expect(supportPositionStatus(state,f,'READY')).toBe('Round in flight · 4 s to impact');expect(JSON.stringify(state)).toBe(before);
  });
  it('distinguishes travel, setup, crew loss and ready observation without changing state',()=>{
    const state=createOperation('meeting'),q=state.squads.find(q=>q.faction!=='enemy'&&state.soldiers.some(s=>s.squadId===q.id&&s.equipment?.weapon==='crew-mg'))!;
    const crew=state.soldiers.filter(s=>s.squadId===q.id).sort((a,b)=>Number(b.equipment?.weapon==='crew-mg')-Number(a.equipment?.weapon==='crew-mg'));crew.forEach((s,i)=>{s.x=i;s.z=0;});q.x=1;q.z=0;
    preparedPosition(state,q.id,'emplacement');const w=equipWeapon(state,crew[0]);state.elapsed=1;expect(crewWeaponReadout(state,q)).toContain('Setting up · 4 s');
    q.order.type='move';expect(crewWeaponReadout(state,q)).toContain('Travelling');q.order.type='hold';state.elapsed=6;
    expect(crewWeaponReadout(state,q)).toContain('Set · watching sector');
    for(const s of crew.slice(1))s.x=100;
    expect(crewWeaponReadout(state,q)).toContain('MOVING TO POSITION');crew[1].x=1;w.reloadUntil=9;
    expect(crewWeaponReadout(state,q)).toContain('Reloading · 3 s');crew[0].needs!.life='incapacitated';expect(crewWeaponReadout(state,q)).toBe('NO ASSISTANT');
    const before=JSON.stringify(state);crewWeaponReadout(state,q);expect(JSON.stringify(state)).toBe(before);
  });
  it('keeps routine weapon activity out of critical battlefield alerts',()=>{
    expect(actionableWeaponReason(['Setting up BAR','Reloading M1 rifle','Preparing support mission','Holding ammunition · aimed hit implausible'])).toBeUndefined();
    expect(actionableWeaponReason(['Setting up BAR','Weapon crew unavailable'])).toBe('Weapon crew unavailable');
    expect(actionableWeaponReason(['Pinned by incoming fire'])).toContain('Pinned');
  });
  it('does not warn peaceful sandbox rifle squads about combat ammunition',()=>{
    const sim=new BattlefieldSimulation(createPlayableSandbox());expect(selectionReadout(sim.state,new Set([sim.state.squads[0].id]))!.warning).not.toBe('LOW AMMO');
  });
});
