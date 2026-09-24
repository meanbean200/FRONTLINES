import {readFileSync,writeFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {distance,type Vec2} from '../src/core/types';

const [input,output,idText='947']=process.argv.slice(2);
if(!input||!output)throw Error('Source and new diagnostic filename required');
const raw=JSON.parse(readFileSync(input,'utf8')),sim=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(raw.final??raw)));
const s=sim.state.soldiers.find(s=>s.id===Number(idText))!,g=sim.state.living!.garrisons.find(g=>g.id===s.garrisonId)!;
const start={x:s.x,z:s.z},goal=g.entrance,avoid=(p:Vec2)=>sim.garrisons.network.corridorContains(p)&&distance(p,goal)>3;
const route=s.duty!.route.slice(s.duty!.route.findIndex(p=>distance(p,goal)<.15)).reverse();
const trace=route.map((p,i)=>{
  const from=i?route[i-1]:start,steps=Math.max(1,Math.ceil(distance(from,p)));let firstBlock:unknown;
  for(let step=1;step<=steps;step++){
    const at={x:from.x+(p.x-from.x)*step/steps,z:from.z+(p.z-from.z)*step/steps};
    if(avoid(at)){const hit=sim.garrisons.network.nearest(at);firstBlock={at,trenches:hit?sim.garrisons.network.edges[hit.edge].trenches:[]};break;}
  }
  return {from,to:p,clear:sim.navigation.segmentClear(from,p,2,avoid),firstBlock};
});
const run=(from:Vec2,to:Vec2)=>{
  let costCalls=0,closest=Infinity,goalChecks=0;const cost=sim.terrain.navigationCostAt.bind(sim.terrain),clear=sim.navigation.segmentClear.bind(sim.navigation);
  sim.terrain.navigationCostAt=(x,z)=>{costCalls++;closest=Math.min(closest,distance({x,z},to));return cost(x,z);};
  sim.navigation.segmentClear=(a,b,c,v)=>{if(distance(b,to)<.01)goalChecks++;return clear(a,b,c,v);};
  const begin=performance.now(),path=sim.navigation.plan(from,to,avoid),wallMs=performance.now()-begin;
  sim.terrain.navigationCostAt=cost;sim.navigation.segmentClear=clear;
  return {from,to,path,wallMs,costCalls,closest,goalChecks,valid:path.length>0&&path.every((p,i)=>clear(i?path[i-1]:from,p,2,avoid))};
};
const result={input,id:s.id,trace,forward:run(start,goal),reverse:run(goal,start)};
writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
