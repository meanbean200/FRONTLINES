// Headless diagnostic replay, NOT normal-controls acceptance evidence.
import {readFileSync,writeFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance} from '../src/garrison/Inventory';
import {workReadout} from '../src/ui/PositionReadout';
const [source,target,seconds='600']=process.argv.slice(2);
const sim=new BattlefieldSimulation(new SaveSystem().parse(readFileSync(source,'utf8')));
sim.setSpeed(1);
const samples=[];
for(let step=0;step<=Number(seconds)*20;step++){
  if(step%1200===0){const s=sim.state;const jobs=s.living!.facilities.filter(f=>f.workOrder?.explicit);const row={at:s.elapsed,balance:balance(s),trenches:s.trenches.filter(t=>t.engineerSquadId).map(t=>({id:t.id,p:t.progress})),jobs:jobs.map(f=>({id:f.id,kind:f.kind,p:f.progress,readout:workReadout(s,f),workers:f.workOrder!.workerIds.map(id=>{const p=s.soldiers.find(s=>s.id===id)!;return {id,tools:p.equipment?.tools,x:p.x,z:p.z,action:p.action,duty:p.duty,carried:p.carried,energy:p.needs?.energy};})}))};samples.push(row);console.log(JSON.stringify({at:row.at,jobs:row.jobs.map(j=>({id:j.id,p:j.p,status:j.readout.status,reason:j.readout.reason})),trenches:row.trenches}));}
  sim.step(.05);
}
writeFileSync(target,JSON.stringify({diagnosticReplay:true,source,samples,state:sim.state},null,2));
