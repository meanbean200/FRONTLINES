import {describe,expect,it} from 'vitest';
import {createPlayableSandbox} from '../simulation/createBattlefield';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {SaveSystem} from '../persistence/SaveSystem';
import {distance} from '../core/types';

function setup(progress=1){
  const state=createPlayableSandbox(),squad=state.squads[0];
  const trench={id:state.nextEntityId++,points:[{x:-1900,z:-1800},{x:-1600,z:-1800}],width:4.2,depth:1.75,progress,status:progress===1?'complete' as const:'building' as const};
  state.trenches=[trench];
  const people=state.soldiers.filter(s=>s.squadId===squad.id);
  people.forEach((s,i)=>{s.x=-1640+i*2;s.z=-1780;});squad.x=-1630;squad.z=-1780;
  const sim=new BattlefieldSimulation(state);return {state,sim,squad,trench,people};
}
describe('nearest usable trench entry',()=>{
  it('crosses the lip of a wide trench without a dead zone at the three-metre entry radius',()=>{
    const {state,squad,trench,people}=setup();trench.width=7.2;const sim=new BattlefieldSimulation(state);expect(sim.assignGarrison([squad.id],trench.id)).toBe(true);sim.step(.05);state.living!.garrisons[0].nextSupport=10000;
    for(let i=0;i<1200;i++)sim.step(.05);
    expect(people.every(s=>sim.garrisons.network.corridorContains(s))).toBe(true);expect(people.every(s=>!s.duty?.entryPending)).toBe(true);
  });
  it('enters beside the squad without walking to the remote supply entrance',()=>{
    const {state,sim,squad,trench,people}=setup();expect(sim.assignGarrison([squad.id],trench.id)).toBe(true);
    sim.step(.05);const g=state.living!.garrisons[0];g.nextSupport=10000;
    for(const s of people){expect(s.duty?.entryPoint?.x).toBeGreaterThan(-1700);expect(distance(s,s.duty!.entryPoint!)).toBeLessThan(23);}
    for(let i=0;i<1000;i++)sim.step(.05);
    expect(people.filter(s=>sim.garrisons.network.corridorContains(s)).length).toBe(people.length);
    expect(people.every(s=>s.x>-1710)).toBe(true);
  });
  it('never chooses unfinished excavation as an entry',()=>{
    const {sim,squad,trench,people}=setup(.5);expect(sim.assignGarrison([squad.id],trench.id)).toBe(true);sim.step(.05);
    for(const s of people)expect(s.duty!.entryPoint!.x).toBeLessThanOrEqual(-1750);
  });
  it('continues a saved personal approach exactly, preserving the supply entrance',()=>{
    const {state,sim,squad,trench,people}=setup();sim.assignGarrison([squad.id],trench.id);sim.step(.05);
    const g=state.living!.garrisons[0];g.nextSupport=10000;const entrance={...g.entrance};
    expect(people[0].duty!.entryPending).toBe(true);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(state)));
    for(let i=0;i<400;i++){sim.step(.05);restored.step(.05);}
    expect(restored.state).toEqual(state);expect(g.entrance).toEqual(entrance);
  });
  it('rejects an invalid saved entry point',()=>{
    const {state,sim,squad,trench,people}=setup();sim.assignGarrison([squad.id],trench.id);sim.step(.05);
    people[0].duty!.entryPoint={x:NaN,z:0};expect(()=>new SaveSystem().parse(JSON.stringify(state))).toThrow();
  });
});
