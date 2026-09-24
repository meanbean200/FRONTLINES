import {existsSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {balance} from '../src/garrison/Inventory';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {combatWound} from '../src/combat/Casualties';
import {roadPoint} from '../src/garrison/LogisticsSystem';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import {isDeepStrictEqual} from 'node:util';

const target=process.argv[2];if(!target||existsSync(target))throw Error('Choose an unused evidence path');
const hash=createHash('sha256');const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')?[join(dir,e.name)]:[]);for(const p of files('src').sort())hash.update(p).update(readFileSync(p));
let sim=new BattlefieldSimulation(createOperation('campaign'));const save=new SaveSystem(),start=performance.now(),hours=sim.state.living!.campaignHours;
// Controlled persistence soak: hold both home lines, inject documented wounds,
// and physically sever/restore the road. It is not an AI-victory or balance test.
sim.state.operation!.nextOrders=1e9;sim.state.living!.lethalNeeds=true;
const injected:number[]=[],samples:unknown[]=[],checks:{at:number;exact:boolean}[]=[];let nextSample=450,nextWound=120,cutId=0,cut=false,restored=false,error:string|undefined,emergencies=0;
try{while(sim.state.elapsed<5400){
  if(performance.now()-start>1800000)throw Error('Local 30-minute test budget reached');
  const s=sim.state,w=s.living!;
  for(const g of w.garrisons)if(g.cutoff==='decision'){sim.garrisons.resolveEmergency(g.id,'hold');emergencies++;}
  for(const d of s.operation!.rescueDecisions??[])if(d.choice==='pending'){d.choice='hold';d.reviewAt=s.elapsed+30;}
  if(s.elapsed>=nextWound&&injected.length<8){const p=s.soldiers.find(p=>p.needs!.life==='active'&&!injected.includes(p.id)&&s.squads.find(q=>q.id===p.squadId)!.kind==='rifle')!;combatWound(s,p,{id:100000+injected.length,at:s.elapsed,shooterId:0,squadId:0,from:{x:p.x+3,z:p.z,y:0},to:{x:p.x,z:p.z,y:0},hitId:p.id,energy:1});injected.push(p.id);nextWound+=450;}
  if(!cut&&s.elapsed>=600){const p=roadPoint(-2050);cutId=s.nextEntityId++;s.trenches.push({id:cutId,points:[{x:p.x,z:p.z-10},{x:p.x,z:p.z+10}],width:5,depth:2,progress:1,status:'complete'});cut=true;}
  if(!restored&&s.elapsed>=1050){s.trenches=s.trenches.filter(t=>t.id!==cutId);restored=true;}
  sim.setSpeed(1);sim.step(.05);
  if(s.elapsed>=nextSample){
    const clone=new BattlefieldSimulation(save.parse(JSON.stringify(s)));
    for(let n=0;n<10;n++){sim.step(.05);clone.step(.05);}
    const exact=isDeepStrictEqual(JSON.parse(JSON.stringify(sim.state)),JSON.parse(JSON.stringify(clone.state)));checks.push({at:sim.state.elapsed,exact});if(!exact){writeFileSync(target+'.divergence.json',JSON.stringify({original:sim.state,loaded:clone.state}),{flag:'wx'});throw Error('Save continuation diverged');}sim=clone;
    const ledger=balance(sim.state),r=sim.state.operation!.campaign!.replacements!;
    if(Object.values(ledger).some(n=>Math.abs(n)>1e-5))throw Error('Inventory conservation failed');
    if(sim.state.soldiers.length!==96+r.manifests.filter(m=>!m.returning&&m.stage==='arrived').length)throw Error('Personnel conservation failed');
    samples.push({elapsed:sim.state.elapsed,ledger,people:sim.state.soldiers.length,deaths:sim.state.living!.metrics.deaths,wounds:sim.state.soldiers.filter(p=>p.combat?.wound).map(p=>({id:p.id,care:p.combat!.wound!.care,severity:p.combat!.wound!.severity})),trucks:sim.state.living!.trucks.map(t=>({id:t.id,state:t.state,reason:t.reason})),pending:r.manifests.filter(m=>m.stage!=='arrived').length,taskChanges:sim.state.soldiers.reduce((n,p)=>n+p.needs!.taskChanges,0),heap:process.memoryUsage().heapUsed});
    console.error(`Combat soak: ${(sim.state.living!.campaignHours-hours).toFixed(1)}/72 campaign hours; ${sim.state.living!.metrics.deaths} deaths; ledger conserved`);nextSample+=450;
  }
}}
catch(e){error=e instanceof Error?e.stack:String(e);process.exitCode=1;}
const result={rules:RULES_VERSION,sourceHash:hash.digest('hex'),scope:'96-person controlled home-line campaign; injected physical wounds and 6-hour road cutoff; not autonomous battle balance',hours:sim.state.living!.campaignHours-hours,wallSeconds:(performance.now()-start)/1000,error,injected,emergencies,cut,restored,checks,samples,ledger:balance(sim.state),state:sim.state};writeFileSync(target,JSON.stringify(result),{flag:'wx'});console.log(JSON.stringify({...result,state:undefined,samples:undefined}));
