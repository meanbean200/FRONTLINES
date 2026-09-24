import {readFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
const file=JSON.parse(readFileSync(process.argv[2],'utf8')),sim=new BattlefieldSimulation(file.evidence?.state??file);sim.state.simSpeed=1;
const at=performance.now(),times:number[]=[];for(let i=0;i<600;i++){const start=performance.now();sim.step(.05);times.push(performance.now()-start);}times.sort((a,b)=>a-b);console.log({seconds:(performance.now()-at)/1000,elapsed:sim.state.elapsed,p50:times[300],p95:times[570],max:times[599]});
