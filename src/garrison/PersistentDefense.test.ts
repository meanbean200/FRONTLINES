import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from './Inventory';

const advance=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds/.05;i++)sim.step(.05);};
function fixture(){
  const sim=createStudyScenario(),state=sim.state,q=state.squads[0],g=state.living!.garrisons[0];g.nextSupport=1e9;
  advance(sim,40);
  const people=state.soldiers.filter(s=>s.squadId===q.id);
  return {sim,state,q,g,people};
}

describe('persistent trench assignments',()=>{
  it.each(['hold','observe','suppress'] as const)('%s changes intent without cancelling defense, personal duties or supplies',command=>{
    const {sim,state,q,g,people}=fixture(),before=structuredClone(people),target={x:q.x,z:q.z+100};
    // Explicit individual rest is part of the area assignment, not a competing order.
    expect(sim.garrisons.orderPerson(people[0].id,'rest').accepted).toBe(true);
    const duties=structuredClone(people.map(s=>s.duty));
    if(command==='hold')sim.issueHold([q.id]);else sim.issueTactical([q.id],command,target);
    expect(q.order.type).toBe('occupy-trench');expect(q.order.trenchId).toBe(g.trenchId);
    expect(q.order.intent).toBe(command==='hold'?undefined:command);
    expect(g.squadIds).toContain(q.id);expect(people.every(s=>s.garrisonId===g.id)).toBe(true);
    expect(people.map(s=>s.duty)).toEqual(duties);
    expect(people.map(s=>s.carried)).toEqual(before.map(s=>s.carried));
    const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    advance(sim,10);advance(copy,10);expect(copy.state).toEqual(state);
    expect(people.every(s=>s.garrisonId===g.id)).toBe(true);
  });
  it('retains membership through night duties, alarm recovery and a completed support connector',()=>{
    const {sim,state,g}=fixture(),members=state.soldiers.map(s=>[s.id,s.garrisonId]);
    const work=sim.garrisons.requestFacility(g.id,'rest',undefined,undefined,undefined,true);expect(work).toBeDefined();
    for(let i=0;i<12000&&state.living!.facilities.find(f=>f.id===work)!.progress<1;i++)sim.step(.05);
    expect(state.living!.facilities.find(f=>f.id===work)!.progress).toBe(1);
    state.living!.campaignHours=20;g.nextDecision=0;advance(sim,120);
    g.underFireUntil=state.elapsed+30;g.nextDecision=0;advance(sim,90);
    expect(g.underFireUntil).toBeUndefined();
    expect(state.soldiers.map(s=>[s.id,s.garrisonId])).toEqual(members);
    expect(state.squads.every(q=>q.order.type==='occupy-trench'&&g.squadIds.includes(q.id))).toBe(true);
    expect(state.soldiers.some(s=>s.needs!.sleepHours>0)).toBe(true);
    for(const n of Object.values(balance(state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  },15000);
  it('still releases defense when explicitly moving or entering a building',()=>{
    for(const command of ['move','building'] as const){
      const {sim,q,g,people}=fixture();
      if(command==='move')sim.issueMove([q.id],{x:q.x,z:q.z-20});else sim.issueBuilding([q.id],0);
      expect(g.squadIds).not.toContain(q.id);expect(people.every(s=>s.garrisonId===undefined&&s.duty===undefined)).toBe(true);
      if(command==='building')expect(q.order.building).toEqual({id:0,floor:0});
    }
  });
  it('does not cancel queued support works or assign an unrelated moving squad on a group Hold',()=>{
    const {sim,state,g}=fixture(),engineer=state.squads.find(q=>q.kind==='engineer')!,moving=state.squads[0];
    const work=sim.garrisons.requestFacility(g.id,'rest',undefined,undefined,undefined,true);expect(work).toBeDefined();
    const queue=structuredClone(engineer.constructionQueue);expect(queue?.length).toBeGreaterThan(0);
    sim.issueMove([moving.id],{x:moving.x,z:moving.z-20});
    sim.issueHold([moving.id,engineer.id]);
    expect(moving.order.type).toBe('hold');expect(g.squadIds).not.toContain(moving.id);
    expect(engineer.order.type).toBe('occupy-trench');expect(g.squadIds).toContain(engineer.id);
    expect(engineer.constructionQueue).toEqual(queue);
  });
  it('does not resume a superseded async move when Hold retains an area assignment',()=>{
    const {sim,q,g,people}=fixture(),callbacks:((path:{x:number;z:number}[])=>void)[]=[];
    sim.scheduleNavigation=(_a,_b,done)=>callbacks.push(done);
    sim.issueMove([q.id],{x:q.x,z:q.z-20});
    expect(sim.assignGarrison([q.id],g.trenchId)).toBe(true);
    sim.issueHold([q.id]);callbacks[0]([{x:q.x,z:q.z-20}]);
    expect(q.order.type).toBe('occupy-trench');expect(people.every(s=>s.garrisonId===g.id)).toBe(true);
    expect(q.route).toEqual([]);
  });
});
