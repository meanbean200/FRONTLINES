import {existsSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {browserFixture} from './browser-fixture';
import {createStudyScenario} from '../src/garrison/StudyScenario';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {balance} from '../src/garrison/Inventory';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import {createBattlefield,createPlayableSandbox} from '../src/simulation/createBattlefield';
const count=Number(process.argv[2]??300),target=process.argv[3]??'output/garrison-soak.json';
if(existsSync(target))throw Error('Preserve prior evidence; choose a new output.');
const fingerprint=createHash('sha256');
const sourceFiles=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(join(dir,entry.name)):entry.name.endsWith('.ts')&&!entry.name.endsWith('.test.ts')?[join(dir,entry.name)]:[]);
for(const path of [...sourceFiles('src'),'scripts/browser-fixture.ts','scripts/soak-garrisons.ts'].sort())fingerprint.update(path.replaceAll('\\','/')).update(readFileSync(path));
const sourceHash=fingerprint.digest('hex');
const sim=count===48?createStudyScenario(1944,2):new BattlefieldSimulation(count===28?createPlayableSandbox():count===224?createBattlefield():browserFixture(count));
if(count===224||count===28)sim.assignGarrison([sim.state.squads[0].id,sim.state.squads[1].id,sim.state.squads.find(s=>s.kind==='engineer')!.id],sim.state.trenches[0].id);
sim.state.living!.lethalNeeds=true;
const started=performance.now(),samples:unknown[]=[];let emergencies=0;
const progress=new Map<number,{x:number;z:number;at:number}>();let longestTravelStall=0,maxRoutePoints=0,failure:string|undefined;
let worstTravelStall:unknown;
try {for(let i=0;i<108000;i++){
  for(const g of sim.state.living!.garrisons)if(g.cutoff==='decision'){sim.garrisons.resolveEmergency(g.id,'hold');emergencies++;}
  sim.step(.05);
  if(i%20===0)for(const s of sim.state.soldiers){
    maxRoutePoints=Math.max(maxRoutePoints,s.duty?.route.length??0);
    if(!s.duty||s.duty.arrivedAt!==undefined||s.needs!.life!=='active'){progress.delete(s.id);continue;}
    const previous=progress.get(s.id);
    if(!previous||Math.hypot(previous.x-s.x,previous.z-s.z)>1.5)progress.set(s.id,{x:s.x,z:s.z,at:sim.state.elapsed});
    else if(sim.state.elapsed-previous.at>longestTravelStall){longestTravelStall=sim.state.elapsed-previous.at;if(longestTravelStall>120)worstTravelStall={id:s.id,at:sim.state.elapsed,x:s.x,z:s.z,duty:structuredClone(s.duty),energy:s.needs!.energy};}
  }
  if(i%9000===0){(globalThis as {gc?:()=>void}).gc?.();samples.push({at:sim.state.elapsed,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,serializedBytes:JSON.stringify(sim.state).length,deaths:sim.state.living!.metrics.deaths,taskChanges:sim.state.soldiers.reduce((n,s)=>n+s.needs!.taskChanges,0),worstBlocked:Math.max(...sim.state.soldiers.map(s=>s.duty?.blockedFor??0))});console.error(`Soak ${count}: ${(i/1500).toFixed(0)}/72 campaign hours; ${sim.state.living!.metrics.deaths} deaths`);}
}}catch(error){failure=error instanceof Error?error.stack:String(error);console.error(failure);process.exitCode=1;}
(globalThis as {gc?:()=>void}).gc?.();
const ledger=balance(sim.state),blocked=sim.state.soldiers.filter(s=>(s.duty?.blockedFor??0)>120);
const stalled=[...progress].filter(([,p])=>sim.state.elapsed-p.at>120).map(([id])=>id);
const taskChanges=sim.state.soldiers.map(s=>s.needs!.taskChanges);
const result={rules:RULES_VERSION,sourceHash,count,hours:sim.state.elapsed/75,failure,wallSeconds:(performance.now()-started)/1000,emergencies,metrics:sim.state.living!.metrics,ledger,blocked:blocked.map(s=>s.id),stalled,longestTravelStall,worstTravelStall,maxRoutePoints,taskChanges:{total:taskChanges.reduce((a,b)=>a+b,0),max:Math.max(...taskChanges)},samples,finalHeap:process.memoryUsage().heapUsed,criteria:{completed:!failure&&sim.state.elapsed>=5399.99,noDeaths:sim.state.living!.metrics.deaths===0,conservation:Object.values(ledger).every(n=>Math.abs(n)<1e-5),noLongBlockedDuties:blocked.length===0&&stalled.length===0},state:sim.state};
writeFileSync(target,JSON.stringify(result));console.log(JSON.stringify({...result,state:undefined}));
