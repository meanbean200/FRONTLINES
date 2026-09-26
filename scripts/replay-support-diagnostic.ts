import {readFileSync,writeFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {requestPositionSupport} from '../src/combat/SupportWeapons';
// Fixture-specific investigation of the retained elapsed-707 raid snapshot.
// It did NOT reproduce the first live cancellation and is not acceptance QA.
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: tsx scripts/replay-support-diagnostic.ts raid-elapsed-707.json report.json');
const sim=new BattlefieldSimulation(new SaveSystem().parse(readFileSync(input,'utf8'))),s=sim.state;
if(s.elapsed>=777.95||!s.living?.facilities.some(f=>f.id===461&&f.artillery)||![321,312].every(id=>s.soldiers.some(p=>p.id===id)))throw Error('Requires the retained pre-GO raid snapshot with gun 461 and crew 321/312.');
sim.garrisons.setArtilleryFacing(461,Math.PI/2);s.simSpeed=1;
while(s.elapsed<777.9499)sim.step(.05);
const ready=requestPositionSupport(s,'mortarHE',461,{x:940.961019,z:972.91629},false,sim.terrain);
sim.signalPrepared();const rows:unknown[]=[];let before='';
for(let i=0;i<520;i++){
  sim.step(.05);const m=s.operation!.supportMissions!.at(-1),crew=s.soldiers.filter(p=>[321,312].includes(p.id));
  const key=JSON.stringify([m?.stage,...crew.map(p=>[p.duty?.since,p.duty?.arrivedAt,p.combat?.owner,p.action])]);
  if(key!==before){rows.push(structuredClone({elapsed:s.elapsed,mission:m,crew}));before=key;}
}
writeFileSync(output,JSON.stringify({ready,rows},null,2));console.log({ready,rows:rows.length,last:s.operation!.supportMissions!.at(-1)?.reason});
