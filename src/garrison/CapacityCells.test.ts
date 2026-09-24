import {describe,expect,it,vi} from 'vitest';
import {CapacityCells} from './CapacityCells';

type Contribution=[number,number,number,number];
// Original full-map cell union, retained as an exact numerical reference.
function reference(contributions:Contribution[]):Map<number,number>{
  const cells=new Map<string,Map<number,number>>();
  for(const [x,z,id,area] of contributions){const key=`${x},${z}`,owners=cells.get(key)??new Map<number,number>();owners.set(id,Math.max(owners.get(id)??0,area));cells.set(key,owners);}
  const areas=new Map<number,number>();
  for(const owners of cells.values()){const total=[...owners.values()].reduce((a,b)=>a+b,0),union=Math.max(...owners.values());for(const [id,area] of owners)areas.set(id,(areas.get(id)??0)+union*area/Math.max(1e-9,total));}
  return areas;
}
const actual=(contributions:Contribution[])=>{const cells=new CapacityCells();for(const c of contributions)cells.add(...c);return [...cells.areas()];};

describe('trench floor union accumulation',()=>{
  it('preserves overlaps, first-owner order and repeated maxima exactly',()=>{
    const c:Contribution[]=[[0,0,9,.2],[0,0,9,.1],[1,0,3,.1],[0,0,3,.15],[0,0,7,.05],[0,0,9,.25],[1,0,9,.2],[1,0,3,.05]];
    expect(actual(c)).toEqual([...reference(c)]);
  });
  it('keeps zero and tiny partial cells and signed coordinates separate',()=>{
    const c:Contribution[]=[[-1,20,0,0],[-1,20,2,1e-12],[-1,20,0,5e-10],[1,-20,0,.03],[12,3,4,.24999999999999],[1,23,4,.25],[-8000,-8000,5,.015]];
    expect(actual(c)).toEqual([...reference(c)]);expect(actual([])).toEqual([]);
  });
  it('matches the original floating-point totals across seeded multi-owner updates',()=>{
    let seed=1944;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let sample=0;sample<80;sample++){
      const c:Contribution[]=Array.from({length:1200},()=>[Math.floor(random()*30)-15,Math.floor(random()*30)-15,Math.floor(random()*5),random()*.25]);
      expect(actual(c)).toEqual([...reference(c)]);
    }
  });
  it('does not allocate owner-value arrays for every single-owner floor cell',()=>{
    const cells=new CapacityCells();for(let i=0;i<1000;i++)cells.add(i,-3,4,.25);
    const values=vi.spyOn(Map.prototype,'values');let result:Map<number,number>,calls:number;
    try{result=cells.areas();calls=values.mock.calls.length;}finally{values.mockRestore();}
    expect(result!.get(4)).toBe(250);expect(calls!).toBeLessThan(10);
  });
});
