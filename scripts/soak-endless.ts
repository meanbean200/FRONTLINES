import {existsSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {defaultBattleSetup,resolveBattleSetup} from '../src/operations/BattleSetup';
import {createOperationalBattle} from '../src/operations/createOperationalBattle';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {balance} from '../src/garrison/Inventory';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {requestSupport} from '../src/combat/SupportWeapons';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import {renderedPersonnel} from '../src/render/PersonnelVisibility';

const target=process.argv[2],duration=Number(process.argv[3]??1800);
if(!target||existsSync(target)||!Number.isFinite(duration)||duration<30||duration>5400)throw Error('Use an unused evidence path and 30–5400 simulation seconds.');
const hash=createHash('sha256'),files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')?[join(dir,e.name)]:[]);
for(const p of files('src').sort())hash.update(p).update(readFileSync(p));
const setup=resolveBattleSetup({...defaultBattleSetup(),operation:'open-front',map:'seed',seed:1944,battleMode:'endless',calendarDayMinutes:10,endless:{reinforcements:'continuous',pressure:'standard'}},1944);
let sim=new BattlefieldSimulation(createOperationalBattle('open-front',1944,setup,true));
const initialHour=sim.state.living!.campaignHours,start=performance.now(),samples:unknown[]=[],checks:unknown[]=[],orders:unknown[]=[],costs:number[]=[];
let nextSample=150,nextOrder=0,nextSupport=0,error:string|undefined,construction:number|undefined,shots=0,impacts=0,lastMission=0,returned=false,returnStarted=false,nextReoccupy=1050;
const home=sim.state.trenches[0],worker=sim.state.squads.filter(q=>q.faction!=='enemy')[2];
const p=home.points.at(-1)!;
construction=sim.createTrench([{x:p.x+8,z:p.z+12},{x:p.x+28,z:p.z+12}],worker.id);
orders.push({at:0,type:'construction',id:construction??null});
try{while(sim.state.elapsed<duration){
  if(performance.now()-start>20*60*1000)throw Error('Local 20-minute test wall-time bound reached');
  const s=sim.state,op=s.operation!,w=s.living!;
  if(op.status!=='active')throw Error('Unexpected Endless result');
  for(const g of w.garrisons)if(g.cutoff==='decision')sim.garrisons.resolveEmergency(g.id,'hold');
  for(const d of op.rescueDecisions??[])if(d.choice==='pending'){d.choice='hold';d.reviewAt=s.elapsed+30;}
  if(!returnStarted&&s.elapsed>=1050){
    const ids=s.squads.filter(q=>q.faction!=='enemy').slice(0,2).map(q=>q.id);
    // Cross-map movement uses the normal planner, then the local entry order.
    // Direct distant garrison entry was rejected in preserved attempt 2.
    const goal=home.points[Math.floor(home.points.length/2)];sim.issueMove(ids,goal);returnStarted=true;
    orders.push({at:s.elapsed,type:'return-march',ids,goal});
  }
  if(returnStarted&&!returned&&s.elapsed>=nextReoccupy){
    nextReoccupy=s.elapsed+30;
    const squads=s.squads.filter(q=>q.faction!=='enemy').slice(0,2),goal=home.points[Math.floor(home.points.length/2)];
    if(squads.every(q=>Math.hypot(q.x-goal.x,q.z-goal.z)<80)){
      const ids=squads.map(q=>q.id),accepted=sim.issueOccupyNearest(ids,home.id);returned=accepted!==undefined;
      orders.push({at:s.elapsed,type:'return-to-position',ids,trench:accepted??null,reason:sim.garrisons.lastAssignment.reason});
    }
  }
  if(!returnStarted&&s.elapsed>=nextOrder){
    nextOrder=s.elapsed+360;
    // Deterministic player intent using public landmarks, not opposing positions.
    const goal=op.objectives.find(o=>o.name==='SAINT-MARTIN')!,q=s.squads.filter(q=>q.faction!=='enemy').slice(0,2);
    sim.issueMove(q.map(q=>q.id),goal);orders.push({at:s.elapsed,type:'move',ids:q.map(q=>q.id),goal:{x:goal.x,z:goal.z}});
  }
  if(s.elapsed>=nextSupport){
    nextSupport=s.elapsed+30;
    const report=op.intelligence?.command.player.find(c=>c.visible&&s.elapsed-c.lastSeen<12);
    if(report)for(const q of s.squads.filter(q=>q.faction!=='enemy'))requestSupport(s,'mortarHE',q.id,{x:report.x,z:report.z},false,sim.terrain,'PLAYER');
  }
  const at=performance.now();sim.step(.05);costs.push(performance.now()-at);
  for(const m of op.supportMissions??[])if(m.id>lastMission&&m.stage==='complete'){impacts++;lastMission=m.id;}
  shots=op.shots;
  if(s.elapsed+.00001>=nextSample){
    const clone=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(s)));
    for(let i=0;i<10;i++){sim.step(.05);clone.step(.05);}
    const exact=isDeepStrictEqual(JSON.parse(JSON.stringify(sim.state)),JSON.parse(JSON.stringify(clone.state)));checks.push({at:sim.state.elapsed,exact});
    if(!exact){writeFileSync(target+'.divergence.json',JSON.stringify({original:sim.state,loaded:clone.state}),{flag:'wx'});throw Error('Save continuation divergence');}
    sim=clone;
    const ledger=balance(sim.state);if(Object.values(ledger).some(v=>Math.abs(v)>1e-5))throw Error('Inventory conservation failure');
    costs.sort((a,b)=>a-b);
    const live=sim.state,counts={people:live.soldiers.length,alive:live.soldiers.filter(p=>p.needs!.life!=='dead').length,renderEligible:renderedPersonnel(live).length,crates:live.living!.crates.length,trucks:live.living!.trucks.length,trenches:live.trenches.length,facilities:live.living!.facilities.length,craters:live.craters.length,manifests:live.operation!.campaign!.replacements!.manifests.length,history:live.operation!.endless!.history.length,aiPlans:live.operation!.enemyAI?.plans.length??0,shells:live.operation!.supportMissions?.filter(m=>m.stage==='flight').length??0,pathPoints:live.squads.reduce((n,q)=>n+q.route.length,0)};
    const sample={at:live.elapsed,hour:live.living!.campaignHours,shots,impacts,counts,heap:process.memoryUsage().heapUsed,serializedBytes:JSON.stringify(live).length,stepP95:costs[Math.floor(costs.length*.95)],ledger,captured:live.operation!.endless!.statistics.captured,director:live.operation!.endless!.director.phase,construction:live.trenches.find(t=>t.id===construction)?.progress};
    samples.push(sample);costs.length=0;nextSample+=150;
    console.log(JSON.stringify({...sample,ledger:undefined}));
  }
}}
catch(e){error=e instanceof Error?e.stack:String(e);process.exitCode=1;}
const final=sim.state,statistics=final.operation!.endless!.statistics;
const result={rules:RULES_VERSION,sourceHash:hash.digest('hex'),scope:'96-person production Endless, 10-minute calendar, public-landmark player commands; no fabricated casualties, captures, stock, weapons or enemy contacts',hours:final.living!.campaignHours-initialHour,wallSeconds:(performance.now()-start)/1000,error,orders,checks,samples,
  criteria:{completed:!error&&final.elapsed>=duration-.001,combat:shots>0,artillery:impacts>0,construction:!!construction&&((final.trenches.find(t=>t.id===construction)?.progress??0)>0),capture:statistics.captured.player+statistics.captured.enemy>0,recapture:statistics.lost.player+statistics.lost.enemy>0,reinforcements:final.operation!.campaign!.replacements!.manifests.some(m=>m.stage==='arrived'),conservation:Object.values(balance(final)).every(v=>Math.abs(v)<1e-5)},state:final};
writeFileSync(target,JSON.stringify(result),{flag:'wx'});console.log(JSON.stringify({...result,state:undefined,samples:undefined}));
