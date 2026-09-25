import {describe,it,expect} from 'vitest';
import {clippedPaths} from './ProjectedPaths';
describe('camera-plane-safe projected paths',()=>{
  const p=(x:number,y:number,inFront=true)=>({x,y,inFront,visible:inFront});
  it('never joins through a behind-camera point',()=>{expect(clippedPaths([p(20,20),p(-9000,5000,false),p(90,50)],100,100)).toEqual([]);});
  it('clips an offscreen but front-facing segment to the real viewport',()=>{expect(clippedPaths([p(-50,25),p(150,25)],100,60)).toEqual([[{x:0,y:25,visible:true},{x:100,y:25,visible:true}]]);});
  it('rejects invalid or explosive coordinates and retains a legitimate contiguous path',()=>{expect(clippedPaths([p(NaN,0),p(1e12,3),p(10,10),p(20,20),p(30,20)],100,60)).toEqual([[{x:10,y:10,visible:true},{x:20,y:20,visible:true},{x:30,y:20,visible:true}]]);});
});
