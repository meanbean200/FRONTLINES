// Diagnostic CPU replay of an actual browser save; not normal-control acceptance.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {TrenchNetwork} from '../src/garrison/TrenchNetwork';
import {networkRepresentatives} from '../src/ui/TrenchReadout';
import type {TrenchState} from '../src/core/types';
const file=process.argv[2];if(!file)throw Error('Supply a recorded browser save path.');
const raw=JSON.parse(readFileSync(file,'utf8')),state=new SaveSystem().parse(JSON.stringify(raw.state??raw)),sim=new BattlefieldSimulation(state);
state.simSpeed=1;const samples:{at:number;[key:string]:number}[]=[];
for(let i=0;i<1200&&!sim.commandsLocked;i++){sim.stepFixed();samples.push({at:state.elapsed,...sim.stepCosts});}
const summary:Record<string,unknown>={};for(const key of Object.keys(sim.stepCosts)){const list=samples.map(s=>s[key]).sort((a,b)=>a-b);summary[key]={mean:list.reduce((a,b)=>a+b,0)/list.length,p95:list[Math.floor(list.length*.95)],max:list.at(-1)};}
const matrix=[1,5,15,30,60].map(count=>{const trenches:TrenchState[]=Array.from({length:count},(_,i)=>({id:i+1,points:[{x:-1500+i*10,z:-1500},{x:-1490+i*10,z:-1500}],width:4.2,depth:1.75,progress:1,status:'complete'})),network=new TrenchNetwork();const started=performance.now();network.sync(trenches);const buildMs=performance.now()-started,times=[];
  for(let i=0;i<1000;i++){const t=performance.now();network.sync(trenches);networkRepresentatives(trenches,network);for(const t of trenches)network.component(t.id);times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {count,buildMs,steadyP95:times[950],representatives:networkRepresentatives(trenches,network).length};});
const report={source:resolve(file),kind:'Headless diagnostic replay and synthetic graph scaling, not browser acceptance',ticks:samples.length,simulationSeconds:samples.length*.05,finalStateHash:createHash('sha256').update(JSON.stringify(state)).digest('hex'),summary,worst:samples.slice().sort((a,b)=>b.total-a.total).slice(0,12),graphMatrix:matrix};
mkdirSync('output/position-command',{recursive:true});writeFileSync('output/position-command/'+(process.argv[3]??'cpu-profile')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
