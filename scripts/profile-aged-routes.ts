import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { SaveSystem } from '../src/persistence/SaveSystem';
import { balance } from '../src/garrison/Inventory';
import { RULES_VERSION } from '../src/garrison/GarrisonPolicy';
import type { Vec2 } from '../src/core/types';

// Bounded diagnostic wrapper around the real navigation implementation. No
// altered paths, timers, needs or world state; timings include wrapper overhead.
const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw Error('Provide a source save and a new evidence filename.');
const raw=readFileSync(input,'utf8'),payload=JSON.parse(raw),sim=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(payload.final??payload)));sim.state.simSpeed=5;
const calls:{at:number;start:Vec2;goal:Vec2;avoid:boolean;wallMs:number;waypoints:number;caller?:string}[]=[];
const original=sim.navigation.plan.bind(sim.navigation);
sim.navigation.plan=(start,goal,avoid)=>{
  const at=performance.now(),route=original(start,goal,avoid),wallMs=performance.now()-at;
  calls.push({at:sim.state.elapsed,start:{x:start.x,z:start.z},goal:{x:goal.x,z:goal.z},avoid:Boolean(avoid),wallMs,waypoints:route.length,caller:wallMs>10?new Error().stack:undefined});
  return route;
};
const began=performance.now();for(let i=0;i<20;i++)sim.step(.05);
const wallMs=performance.now()-began,stateHash=createHash('sha256').update(JSON.stringify(sim.state)).digest('hex');
const result={rules:RULES_VERSION,input,inputHash:createHash('sha256').update(raw).digest('hex'),elapsed:sim.state.elapsed,wallMs,stateHash,ledger:balance(sim.state),routeCount:calls.length,routeMs:calls.reduce((n,c)=>n+c.wallMs,0),failed:calls.filter(c=>!c.waypoints).length,calls};
writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({...result,calls:[...calls].sort((a,b)=>b.wallMs-a.wallMs).slice(0,5)}));
