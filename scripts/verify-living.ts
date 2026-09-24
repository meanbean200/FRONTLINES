import {createStudyScenario} from '../src/garrison/StudyScenario';
import {balance} from '../src/garrison/Inventory';
import {SaveSystem} from '../src/persistence/SaveSystem';
const sim=createStudyScenario(1944,2),start=performance.now();
const hours=Number(process.argv[2]??72),steps=Math.round(hours*75/.05);
for(let i=0;i<steps;i++){
  if(sim.state.simSpeed===0){for(const g of sim.state.living!.garrisons)if(g.cutoff==='decision')sim.garrisons.resolveEmergency(g.id,'hold');}
  sim.step(.05);
}
const w=sim.state.living!;
console.log(JSON.stringify({hours,wallSeconds:(performance.now()-start)/1000,metrics:w.metrics,balance:balance(sim.state),garrisons:w.garrisons,facilities:w.facilities,trucks:w.trucks.map(t=>({state:t.state,position:[t.x,t.z],cargo:t.cargo,reason:t.reason})),soldiers:sim.state.soldiers.map(s=>({id:s.id,p:[s.x,s.z],energy:s.needs!.energy,hunger:s.needs!.hunger,thirst:s.needs!.thirst,sleep:s.needs!.sleepHours,watch:s.needs!.watchHours,activity:s.action,blocked:s.duty?.blockedFor,route:s.duty?.routeIndex,arrived:s.duty?.arrivedAt}))},null,2));
new SaveSystem().parse(JSON.stringify(sim.state));
if(Object.values(balance(sim.state)).some(n=>Math.abs(n)>1e-5))throw new Error('Inventory conservation failed');
