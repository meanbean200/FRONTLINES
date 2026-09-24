import { describe, expect, it } from 'vitest';
import { createRecoveryScenario } from './RecoveryScenario';
import { balance, transfer } from './Inventory';
import { SaveSystem } from '../persistence/SaveSystem';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';

const advance=(sim:BattlefieldSimulation,seconds:number)=>{for(let i=0;i<seconds/.05;i++)sim.step(.05);};

describe('physical emergency trips',()=>{
  it('recovers a nearby crate only after arrival and continues a laden return from save',()=>{
    const {sim,g,crate}=createRecoveryScenario(),stock={...crate.stock};
    sim.garrisons.resolveEmergency(g.id,'recover');advance(sim,2);
    expect(crate.stock).toEqual(stock);
    expect(sim.state.soldiers.some(s=>s.duty?.crateId===crate.id)).toBe(true);
    let returning=false;
    for(let i=0;i<6000&&!returning;i++){sim.step(.05);returning=sim.state.soldiers.some(s=>s.duty?.kind==='haul'&&s.duty.stage==='deliver'&&(s.carried?.water??0)>0);}
    expect(returning).toBe(true);expect(crate.stock.water).toBeLessThan(stock.water);
    const other=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    advance(sim,150);advance(other,150);
    expect(other.state).toEqual(sim.state);
    expect(sim.state.living!.ledger.consumed.water).toBeGreaterThan(0);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('walks to the withdrawal apron before consuming forward supplies',()=>{
    const {sim,g,crate}=createRecoveryScenario();
    transfer(crate.stock,g.forwardStock,'food',40);transfer(crate.stock,g.forwardStock,'water',60);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    const water=g.forwardStock.water;advance(sim,2);expect(g.forwardStock.water).toBe(water);
    const other=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    advance(sim,210);advance(other,210);
    expect(other.state).toEqual(sim.state);
    expect(g.forwardStock.water).toBeLessThan(water);
    expect(sim.state.soldiers.every(s=>s.needs!.thirst<80)).toBe(true);
    expect(sim.state.soldiers.every(s=>s.needs!.hunger<70)).toBe(true);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('shares scarce withdrawal rations without early arrivals stockpiling reserves',()=>{
    const {sim,g,crate}=createRecoveryScenario();
    transfer(crate.stock,g.forwardStock,'food',16);transfer(crate.stock,g.forwardStock,'water',16);
    sim.garrisons.resolveEmergency(g.id,'withdraw');advance(sim,210);
    expect(sim.state.soldiers.every(s=>s.duty?.arrivedAt!==undefined)).toBe(true);
    expect(sim.state.soldiers.every(s=>s.needs!.hunger<70&&s.needs!.thirst<70)).toBe(true);
    expect(sim.state.soldiers.every(s=>s.carried!.food<=.5&&s.carried!.water<=.5)).toBe(true);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-6);
  });
  it('takes time to eat a withdrawal ration and saves the break exactly',()=>{
    const {sim,g,crate}=createRecoveryScenario();transfer(crate.stock,g.forwardStock,'food',40);transfer(crate.stock,g.forwardStock,'water',60);
    sim.garrisons.resolveEmergency(g.id,'withdraw');
    for(let i=0;i<4000&&!sim.state.soldiers.some(s=>s.duty?.rationUntil!==undefined);i++)sim.step(.05);
    const person=sim.state.soldiers.find(s=>s.duty?.rationUntil!==undefined)!;
    expect(person).toBeDefined();expect(person.action).toBe('eating');expect(person.duty!.arrivedAt).toBeDefined();
    const hunger=person.needs!.hunger,pack={...person.carried};advance(sim,2);
    expect(person.needs!.hunger).toBeGreaterThanOrEqual(hunger);expect(person.carried).toEqual(pack);
    const other=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));
    advance(sim,25);advance(other,25);expect(other.state).toEqual(sim.state);
    expect(person.needs!.hunger).toBeLessThan(hunger);
  });
});
