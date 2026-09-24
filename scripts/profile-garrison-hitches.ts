import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance} from '../src/garrison/Inventory';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import type {Vec2} from '../src/core/types';

// Actual fixed-tick simulation, bounded by 100 simulation seconds / 45 wall
// seconds. Instrumentation observes searches; it never alters routes or state.
const input=process.argv[2],output=process.argv[3];
if(!input||!output||existsSync(output))throw Error('Provide a source save and a new evidence filename.');
const raw=readFileSync(input,'utf8'),payload=JSON.parse(raw),sim=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(payload.final??payload.state??payload)));sim.state.simSpeed=5;
const startElapsed=sim.state.elapsed,steps:{at:number;wallMs:number}[]=[],calls:{at:number;start:Vec2;goal:Vec2;avoid:boolean;wallMs:number;waypoints:number}[]=[];
const original=sim.navigation.plan.bind(sim.navigation);
sim.navigation.plan=(start,goal,avoid)=>{
  const began=performance.now(),route=original(start,goal,avoid);
  calls.push({at:sim.state.elapsed,start:{...start},goal:{...goal},avoid:Boolean(avoid),wallMs:performance.now()-began,waypoints:route.length});return route;
};
const began=performance.now();
while(sim.state.elapsed-startElapsed<100-1e-6&&performance.now()-began<45000&&sim.state.simSpeed>0){
  const at=sim.state.elapsed,start=performance.now();sim.step(.05);steps.push({at,wallMs:performance.now()-start});
}
const wallMs=performance.now()-began,final=sim.state;
const result={rules:RULES_VERSION,input,inputHash:createHash('sha256').update(raw).digest('hex'),startElapsed,elapsed:final.elapsed,wallMs,stateHash:createHash('sha256').update(JSON.stringify(final)).digest('hex'),ledger:balance(final),routeCount:calls.length,routeMs:calls.reduce((sum,c)=>sum+c.wallMs,0),failed:calls.filter(c=>!c.waypoints).length,steps,calls,final};
writeFileSync(output,JSON.stringify(result),{flag:'wx'});
console.log(JSON.stringify({...result,steps:[...steps].sort((a,b)=>b.wallMs-a.wallMs).slice(0,10),calls:[...calls].sort((a,b)=>b.wallMs-a.wallMs).slice(0,10),final:undefined}));
