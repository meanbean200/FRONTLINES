import {it,expect} from 'vitest';
import {verifyOccupiedTraffic,occupiedTrafficFixture} from '../../scripts/qa-occupied-traffic';
import {distance} from '../core/types';

it.each([false,true])('moves eighty people through an occupied production network without body jams or anchor backtracking (loop: %s)',loop=>{
  const {crowded,baseline}=verifyOccupiedTraffic(loop);
  expect(crowded.personnel).toBe(96);expect(crowded.travellers).toBe(80);
  expect(crowded.maxStall).toBeLessThanOrEqual(2);expect(crowded.seconds).toBeLessThanOrEqual(baseline.seconds*2);
},20000);

it('replans occupied loop traffic when a connector is removed without cutting through unexcavated floor',()=>{
  const {sim,targets}=occupiedTrafficFixture(false,true),state=sim.state,loop=state.trenches.at(-1)!;
  const affected=state.soldiers.filter(s=>s.duty?.routeTrenches?.includes(loop.id));expect(affected.length).toBeGreaterThan(0);
  state.trenches=state.trenches.filter(t=>t!==loop);
  for(let tick=0;tick<1500;tick++){
    const before=state.soldiers.map(s=>({x:s.x,z:s.z}));sim.step(.05);
    state.soldiers.forEach((s,i)=>expect(distance(s,before[i])).toBeLessThan(.12));
    for(const s of affected){expect(sim.garrisons.network.corridorContains(s)).toBe(true);expect(s.duty?.routeTrenches).not.toContain(loop.id);}
  }
  for(const s of affected.filter(s=>targets.has(s.id))){expect(s.duty?.arrivedAt).toBeDefined();expect(distance(s,targets.get(s.id)!)).toBeLessThan(.5);}
},20000);
