import {existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {browserFixture} from './browser-fixture';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {balance} from '../src/garrison/Inventory';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';

const count=Number(process.argv[2]??300),seconds=Number(process.argv[3]??600);
if(!Number.isInteger(count)||count<1||count>1000||!Number.isFinite(seconds)||seconds<0||seconds>5400)throw new Error('Invalid fixture size/duration');
const target=resolve(process.argv[4]??`output/living-${count}-aged.json`);
if(existsSync(target))throw new Error('Refusing to replace an existing QA fixture');
const sim=new BattlefieldSimulation(browserFixture(count)),started=performance.now();
let emergencies=0;
for(let i=0;i<seconds/.05;i++){
  for(const g of sim.state.living!.garrisons)if(g.cutoff==='decision'){sim.garrisons.resolveEmergency(g.id,'hold');emergencies++;}
  sim.step(.05);
}
writeFileSync(target,JSON.stringify(sim.state));
console.log(JSON.stringify({rules:RULES_VERSION,target,count,elapsed:sim.state.elapsed,wallSeconds:(performance.now()-started)/1000,emergencies,metrics:sim.state.living!.metrics,balance:balance(sim.state),activities:sim.state.soldiers.reduce<Record<string,number>>((counts,s)=>(counts[s.action]=(counts[s.action]??0)+1,counts),{})}));
