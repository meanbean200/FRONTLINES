import { describe, expect, it } from 'vitest';
import { createStudyScenario } from '../garrison/StudyScenario';
import { transfer } from '../garrison/Inventory';
import { garrisonSupplyReadout, relocationProgress, withdrawalProgress, trenchPresence } from './GarrisonReadout';

describe('garrison supply presentation',()=>{
  it('counts sheltered engineers without an assignment, but not incoming, dead or hidden enemy personnel',()=>{
    const sim=createStudyScenario(),state=sim.state,g=state.living!.garrisons[0];
    const network=sim.garrisons.network;network.sync(state.trenches);
    const component=network.component(g.trenchId)!,p=network.samples(component,8)[3];
    const people=state.soldiers.slice(0,4);state.soldiers=people;
    people.forEach(s=>{s.x=p.x;s.z=p.z;s.cover='trench';delete s.garrisonId;delete s.trenchId;});
    state.squads.find(q=>q.id===people[0].squadId)!.kind='engineer';
    people[1].cover='open';people[1].garrisonId=g.id;people[1].x+=100;
    people[2].needs!.life='dead';people[3].needs!.life='incapacitated';
    const before=structuredClone(state);expect(trenchPresence(state,network).get(component)).toBe(2);expect(state).toEqual(before);
    state.squads.find(q=>q.id===people[0].squadId)!.faction='enemy';
    expect(trenchPresence(state,network).size).toBe(0);
  });
  it('distinguishes withdrawal stocks from empty trench stores without changing inventory',()=>{
    const {state}=createStudyScenario(),g=state.living!.garrisons[0];
    transfer(g.cache,g.forwardStock,'food',g.cache.food);transfer(g.cache,g.forwardStock,'water',g.cache.water);
    g.cutoff='withdraw';g.supplyIssue='Local food or water exhausted';const before=structuredClone(state);
    const view=garrisonSupplyReadout(state,g);expect(view.stock.food).toBe(g.forwardStock.food);expect(view.label).toBe('Withdrawal point');expect(view.issue).toBeUndefined();expect(view.endurance).toBeGreaterThan(0);expect(state).toEqual(before);
    g.cutoff='clear';expect(garrisonSupplyReadout(state,g).stock.food).toBe(0);expect(garrisonSupplyReadout(state,g).issue).toBe(g.supplyIssue);
  });
  it('keeps real food shortages local without turning missing water into a crisis',()=>{
    const {state}=createStudyScenario(),g=state.living!.garrisons[0];g.cutoff='withdraw';
    expect(garrisonSupplyReadout(state,g).issue).toContain('exhausted');
    transfer(g.cache,g.forwardStock,'food',10);state.soldiers[0].needs!.hunger=90;
    expect(garrisonSupplyReadout(state,g).issue).toContain('personnel still need access');
    state.soldiers[0].needs!.hunger=0;expect(garrisonSupplyReadout(state,g).issue).toBeUndefined();expect(garrisonSupplyReadout(state,g).endurance).toBeGreaterThan(0);
  });
  it('counts physical completed arrivals, not assignments or dead soldiers',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];sim.garrisons.resolveEmergency(g.id,'withdraw');
    const people=sim.state.soldiers;expect(withdrawalProgress(g,people)).toBe('Withdrawal · 0/24 at supply point');
    people[0].x=g.forward.x;people[0].z=g.forward.z;people[0].duty!.arrivedAt=0;
    people[1].x=g.forward.x;people[1].z=g.forward.z;people[2].needs!.life='dead';
    expect(withdrawalProgress(g,people)).toBe('Withdrawal · 1/23 at supply point');
  });
  it('shows relocation until the last active traveller arrives without counting casualties',()=>{
    const sim=createStudyScenario(),g=sim.state.living!.garrisons[0];sim.garrisons.resolveEmergency(g.id,'withdraw');
    const people=sim.state.soldiers;people[0].duty!.relocationExit={x:0,z:0};people[1].duty!.relocationExit={x:0,z:0};people[1].needs!.life='incapacitated';
    const before=structuredClone(people);expect(relocationProgress(people)).toBe('Relocating · 1/23 still en route');expect(people).toEqual(before);
    delete people[0].duty!.relocationExit;expect(relocationProgress(people)).toBeUndefined();
  });
});
