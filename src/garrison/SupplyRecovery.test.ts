import {describe,it,expect,vi} from 'vitest';
import {createStudyScenario} from './StudyScenario';
import {inventory,RESOURCES} from './types';
import {balance,total,transfer,consume} from './Inventory';
import {SaveSystem} from '../persistence/SaveSystem';
import {BattlefieldSimulation} from '../simulation/BattlefieldSimulation';
import {createOperationalBattle} from '../operations/createOperationalBattle';
import {defaultBattleSetup,resolveBattleSetup} from '../operations/BattleSetup';
import {defaultEndlessOptions} from '../operations/EndlessTypes';
import {distance} from '../core/types';
describe('player-ordered physical supply recovery',()=>{
 it('finishes a return when its recoverable cargo was consumed en route instead of waiting for nonexistent stock',()=>{
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.nextSupport=1e9;
  for(let i=0;i<600;i++)sim.step(.05);
  const c={id:s.nextEntityId++,x:g.entrance.x-10,z:g.entrance.z-8,stock:inventory()};w.crates.push(c);transfer(w.rearStock,c.stock,'ammo',12);
  expect(sim.garrisons.recoverSupplies(c.id,g.id).accepted).toBe(true);const p=s.soldiers.find(p=>p.duty?.crateId===c.id)!;
  for(let i=0;i<1500&&!p.duty?.recoveryLoad;i++)sim.step(.05);
  expect(p.duty?.recoveryLoad?.ammo).toBeGreaterThan(0);
  consume(s,p.carried!,'ammo',p.carried!.ammo);const cache=g.cache.ammo;
  const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
  for(let i=0;i<1500&&p.duty?.recoveryLoad;i++){sim.step(.05);copy.step(.05);}
  expect(p.duty?.recoveryLoad).toBeUndefined();expect(g.cache.ammo).toBe(cache);expect(copy.state).toEqual(s);
  expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
 });
 it('retains recovered ammunition identity while staging at a full store and being called forward again',()=>{
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.nextSupport=1e9;
  for(let i=0;i<600;i++)sim.step(.05);
  const c={id:s.nextEntityId++,x:g.entrance.x-10,z:g.entrance.z-8,stock:inventory()};w.crates.push(c);transfer(w.rearStock,c.stock,'ammo',12);
  expect(sim.garrisons.recoverSupplies(c.id,g.id).accepted).toBe(true);const p=s.soldiers.find(p=>p.duty?.crateId===c.id)!;
  for(let i=0;i<1500&&!p.duty?.recoveryLoad;i++)sim.step(.05);
  expect(p.duty?.recoveryLoad?.ammo).toBeGreaterThan(0);const load=p.duty!.recoveryLoad!.ammo,capacity=w.logistics!.cacheCapacity;w.logistics!.cacheCapacity=1;
  for(let i=0;i<1500&&!p.duty?.pickupQueued;i++)sim.step(.05);
  expect(p.duty?.pickupQueued).toBe(true);expect(p.duty?.recoveryLoad?.ammo).toBe(load);
  expect(new SaveSystem().parse(JSON.stringify(s)).soldiers.find(v=>v.id===p.id)!.duty?.recoveryLoad?.ammo).toBe(load);
  w.logistics!.cacheCapacity=capacity;const before=g.cache.ammo;
  for(let i=0;i<1500&&p.duty?.recoveryLoad;i++)sim.step(.05);
  expect(g.cache.ammo-before).toBe(load);expect(p.duty?.recoveryLoad).toBeUndefined();expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
 });
 it('retains the tracked carried load when the return route fails, then completes without a second pickup',()=>{
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.nextSupport=1e9;
  for(let i=0;i<600;i++)sim.step(.05);
  const c={id:s.nextEntityId++,x:g.entrance.x-10,z:g.entrance.z-8,stock:inventory()};w.crates.push(c);transfer(w.rearStock,c.stock,'ammo',12);
  expect(sim.garrisons.recoverSupplies(c.id,g.id).accepted).toBe(true);const p=s.soldiers.find(p=>p.duty?.crateId===c.id)!;
  for(let i=0;i<1200&&p.duty?.arrivedAt===undefined;i++)sim.step(.05);
  expect(p.duty?.arrivedAt).toBeDefined();const before={...c.stock},pack=p.carried!.ammo;
  const denied=vi.spyOn(sim.garrisons as unknown as {assignDuty:()=>boolean},'assignDuty').mockReturnValue(false);
  for(let i=0;i<100;i++)sim.step(.05);
  expect(c.stock.ammo).toBeLessThan(before.ammo);expect(p.carried!.ammo).toBeGreaterThan(pack);expect(p.duty!.reason).toContain('RETURN ROUTE BLOCKED');
  const held={...p.carried},left={...c.stock};for(let i=0;i<80;i++)sim.step(.05);
  expect(p.carried).toEqual(held);expect(c.stock).toEqual(left);
  expect(new SaveSystem().parse(JSON.stringify(s)).soldiers.find(v=>v.id===p.id)!.duty?.recoveryLoad).toEqual(p.duty!.recoveryLoad);denied.mockRestore();
  for(let i=0;i<1800&&p.duty?.kind==='haul';i++)sim.step(.05);
  expect(p.duty?.kind).not.toBe('haul');expect(c.stock.ammo).toBeLessThan(before.ammo);expect(Object.values(balance(s)).every(n=>Math.abs(n)<1e-6)).toBe(true);
 });
 it('routes from distant prepared sectors to secured Saint-Martin on actual generated terrain',()=>{
  const base=defaultBattleSetup(),setup=resolveBattleSetup({...base,operation:'open-front',map:'seed',seed:1944,battleMode:'endless',endless:defaultEndlessOptions(),advanced:{...base.advanced,direction:'east',approach:'close'}},1944);
  const sim=new BattlefieldSimulation(createOperationalBattle('open-front',1944,setup,true)),s=sim.state;
  for(let i=0;i<400;i++)sim.step(.05);
  const town=s.operation!.objectives.find(o=>o.name==='SAINT-MARTIN')??s.operation!.objectives.find(o=>o.name.toLowerCase()==='saint-martin')!;
  town.owner='player';town.control=1;town.contested=false;
  const c=s.living!.crates.find(c=>c.id===town.cacheId)!;
  for(const g of s.living!.garrisons.filter(g=>g.faction!=='enemy'&&distance(g.entrance,c)>650)){
   const result=sim.garrisons.recoverSupplies(c.id,g.id);expect(result.accepted,result.reason).toBe(true);
   const p=s.soldiers.find(p=>p.duty?.crateId===c.id)!,d=p.duty!,entry=d.route.findIndex(v=>distance(v,g.entrance)<.2);
   expect(d.route.length).toBeGreaterThan(1);expect(entry).toBeGreaterThanOrEqual(0);
   const external=d.route.slice(entry),avoid=(v:{x:number;z:number})=>sim.garrisons.network.corridorContains(v)&&distance(v,g.entrance)>4.1;
   expect(external.slice(1).every((v,i)=>sim.navigation.segmentClear(external[i],v,.4,avoid))).toBe(true);
   expect(sim.navigation.segmentClear(external.at(-1)!,c,.4,avoid)).toBe(true);
   delete p.duty;
  }
 });
 it('walks, loads a finite sack and delivers recovered ammunition rather than silently keeping it as personal rounds',()=>{
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.nextSupport=1e9;
  for(let i=0;i<1200;i++)sim.step(.05);
  const crate={id:s.nextEntityId++,x:g.entrance.x-10,z:g.entrance.z-8,stock:inventory()};w.crates.push(crate);transfer(w.rearStock,crate.stock,'ammo',30);
  const cache=g.cache.ammo,stock={...crate.stock};
  const result=sim.garrisons.recoverSupplies(crate.id,g.id);expect(result.accepted,result.reason).toBe(true);expect(crate.stock).toEqual(stock);
  const carrier=s.soldiers.find(p=>p.duty?.crateId===crate.id)!;expect(carrier.duty!.arrivedAt).toBeUndefined();
  for(let i=0;i<2000&&!carrier.duty?.recoveryLoad;i++)sim.step(.05);
  expect(carrier.duty?.recoveryLoad?.ammo).toBeGreaterThan(0);expect(crate.stock.ammo).toBeLessThan(30);
  const copy=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
  for(let i=0;i<1800&&carrier.duty?.recoveryLoad;i++){sim.step(.05);copy.step(.05);}
  expect(carrier.duty?.recoveryLoad).toBeUndefined();expect(g.cache.ammo).toBeGreaterThan(cache);expect(copy.state).toEqual(s);
  for(const n of Object.values(balance(s)))expect(Math.abs(n)).toBeLessThan(1e-6);
 });
 it('does not transfer at command time, steal protected crew, or duplicate a reserved pickup',()=>{
  const sim=createStudyScenario(),s=sim.state,w=s.living!,g=w.garrisons[0];g.nextSupport=1e9;
  for(let i=0;i<600;i++)sim.step(.05);
  const c={id:s.nextEntityId++,x:g.entrance.x-10,z:g.entrance.z-8,stock:inventory()};w.crates.push(c);transfer(w.rearStock,c.stock,'materials',16);
  const before=total(c.stock);expect(sim.garrisons.recoverSupplies(c.id,g.id).accepted).toBe(true);expect(total(c.stock)).toBe(before);
  expect(sim.garrisons.recoverSupplies(c.id,g.id).reason).toContain('RESERVED');
  expect(RESOURCES.every(k=>Math.abs(balance(s)[k])<1e-6)).toBe(true);
 });
});
