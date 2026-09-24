import {writeFileSync,existsSync} from 'node:fs';
import {browserFixture} from './browser-fixture';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {localInventory,balance} from '../src/garrison/Inventory';
const target=process.argv[2]??'output/large-camp-diagnostic.json';
if(existsSync(target))throw new Error('Preserve prior diagnostic evidence.');
const sim=new BattlefieldSimulation(browserFixture(300)),history=new Map<number,unknown[]>(),rows:unknown[]=[],deaths:number[]=[];
sim.state.living!.lethalNeeds=true;
const snap=()=>{
  for(const s of sim.state.soldiers){
    const data=history.get(s.id)??[];
    data.push({at:sim.state.elapsed,p:[s.x,s.z],action:s.action,health:s.health,needs:{...s.needs},carried:{...s.carried},duty:s.duty?structuredClone(s.duty):undefined});
    if(data.length>30)data.shift();history.set(s.id,data);
  }
  rows.push({at:sim.state.elapsed,garrisons:sim.state.living!.garrisons.map(g=>({id:g.id,local:localInventory(sim.state,g),forward:{...g.forwardStock},watch:[g.watchPresent,g.watchRequired],people:sim.garrisons.people(g).reduce<Record<string,number>>((o,s)=>(o[s.action]=(o[s.action]??0)+1,o),{})})),metrics:{...sim.state.living!.metrics}});
};
for(let step=0;step<108000;step++){
  for(const g of sim.state.living!.garrisons)if(g.cutoff==='decision')sim.garrisons.resolveEmergency(g.id,'hold');
  sim.step(.05);
  if(step%500===0)snap();
  for(const s of sim.state.soldiers)if(s.needs!.life==='dead'&&!deaths.includes(s.id))deaths.push(s.id);
  if(deaths.length>=3)break;
}
snap();
const chosen=deaths.length?deaths:sim.state.soldiers.filter(s=>s.needs!.thirst>90).slice(0,3).map(s=>s.id);
writeFileSync(target,JSON.stringify({elapsed:sim.state.elapsed,deaths,rows,people:chosen.map(id=>({id,history:history.get(id)})),state:sim.state,currentHelpers:sim.state.soldiers.filter(s=>s.duty?.patientId!==undefined),balance:balance(sim.state)},null,2));
console.log(JSON.stringify({target,elapsed:sim.state.elapsed,deaths}));
