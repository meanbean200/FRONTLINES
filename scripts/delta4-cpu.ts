// V8 CPU profiling of an explicitly synthetic busy save. No player profile.
import {readFileSync,writeFileSync} from 'node:fs';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
const sim=new BattlefieldSimulation(new SaveSystem().parse(readFileSync(process.argv[2],'utf8')));
sim.tickProfile.setEnabled(true);
for(let i=0;i<Number(process.argv[3]??200);i++)sim.stepFixed();
const ticks=sim.tickProfile.read(),keys=Object.keys(ticks[0]).filter(k=>!['at','sequence'].includes(k));
console.log(JSON.stringify({at:sim.state.elapsed,shots:sim.state.operation?.shots,costs:Object.fromEntries(keys.map(k=>[k,ticks.reduce((n,t)=>n+t[k],0)/ticks.length])),traces:sim.terrain.objects.counts,paths:sim.navigation.counts}));
if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify({ticks,state:sim.state}),{flag:'wx'});
