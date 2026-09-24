import {describe,expect,it,vi} from 'vitest';
import {BattlefieldSimulation} from './BattlefieldSimulation';
import {createPlayableSandbox} from './createBattlefield';
import {createOperation} from '../operations/createOperation';
import {SaveSystem} from '../persistence/SaveSystem';
import {balance} from '../garrison/Inventory';

const canonical=(sim:BattlefieldSimulation)=>({...structuredClone(sim.state),simSpeed:1});

describe('simulation speed preserves tick history',()=>{
  it.each([2,5])('keeps living duties, movement and inventories identical at %i×',speed=>{
    const start=createPlayableSandbox(),slow=new BattlefieldSimulation(structuredClone(start)),fast=new BattlefieldSimulation(structuredClone(start));
    for(const sim of [slow,fast])sim.assignGarrison(sim.state.squads.map(q=>q.id),sim.state.trenches[0].id);
    fast.setSpeed(speed);
    for(let i=0;i<400;i++){fast.step(.05);for(let j=0;j<speed;j++)slow.step(.05);}
    expect(canonical(fast)).toEqual(canonical(slow));
    for(const n of Object.values(balance(fast.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('preserves combat across speed changes and a save/load',()=>{
    const start=createOperation('defense',1945),slow=new BattlefieldSimulation(structuredClone(start));let fast=new BattlefieldSimulation(structuredClone(start));
    for(const speed of [5,2,1,5]){
      fast.setSpeed(speed);
      for(let i=0;i<400;i++){const before=fast.state.elapsed;fast.step(.05);const ticks=Math.round((fast.state.elapsed-before)/.05);for(let j=0;j<ticks;j++)slow.step(.05);}
      fast=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(fast.state)));
    }
    expect(canonical(fast)).toEqual(canonical(slow));
  },45000);
  it('does not run the rest of a fast batch after an emergency pause',()=>{
    const sim=new BattlefieldSimulation(createPlayableSandbox());sim.assignGarrison(sim.state.squads.map(q=>q.id),sim.state.trenches[0].id);
    const g=sim.state.living!.garrisons[0];g.nextDecision=1000;g.nextSupport=1000;
    sim.state.soldiers[0].needs!.thirst=100;sim.state.soldiers[0].needs!.thirstyHours=4;sim.setSpeed(5);
    sim.step(.05);expect(g.cutoff).toBe('decision');expect(sim.state.simSpeed).toBe(0);expect(sim.state.elapsed).toBe(.05);expect(sim.state.living!.emergencyResumeSpeed).toBe(5);
    const snapshot=structuredClone(sim.state);sim.step(.05);expect(sim.state).toEqual(snapshot);
  });
  it('does not run more ticks after an operation ends inside a fast batch',()=>{
    const sim=new BattlefieldSimulation(createOperation('defense'));sim.setSpeed(5);sim.state.operation!.duration=.05;
    const step=vi.spyOn(sim.operations,'step');sim.step(.05);
    expect(sim.state.operation!.status).not.toBe('active');expect(step).toHaveBeenCalledTimes(1);expect(sim.state.elapsed).toBe(.05);
  });
  it('ignores invalid or empty elapsed-time input',()=>{
    const sim=new BattlefieldSimulation(createPlayableSandbox()),snapshot=structuredClone(sim.state);
    for(const dt of [0,-.05,NaN,Infinity])sim.step(dt);
    expect(sim.state).toEqual(snapshot);
  });
});
