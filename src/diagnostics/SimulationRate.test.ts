import {it,expect} from 'vitest';
import {SimulationRate} from './SimulationRate';
it('reports actual advancement and resets across pause, speed, load and session changes',()=>{
  const rate=new SimulationRate(),world={};expect(rate.sample(world,0,0,5)).toBeUndefined();expect(rate.sample(world,2000,2.5,5)).toBe(1.25);
  expect(rate.sample(world,2100,2.5,0)).toBeUndefined();expect(rate.sample(world,5000,2.5,5)).toBeUndefined();expect(rate.sample(world,7000,12.5,5)).toBe(5);
  expect(rate.sample({},8000,0,5)).toBeUndefined();expect(rate.sample(world,9000,0,1)).toBeUndefined();
});
