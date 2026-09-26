import { describe, expect, it } from 'vitest';
import { createStudyScenario } from './StudyScenario';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { balance } from './Inventory';

function simultaneousLegacyDecisions() {
  const sim=createStudyScenario(),state=sim.state,w=state.living!,first=w.garrisons[0];
  const squad=state.squads.at(-1)!,id=state.nextEntityId++;
  const entrance={x:first.entrance.x,z:first.entrance.z-100};
  state.trenches.push({id,points:[entrance,{x:entrance.x+140,z:entrance.z}],width:4.2,depth:1.75,progress:1,status:'complete'});
  state.soldiers.filter(s=>s.squadId===squad.id).forEach((s,i)=>{s.x=entrance.x+5+i*2;s.z=entrance.z;});
  expect(sim.assignGarrison([squad.id],id)).toBe(true);
  for(const g of w.garrisons){
    g.nextDecision=1000;g.nextSupport=1000;
    // Retained explicit legacy decisions, not newly generated thirst emergencies.
    g.cutoff='decision';
  }
  state.simSpeed=5;
  w.emergencyResumeSpeed=5; // Same persisted resume choice as a pre-existing decision save.
  sim.step(.05);
  expect(w.garrisons.every(g=>g.cutoff==='decision')).toBe(true);
  return sim;
}

describe('legacy explicit decision authority pause',()=>{
  it('preserves the original speed across simultaneous emergencies and save/load',()=>{
    const sim=simultaneousLegacyDecisions(),state=sim.state,w=state.living!;
    expect(state.simSpeed).toBe(0);
    expect(w.emergencyResumeSpeed).toBe(5);
    sim.garrisons.resolveEmergency(w.garrisons[0].id,'hold');
    expect(state.simSpeed).toBe(0);
    const resumed=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    resumed.garrisons.resolveEmergency(w.garrisons[1].id,'hold');
    expect(resumed.state.simSpeed).toBe(5);
    const at=resumed.state.elapsed;resumed.step(.05);expect(resumed.state.elapsed).toBeCloseTo(at+.25);
    for(const n of Object.values(balance(resumed.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('does not allow a speed change to bypass unresolved player decisions',()=>{
    const sim=simultaneousLegacyDecisions(),at=sim.state.elapsed,people=structuredClone(sim.state.soldiers);
    sim.setSpeed(5);expect(sim.state.simSpeed).toBe(0);
    sim.state.simSpeed=5;
    sim.step(.05);
    expect(sim.state.elapsed).toBe(at);
    expect(sim.state.simSpeed).toBe(0);
    expect(sim.state.soldiers).toEqual(people);
    expect(sim.state.living!.emergencyResumeSpeed).toBe(5);
  });
  it('accepts only supported speeds after the decision is resolved',()=>{
    const sim=simultaneousLegacyDecisions();
    for(const g of sim.state.living!.garrisons)sim.garrisons.resolveEmergency(g.id,'hold');
    sim.setSpeed(2);expect(sim.state.simSpeed).toBe(2);
    sim.setSpeed(100);expect(sim.state.simSpeed).toBe(2);
    sim.setSpeed(NaN);expect(sim.state.simSpeed).toBe(2);
    sim.setSpeed(0);expect(sim.state.simSpeed).toBe(0);
  });
});
