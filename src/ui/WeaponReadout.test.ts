import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {equipWeapon} from '../combat/Weapons';
import {crewWeaponReadout,actionableWeaponReason} from './WeaponReadout';
import {selectionReadout} from './FieldReadout';
import {createPlayableSandbox} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {preparedPosition} from '../combat/testing/PositionFixture';

describe('honest crew weapon feedback',()=>{
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
