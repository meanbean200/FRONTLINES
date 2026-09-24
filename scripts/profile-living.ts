import { performance } from 'node:perf_hooks';
import { browserFixture } from './browser-fixture';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';

// Diagnostic only: same frozen simulation, no rule changes or replacement physics.
const count=Number(process.argv[2]??1000),speed=Number(process.argv[3]??5),seconds=Number(process.argv[4]??25);
if(!Number.isInteger(count)||count<1||count>1000||![1,5].includes(speed)||!Number.isFinite(seconds)||seconds<=0||seconds>60)throw new Error('Expected count 1..1000, speed 1/5, and 0..60 real seconds.');
const sim=new BattlefieldSimulation(browserFixture(count));sim.state.simSpeed=speed;
const samples:number[]=[],start=performance.now();
for(let i=0;i<seconds/.05;i++){
  const begin=performance.now();sim.step(.05);samples.push(performance.now()-begin);
}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({count,speed,elapsed:sim.state.elapsed,wallSeconds:(performance.now()-start)/1000,steps:samples.length,meanStepMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95StepMs:samples[Math.floor(samples.length*.95)]}));
