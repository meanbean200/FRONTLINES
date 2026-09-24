import {createInterface} from 'node:readline';
import {createStudyScenario} from '../src/garrison/StudyScenario';
import {observation,OBSERVATION_VERSION,RULES_VERSION} from '../src/garrison/GarrisonPolicy';
import {balance} from '../src/garrison/Inventory';
import type {PolicyKind} from '../src/garrison/types';
let sim=createStudyScenario(),startHours=8,scenario=0,mode:PolicyKind='rules',blockade:number|undefined,cutoffStarted=false,totalSleepHours=0;
const snapshot=()=>{
  const w=sim.state.living!,people=sim.state.soldiers,g=w.garrisons[0];
  return {observation:observation(sim.state,g,people),metrics:{...w.metrics,totalSleepHours,soldiers:people.length,maxBlockedSeconds:Math.max(0,...people.map(s=>s.duty?.blockedFor??0)),taskChanges:people.reduce((n,s)=>n+s.needs!.taskChanges,0),interruptedSleep:people.reduce((n,s)=>n+s.needs!.interruptedSleep,0),sleepHours:people.reduce((n,s)=>n+s.needs!.sleepHours,0),alive:people.filter(s=>s.needs!.life!=='dead').length,watch:g.watchPresent,required:g.watchRequired,food:g.cache.food,water:g.cache.water},hours:w.campaignHours-startHours,balance:balance(sim.state)};
};
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{
    const r=JSON.parse(line);
    if(r.command==='close')break;
    if(r.command==='reset'){
      scenario=r.scenario??0;sim=createStudyScenario(r.seed??1944,scenario,r.size??24);mode=r.mode??'rules';sim.state.living!.garrisons[0].policy=mode;startHours=sim.state.living!.campaignHours;blockade=undefined;cutoffStarted=false;totalSleepHours=0;
      console.log(JSON.stringify({...snapshot(),observationVersion:OBSERVATION_VERSION,rulesVersion:RULES_VERSION}));continue;
    }
    if(r.command==='state'){console.log(JSON.stringify(sim.state));continue;}
    if(r.command==='step'){
      const before=snapshot().metrics,g=sim.state.living!.garrisons[0];
      if(mode!=='rules')sim.garrisons.policyActions.set(g.id,{at:sim.state.elapsed,action:r.action,modelId:'study'});
      for(let i=0;i<100;i++){
        if(scenario===3&&sim.state.elapsed>=450&&!cutoffStarted){cutoffStarted=true;blockade=sim.createCrater({x:-2300,z:-1330+Math.sin(-2300/530)*30},12,3);}
        if(scenario===3&&sim.state.elapsed>=2100&&blockade!==undefined){sim.state.craters=sim.state.craters.filter(c=>c.id!==blockade);blockade=undefined;}
        if(scenario===1)for(const f of sim.state.living!.facilities)if(f.kind!=='store')f.capacity=2;
        if(sim.state.simSpeed===0)sim.garrisons.resolveEmergency(g.id,'hold');
        if(scenario===5&&sim.state.elapsed>600&&sim.state.elapsed<900&&g.readiness!=='alert')sim.garrisons.setReadiness(g.id,'alert');
        if(scenario===5&&sim.state.elapsed>=900&&g.readiness!=='routine')sim.garrisons.setReadiness(g.id,'routine');
        sim.step(.05);
        totalSleepHours+=sim.state.soldiers.filter(s=>s.action==='sleeping').length*.05*24/1800;
      }
      const after=snapshot(),m=after.metrics,n=sim.state.soldiers.length;
      const reward=1-4*(m.watchGapHours-before.watchGapHours)/(n/15)-3*(m.criticalNeedHours-before.criticalNeedHours)/(n/15)-10*(m.deaths-before.deaths)/n-.002*(m.distance-before.distance)/n-.03*(m.taskChanges-before.taskChanges)/n-.05*(m.interruptedSleep-before.interruptedSleep)/n;
      console.log(JSON.stringify({...after,reward,terminated:m.alive===0,truncated:after.hours>=72}));continue;
    }
    throw new Error('Unknown host command');
  }catch(error){console.log(JSON.stringify({error:String(error)}));}
}
