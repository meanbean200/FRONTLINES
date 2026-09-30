import {describe,it,expect} from 'vitest';
import {TerrainSystem} from './TerrainSystem';
import {createBattlefield} from '../simulation/createBattlefield';

describe('cached terrain tile boundaries',()=>{
  it('keeps finite, continuous height for negative epsilon and subnormal coordinates',()=>{
    const terrain=new TerrainSystem(createBattlefield());
    for(const edge of [-64,-32,0,32,64])for(const step of [-1e-9,-Number.EPSILON,-Number.MIN_VALUE,0,Number.MIN_VALUE,Number.EPSILON,1e-9])for(const along of [-80,-.2,0,31.8,63.9]){
      for(const [x,z,ex,ez]of [[edge+step,along,edge,along],[along,edge+step,along,edge]]){
        const h=terrain.baseHeightAt(x,z);
        expect(Number.isFinite(h),`height at ${x}, ${z}`).toBe(true);
        expect(h).toBeCloseTo(terrain.baseHeightAt(ex,ez),6);
      }
    }
  });
});
