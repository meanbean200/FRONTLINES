import { describe, expect, it, vi } from 'vitest';
import { createRecoveryScenario } from './RecoveryScenario';
import { balance, total } from './Inventory';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { SaveSystem } from '../persistence/SaveSystem';
import { distance } from '../core/types';

function arrivedPickup(){
  const setup=createRecoveryScenario(),{sim,g}=setup;sim.garrisons.resolveEmergency(g.id,'recover');
  for(let i=0;i<5000;i++){
    sim.step(.05);const s=sim.state.soldiers.find(s=>s.duty?.crateId&&s.duty.stage==='pickup'&&s.duty.arrivedAt!==undefined);
    if(s)return {...setup,s};
  }
  throw Error('Physical pickup did not arrive');
}
const advance=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds/.05;i++)sim.step(.05);};

describe('validated return approaches',()=>{
  it('reuses an arrived carrier route when a new grid search cannot find the return',()=>{
    const {sim,g,s}=arrivedPickup(),before={x:s.x,z:s.z},trace=structuredClone(s.duty!.route);
    expect(trace.some(p=>distance(p,g.entrance)<.15)).toBe(true);
    const plan=vi.spyOn(sim.navigation,'plan').mockReturnValue([]);
    for(let i=0;i<100&&s.duty?.stage!=='deliver';i++)sim.step(.05);
    expect(s.duty?.stage).toBe('deliver');expect(total(s.carried!)).toBeGreaterThan(0);
    expect({x:s.x,z:s.z}).toEqual(before);expect(s.duty!.route.some(p=>distance(p,g.entrance)<.15)).toBe(true);
    plan.mockRestore();for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('rejects a newly obstructed trace, retains cargo, then rechecks after geometry changes',()=>{
    const {sim,g,s,crate}=arrivedPickup(),x=(g.entrance.x+crate.x)/2,z=(g.entrance.z+crate.z)/2;
    s.needs!.hunger=10;s.needs!.thirst=10; // Isolate route invalidation from a timed carried-ration break.
    const barrier={id:sim.state.nextEntityId++,points:[{x,z:z-15},{x,z:z+15}],width:4.2,depth:1.75,progress:1,status:'complete' as const};sim.state.trenches.push(barrier);
    const plan=vi.spyOn(sim.navigation,'plan').mockReturnValue([]);advance(sim,4);
    expect(s.duty?.stage).toBe('pickup');expect(total(s.carried!)).toBeGreaterThan(0);expect(plan).toHaveBeenCalled();
    const pack={...s.carried};sim.state.trenches.splice(sim.state.trenches.indexOf(barrier),1);sim.step(.05);
    expect(s.duty?.stage).toBe('deliver');expect(s.carried).toEqual(pack);plan.mockRestore();
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('does not invent a direct return when the saved trace has no entrance',()=>{
    const {sim,s}=arrivedPickup();s.duty!.route=[{x:s.x,z:s.z}];s.duty!.routeIndex=1;
    const plan=vi.spyOn(sim.navigation,'plan').mockReturnValue([]);advance(sim,4);
    expect(s.duty?.stage).toBe('pickup');expect(total(s.carried!)).toBeGreaterThan(0);expect(plan).toHaveBeenCalled();plan.mockRestore();
  });
  it('continues the actual pickup and laden return identically through save/load',()=>{
    const {sim,s,g,crate}=arrivedPickup(),other=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    let returned=false;
    for(let i=0;i<1600;i++){sim.step(.05);other.step(.05);if(s.duty?.stage==='deliver'&&distance(s,g.entrance)<4)returned=true;}
    expect(other.state).toEqual(sim.state);expect(returned).toBe(true);
    // A later replenishment pickup is a new job, not a failed crate return.
    expect(s.duty?.crateId).not.toBe(crate.id);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
});
