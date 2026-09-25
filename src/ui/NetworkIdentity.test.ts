import {describe,it,expect} from 'vitest';
import {TrenchNetwork} from '../garrison/TrenchNetwork';
import {networkRepresentatives} from './TrenchReadout';
import type {TrenchState} from '../core/types';
describe('connected player-facing network identity',()=>{
  it.each([1,5,15,30,60])('%i connected sections have one representative and cached component lookups',count=>{
    const trenches:TrenchState[]=Array.from({length:count},(_,i)=>({id:100+i,points:[{x:i*10,z:0},{x:(i+1)*10,z:0}],width:4.2,depth:1.75,progress:1,status:'complete'}));
    const network=new TrenchNetwork();network.sync(trenches);const revision=network.revision;
    expect(networkRepresentatives(trenches,network).map(t=>t.id)).toEqual([100]);expect(trenches.every(t=>network.anchor(t.id)===100)).toBe(true);expect(network.sync(trenches)).toBe(false);expect(network.revision).toBe(revision);
    const loaded=new TrenchNetwork();loaded.sync(JSON.parse(JSON.stringify(trenches)));expect(loaded.anchor(trenches.at(-1)!.id)).toBe(100);
  });
  it('extension and merge retain the oldest identity; unfinished gaps remain separate',()=>{
    const network=new TrenchNetwork(),t=(id:number,a:number,b:number,progress=1):TrenchState=>({id,points:[{x:a,z:0},{x:b,z:0}],width:4.2,depth:1.75,progress,status:progress===1?'complete':'planned'}),trenches=[t(10,0,20),t(20,60,80),t(30,20,60,0)];
    network.sync(trenches);expect(networkRepresentatives(trenches,network)).toHaveLength(3);trenches[2].progress=1;trenches[2].status='complete';network.sync(trenches);expect(networkRepresentatives(trenches,network).map(t=>t.id)).toEqual([10]);expect(network.anchor(20)).toBe(10);
  });
});
