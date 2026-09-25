import {describe,it,expect} from 'vitest';
import {createOperation} from '../operations/createOperation';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {carrierCapacity,transfer,balance,total} from './Inventory';
import {inventory} from './types';
import {SaveSystem} from '../persistence/SaveSystem';
describe('campaign logistics',()=>{
  it('allows an armed rifleman to carry a sack without treating his bandolier as cargo space',()=>{const stock=inventory({ammo:60,food:2,water:3});expect(carrierCapacity(stock,16)-total(stock)).toBe(11);expect(carrierCapacity(inventory({ammo:100}),16)).toBe(76);});
  it('starts within physical storage capacities and conserves faction stock',()=>{const sim=new BattlefieldSimulation(createOperation('campaign'));for(const g of sim.state.living!.garrisons)expect(total(g.cache)).toBeLessThanOrEqual(sim.state.living!.logistics!.cacheCapacity);for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-7);});
  it('returns a cancelled shipment physically without remote unloading or cargo loss',()=>{
    const sim=new BattlefieldSimulation(createOperation('campaign')),w=sim.state.living!,g=w.garrisons[0],t=w.trucks.find(t=>t.role==='shuttle'&&t.faction!=='enemy')!;
    transfer(w.rearStock,t.cargo,'food',50);Object.assign(t,g.forward);t.garrisonId=g.id;t.state='unloading';t.timer=0;g.faction='enemy';const stock=w.rearStock.food;
    sim.garrisons.logistics.step(.05);expect(t.state).toBe('returning');expect(t.cargo.food).toBe(50);expect(w.rearStock.food).toBe(stock);expect(t.route.at(-1)).toEqual(w.rear);
    for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-7);
  });
  it('queues chosen ammunition works, rejects forward/overlapping placement, and charges no invisible stock',()=>{
    const sim=new BattlefieldSimulation(createOperation('campaign')),g=sim.state.living!.garrisons[0],origin=sim.garrisons.network.nearest({x:-1464,z:-1510})!.point;
    expect(sim.garrisons.requestFacility(g.id,'ammo',{x:origin.x+20,z:origin.z},origin,undefined,true)).toBeUndefined();
    const p={x:origin.x-20,z:origin.z},id=sim.garrisons.requestFacility(g.id,'ammo',p,origin,undefined,true);expect(id).toBeDefined();expect(sim.garrisons.requestFacility(g.id,'store',p,origin,undefined,true)).toBeUndefined();
    const f=sim.state.living!.facilities.find(f=>f.id===id)!;expect(f.progress).toBe(0);expect(f.paid).toBe(false);expect(f.materialCost).toBe(14);for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-7);
  });
  it('clears defeated ownership when a player squad occupies an empty enemy network and still saves',()=>{
    const sim=new BattlefieldSimulation(createOperation('campaign')),enemy=sim.state.living!.garrisons.find(g=>g.faction==='enemy')!;
    const previous=[...enemy.squadIds],squad=sim.state.squads.find(q=>q.faction==='player')!;
    for(const s of sim.state.soldiers.filter(s=>previous.includes(s.squadId)))s.needs!.life='dead';
    sim.garrisons.release(squad.id);
    const positions=sim.state.soldiers.filter(s=>previous.includes(s.squadId));
    sim.state.soldiers.filter(s=>s.squadId===squad.id).forEach((s,i)=>{s.x=positions[i].x;s.z=positions[i].z;});
    expect(sim.garrisons.assign([squad.id],enemy.trenchId)).toBe(true);
    expect(enemy.faction).toBe('player');expect(enemy.squadIds).toEqual([squad.id]);
    expect(()=>new SaveSystem().parse(JSON.stringify(sim.state))).not.toThrow();conserved(sim);
  });
});
function conserved(sim:BattlefieldSimulation):void{for(const n of Object.values(balance(sim.state)))expect(Math.abs(n)).toBeLessThan(1e-7);}
