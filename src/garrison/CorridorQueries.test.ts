import { describe, expect, it, vi } from 'vitest';
import { TrenchNetwork } from './TrenchNetwork';
import type { TrenchState, Vec2 } from '../core/types';

const trench=(id:number,points:Vec2[],width=4.2):TrenchState=>({id,points,width,depth:1.75,progress:1,status:'complete'});
const geometry=[trench(1,[{x:-80,z:-32},{x:80,z:-32}]),trench(2,[{x:-64,z:-80},{x:64,z:80}],8),trench(3,[{x:-31,z:31},{x:32,z:31},{x:32,z:65},{x:-31,z:65},{x:-31,z:31}],2),trench(4,[{x:35,z:31},{x:70,z:31}],12)];

describe('indexed corridor membership',()=>{
  it('records the interior leg of a loop even when both endpoints belong to older edges',()=>{
    const network=new TrenchNetwork();
    const trench=(id:number,points:{x:number;z:number}[])=>({id,points,width:2.2,depth:1.75,progress:1,status:'complete' as const});
    network.sync([trench(1,[{x:-100,z:0},{x:100,z:0}]),trench(2,[{x:0,z:0},{x:0,z:100}]),trench(3,[{x:40,z:0},{x:0,z:40}])]);
    const route=network.route({x:70,z:0},{x:0,z:70});
    expect(network.routeTrenches(route)).toContain(3);
    expect(route.some((p,i)=>i>0&&p.x!==route[i-1].x&&p.z!==route[i-1].z)).toBe(true);
  });
  it('matches exact full-edge clearance at signed cell boundaries, junctions, and end caps',()=>{
    const network=new TrenchNetwork();network.sync(geometry);
    const points:Vec2[]=[];
    for(let i=0;i<6000;i++)points.push({x:(i*73%20000)/100-100,z:(i*131%20000)/100-100});
    for(const e of network.edges)for(const endpoint of [network.nodes[e.a],network.nodes[e.b]])for(const delta of [-.00001,0,.00001])for(let angle=0;angle<8;angle++)points.push({x:endpoint.x+Math.cos(angle*Math.PI/4)*(e.width*.43+delta),z:endpoint.z+Math.sin(angle*Math.PI/4)*(e.width*.43+delta)});
    for(const p of points)expect(network.corridorContains(p)).toBe(network.corridorClearance(p)<=0);
  });
  it('rebuilds membership after excavation, replacement, and removed corridors',()=>{
    const network=new TrenchNetwork(),line=trench(1,[{x:-96,z:32},{x:96,z:32}]);line.progress=.25;network.sync([line]);
    expect(network.corridorContains({x:64,z:32})).toBe(false);
    line.progress=1;network.sync([line]);expect(network.corridorContains({x:64,z:32})).toBe(true);
    network.sync([trench(2,[{x:32,z:-96},{x:32,z:96}],10)]);
    expect(network.corridorContains({x:64,z:32})).toBe(false);
    expect(network.corridorContains({x:36,z:64})).toBe(true);
    network.sync([]);expect(network.corridorContains({x:36,z:64})).toBe(false);
  });
  it('does not scan every edge for a membership-only query',()=>{
    const network=new TrenchNetwork();network.sync(geometry);
    const fullScan=vi.spyOn(network,'corridorClearance');
    expect(network.corridorContains({x:0,z:-32})).toBe(true);
    expect(network.corridorContains({x:3000,z:3000})).toBe(false);
    expect(fullScan).not.toHaveBeenCalled();
  });
});
