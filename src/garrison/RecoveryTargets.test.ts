import { describe, expect, it } from 'vitest';
import { createDisconnectedRecoveryScenario, createRecoveryScenario } from './RecoveryScenario';
import { balance, transfer } from './Inventory';
import { inventory } from './types';
import { SaveSystem } from '../persistence/SaveSystem';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';

const advance=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds/.05;i++)sim.step(.05);};

describe('recovery target selection',()=>{
  it('skips a disconnected crate and still sends a carrier to a reachable alternative',()=>{
    const {sim,g,crate,blocked}=createDisconnectedRecoveryScenario();
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,1);
    expect(sim.state.soldiers.filter(s=>s.duty?.crateId===blocked.id)).toHaveLength(0);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===crate.id)).toBe(true);
    expect(blocked.stock.water).toBe(6);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('does not leave every idle soldier retrying an unreachable crate instead of resting',()=>{
    const {sim,g,blocked}=createDisconnectedRecoveryScenario(true);
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,1);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===blocked.id)).toBe(false);
    expect(sim.state.soldiers.every(s=>['rest','patrol','watch'].includes(s.duty?.kind??''))).toBe(true);
  });
  it('reconsiders a blocked target after a connector completes, including after save/load',()=>{
    const {sim,g,blocked}=createDisconnectedRecoveryScenario(true);
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,1);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===blocked.id)).toBe(false);
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    restored.state.trenches.push({id:restored.state.nextEntityId++,points:[{...g.entrance},{x:blocked.x,z:blocked.z}],width:4.2,depth:1.75,progress:1,status:'complete'});
    // Stable rest commitments finish before a newly connected recovery trip.
    // The rear-bank resting positions can require a longer physical walk.
    for(let i=0;i<2400&&restored.state.living!.crates.find(c=>c.id===blocked.id)!.stock.water===blocked.stock.water;i++)restored.step(.05);
    expect(restored.state.living!.crates.find(c=>c.id===blocked.id)!.stock.water).toBeLessThan(blocked.stock.water);
    for(const n of Object.values(balance(restored.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('chooses a nearby crate before an earlier-listed distant crate',()=>{
    const {sim,g,crate}=createRecoveryScenario(),far={id:sim.state.nextEntityId++,x:g.entrance.x-300,z:g.entrance.z-30,stock:inventory()};
    transfer(crate.stock,far.stock,'water',6);sim.state.living!.crates.unshift(far);
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,.05);
    expect(sim.state.soldiers[0].duty?.crateId).toBe(crate.id);
  });
  it('does not append an impassable delivery hop into a building after goal projection',()=>{
    const {sim,g,crate}=createRecoveryScenario(),building=sim.terrain.buildings[0];
    const blocked={id:sim.state.nextEntityId++,x:building.x,z:building.z,stock:inventory()};
    transfer(crate.stock,blocked.stock,'water',6);sim.state.living!.crates.unshift(blocked);
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,1);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===blocked.id)).toBe(false);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===crate.id)).toBe(true);
    expect(blocked.stock.water).toBe(6);
  });
  it('releases an empty blocked pickup from an older save and takes a valid job',()=>{
    const {sim,g,crate,blocked}=createDisconnectedRecoveryScenario(),s=sim.state.soldiers[0];
    s.duty={kind:'haul',destination:{x:blocked.x,z:blocked.z},route:[{...g.entrance},{x:blocked.x,z:blocked.z}],routeIndex:1,since:75,until:255,reason:'Recover dropped supplies',blockedFor:3,networkBound:true,routeBlocked:true,stage:'pickup',crateId:blocked.id};
    const restored=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    restored.garrisons.resolveEmergency(g.id,'recover');advance(restored,1);
    expect(restored.state.soldiers[0].duty?.crateId).toBe(crate.id);
    expect(restored.state.living!.crates.find(c=>c.id===blocked.id)!.stock).toEqual(blocked.stock);
    for(const n of Object.values(balance(restored.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
});
