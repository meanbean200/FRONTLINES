import {describe,it,expect} from 'vitest';
import {motionFrameDelay} from './ReplayTiming';
describe('recorded motion timing',()=>{
  it('accepts one-second fixed-step snapshots despite floating point residue',()=>{expect(motionFrameDelay(10,11.000000000000014)).toBe(1000);});
  it('rejects coarse, reversed and invalid snapshots',()=>{for(const n of [2,0,-1,NaN,Infinity])expect(motionFrameDelay(0,n)).toBeUndefined();});
  it('retains a usable floor for densely sampled clips',()=>{expect(motionFrameDelay(0,.001)).toBe(16);expect(motionFrameDelay(0,.25)).toBe(250);});
});
