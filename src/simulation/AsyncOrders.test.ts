import { describe, expect, it } from 'vitest';
import { BattlefieldSimulation } from './BattlefieldSimulation';
import { createOperation } from '../operations/createOperation';
import { SaveSystem } from '../persistence/SaveSystem';
import type { Vec2 } from '../core/types';

function pendingMove(drawn=false) {
  const sim=new BattlefieldSimulation(createOperation('advance')),squad=sim.state.squads[0];
  const callbacks:((route:Vec2[])=>void)[]=[];
  sim.scheduleNavigation=(_a,_b,done)=>callbacks.push(done);
  const goal={x:squad.x-50,z:squad.z-50};
  if(drawn)expect(sim.issueDrawnPath([squad.id],[{x:squad.x,z:squad.z},goal])).toBe(true);
  else sim.issueMove([squad.id],goal);
  expect(squad.movementState).toBe('planning');
  return {sim,squad,callbacks,goal};
}

describe('asynchronous order boundaries',()=>{
  it.each([false,true])('freezes a finished operation before a late route response (drawn=%s)',drawn=>{
    const {sim,callbacks,goal}=pendingMove(drawn);
    sim.state.operation!.status='victory';sim.state.simSpeed=0;
    const frozen=structuredClone(sim.state);
    callbacks[0]([goal]);
    expect(sim.state).toEqual(frozen);
  });
  it.each([false,true])('restores a pending browser route into a headless simulation (drawn=%s)',drawn=>{
    const {sim,squad,goal}=pendingMove(drawn);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    for(let i=0;i<2400&&restored.state.squads[0].order.type==='move';i++)restored.step(.05);
    const result=restored.state.squads.find(s=>s.id===squad.id)!;
    expect(result.movementState).not.toBe('planning');
    expect(result.order.type).toBe('hold');
    expect(Math.hypot(result.x-goal.x,result.z-goal.z)).toBeLessThan(12);
  });
  it('ignores the old world response and accepts the restored pending order',()=>{
    const {sim,callbacks,goal}=pendingMove();
    const restored=new SaveSystem().parse(JSON.stringify(sim.state));sim.replaceState(restored);
    expect(callbacks).toHaveLength(2);
    callbacks[0]([goal]);expect(restored.squads[0].movementState).toBe('planning');
    callbacks[1]([goal]);expect(restored.squads[0].movementState).toBe('moving');
  });
  it.each([false,true])('invalidates callbacks even when replacing with the same state object (drawn=%s)',drawn=>{
    const {sim,squad,callbacks,goal}=pendingMove(drawn);
    sim.replaceState(sim.state);expect(callbacks).toHaveLength(2);
    callbacks[0]([goal]);expect(squad.movementState).toBe('planning');
    callbacks[1]([goal]);expect(squad.movementState).toBe('moving');
  });
  it('does not replan a frozen completed save',()=>{
    const {sim}=pendingMove();sim.state.operation!.status='victory';sim.state.simSpeed=0;
    const frozen=new SaveSystem().parse(JSON.stringify(sim.state)),expected=structuredClone(frozen);
    const restored=new BattlefieldSimulation(frozen);expect(restored.state).toEqual(expected);
    restored.replaceState(structuredClone(expected));expect(restored.state).toEqual(expected);
  });
});
