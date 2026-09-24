import { describe, expect, it } from 'vitest';
import { createRecoveryScenario } from './RecoveryScenario';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { balance } from './Inventory';
import { createOperation } from '../operations/createOperation';

describe('revising an acknowledged supply emergency',()=>{
  it.each([0,1,2,5])('preserves speed %s through review and a revised decision',speed=>{
    const {sim,g}=createRecoveryScenario();sim.garrisons.resolveEmergency(g.id,'recover');sim.setSpeed(speed);
    const at=sim.state.elapsed;expect(sim.garrisons.reopenEmergency(g.id)).toBe(true);
    expect(sim.state.simSpeed).toBe(0);expect(sim.state.living!.emergencyResumeSpeed).toBe(speed);
    expect(sim.garrisons.reopenEmergency(g.id)).toBe(false);sim.step(.05);expect(sim.state.elapsed).toBe(at);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    restored.garrisons.resolveEmergency(g.id,'hold');expect(restored.state.simSpeed).toBe(speed);
  });
  it('does not overwrite the first resume speed when adding another network for review',()=>{
    const {sim,g}=createRecoveryScenario(),w=sim.state.living!;
    const other={...structuredClone(g),id:sim.state.nextEntityId++,name:'Other network',squadIds:[],cutoff:'hold' as const};w.garrisons.push(other);
    sim.garrisons.resolveEmergency(g.id,'hold');sim.setSpeed(5);
    expect(sim.garrisons.reopenEmergency(g.id)).toBe(true);expect(sim.garrisons.reopenEmergency(other.id)).toBe(true);
    expect(w.emergencyResumeSpeed).toBe(5);
    sim.garrisons.resolveEmergency(g.id,'recover');expect(sim.state.simSpeed).toBe(0);
    sim.garrisons.resolveEmergency(other.id,'hold');expect(sim.state.simSpeed).toBe(5);
  });
  it('preserves an outbound carrier and inventory while reviewing, then physically orders withdrawal',()=>{
    const {sim,g}=createRecoveryScenario();sim.garrisons.resolveEmergency(g.id,'recover');sim.step(.05);
    const person=sim.state.soldiers.find(s=>s.duty?.crateId)!;const before=structuredClone(person);
    sim.garrisons.reopenEmergency(g.id);sim.step(.05);expect(person).toEqual(before);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    expect(person.duty?.reason).toBe('Player-authorized withdrawal to supply apron');
    expect({x:person.x,z:person.z}).toEqual({x:before.x,z:before.z});
    expect(person.carried).toEqual(before.carried);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('does not change speed for a non-pending response or restart a completed operation',()=>{
    const {sim,g}=createRecoveryScenario();sim.garrisons.resolveEmergency(g.id,'hold');sim.setSpeed(0);
    sim.garrisons.resolveEmergency(g.id,'recover');expect(sim.state.simSpeed).toBe(0);
    sim.state.operation=createOperation('advance').operation!;sim.state.operation.status='victory';
    const frozen=structuredClone(sim.state);
    expect(sim.garrisons.reopenEmergency(g.id)).toBe(false);sim.garrisons.resolveEmergency(g.id,'withdraw');expect(sim.state).toEqual(frozen);
  });
  it('does not reopen an inactive warning, cleared incident, or completed withdrawal',()=>{
    const {sim,g}=createRecoveryScenario();
    for(const cutoff of ['clear','warning','withdraw'] as const){g.cutoff=cutoff;const before=structuredClone(sim.state);expect(sim.garrisons.reopenEmergency(g.id)).toBe(false);expect(sim.state).toEqual(before);}
  });
});
