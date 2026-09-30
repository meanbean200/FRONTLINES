import {describe,it,expect} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {reconcileSupplyDemands,unfulfilled} from './SupplyDemand';
import {inventory} from './types';
import {balance,transfer,total} from './Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';

describe('workload driven supply, independent of position count',()=>{
  it('twenty empty micro-positions create neither demand nor additional vehicles',()=>{
    const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];
    const before=structuredClone(reconcileSupplyDemands(s)),vehicles=w.trucks.length,stock=balance(s);
    for(let i=0;i<20;i++)w.garrisons.push({...structuredClone(g),id:s.nextEntityId++,squadIds:[],cache:inventory(),forwardStock:inventory()});
    expect(reconcileSupplyDemands(s)).toEqual(before);expect(w.trucks).toHaveLength(vehicles);expect(balance(s)).toEqual(stock);
  });
  it('personnel targets are linear, including tiny positions and critical needs',()=>{
    const targets=(size:number)=>{const sim=createStudyScenario(1944,0,size),s=sim.state;for(const p of s.soldiers)p.needs!.thirst=80;
      return reconcileSupplyDemands(s).filter(d=>d.resource==='water').reduce((n,d)=>n+d.target,0);};
    expect([2,30,50].map(targets)).toEqual([4,60,100]);
  });
  it('splitting the same people among many positions cannot multiply reserve targets',()=>{
    const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];
    const sum=()=>reconcileSupplyDemands(s).reduce((n,d)=>n+d.target,0),before=sum();
    for(const p of s.soldiers.slice(1)){const area={...structuredClone(g),id:s.nextEntityId++,squadIds:[p.squadId],cache:inventory(),forwardStock:inventory()};w.garrisons.push(area);p.garrisonId=area.id;}
    expect(sum()).toBeCloseTo(before);
  });
  it('only remaining unpaid work and staffed weapons add demand; inbound stock is not ordered twice',()=>{
    const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.cache=inventory();g.forwardStock=inventory();
    const f={id:s.nextEntityId++,garrisonId:g.id,kind:'mortar' as const,x:g.entrance.x,z:g.entrance.z,connectorId:g.trenchId,progress:.95,paid:true,capacity:2,materialCost:32,stock:inventory(),includesWeapon:true};w.facilities.push(f);
    expect(reconcileSupplyDemands(s).filter(d=>d.resource==='materials').reduce((n,d)=>n+unfulfilled(d),0)).toBe(0);
    f.paid=false;f.progress=0;f.stock.materials=8;
    expect(reconcileSupplyDemands(s).find(d=>d.consumerId===f.id)?.target).toBe(32);
    const truck=w.trucks.find(t=>t.role==='shuttle')!;Object.assign(truck,{garrisonId:g.id,state:'outbound',cargo:inventory({materials:24})});
    expect(reconcileSupplyDemands(s).find(d=>d.consumerId===f.id)).toMatchObject({usable:8,claims:[{source:'truck',id:truck.id,amount:24}]});
    expect(unfulfilled(w.supplyDemands!.find(d=>d.consumerId===f.id)!)).toBe(0);
    f.progress=1;f.paid=true;expect(reconcileSupplyDemands(s).some(d=>d.consumerId===f.id)).toBe(false);
    Object.assign(f,{weaponCrewIds:s.soldiers.slice(0,2).map(p=>p.id)});expect(reconcileSupplyDemands(s).some(d=>d.consumerId===f.id&&d.resource==='mortarHE')).toBe(true);
  });
  it.each([25,100])('shares the fleet by real workload and reserves inbound storage (%i capacity)',capacity=>{
    const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];
    const id=sim.garrisons.requestFacility(g.id,'mortar',undefined,undefined,undefined,true)!;
    expect(id).toBeDefined();transfer(g.cache,w.rearStock,'materials',g.cache.materials);
    w.logistics!.shuttleCapacity=12;w.logistics!.forwardCapacity=capacity;w.nextDelivery=1000;
    const vehicles=w.trucks.length;
    for(let i=0;i<20;i++)w.garrisons.push({...structuredClone(g),id:s.nextEntityId++,squadIds:[],cache:inventory(),forwardStock:inventory()});
    sim.garrisons.logistics.step(.05);
    const trucks=w.trucks.filter(t=>t.role==='shuttle'&&t.state==='loading');
    expect(trucks).toHaveLength(3);expect(trucks.every(t=>t.garrisonId===g.id)).toBe(true);
    expect(trucks.reduce((n,t)=>n+t.cargo.materials,0)).toBe(Math.min(32,capacity));
    expect(total(g.forwardStock)+trucks.reduce((n,t)=>n+total(t.cargo),0)).toBeLessThanOrEqual(capacity);
    expect(w.trucks).toHaveLength(vehicles);expect(g.lastDeliveryAt).toBeUndefined();expect(g.lastDispatchAt).toBe(0);
    expect(unfulfilled(w.supplyDemands!.find(d=>d.consumerId===id)!)).toBe(Math.max(0,32-capacity));
    for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
    const resumed=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
    for(let i=0;i<160;i++){sim.garrisons.logistics.step(.05);resumed.garrisons.logistics.step(.05);}
    expect(resumed.state).toEqual(s);
  });
});
