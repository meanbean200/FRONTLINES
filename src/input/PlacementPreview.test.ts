import {describe,it,expect} from 'vitest';
import {boundedIndicator,materialPreview} from './PlacementPreview';
describe('bounded construction plotting',()=>{
  it('bounds the on-screen arrow without changing its bearing',()=>{
    const a={x:500,y:300},b=boundedIndicator(a,{x:3500,y:4300});
    expect(Math.hypot(b.x-a.x,b.y-a.y)).toBeCloseTo(80);expect((b.x-a.x)/(b.y-a.y)).toBeCloseTo(.75);
    expect(boundedIndicator(a,a)).toEqual(a);expect(boundedIndicator(a,{x:510,y:310})).toEqual({x:510,y:310});
  });
  it('presents a physical shortfall instead of a disconnected cost label',()=>{
    expect(materialPreview(80,128)).toBe('Materials: 80 / 128 · 48 more required');
    expect(materialPreview(128,128)).toBe('Materials: 128 / 128 · supplied');
  });
});
