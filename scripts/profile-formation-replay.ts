import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
import {SaveSystem} from '../src/persistence/SaveSystem';
const sums:Record<string,number>={},nav={calls:0,ms:0},started=performance.now();
function instrument(sim:BattlefieldSimulation){const plan=sim.navigation.plan.bind(sim.navigation);sim.navigation.plan=(...args)=>{const t=performance.now();nav.calls++;const result=plan(...args);nav.ms+=performance.now()-t;return result;};}
function step(sim:BattlefieldSimulation){sim.step(.05);for(const [key,v] of Object.entries(sim.stepCosts))sums[key]=(sums[key]??0)+v;}
const a=new BattlefieldSimulation(createOperation('advance'));instrument(a);
a.issueMove(a.state.squads.filter(q=>q.faction==='player').slice(0,3).map(q=>q.id),{x:-1180,z:-1400});
for(let i=0;i<800;i++)step(a);
const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));instrument(b);
for(let i=0;i<800;i++){step(a);step(b);}
console.log(JSON.stringify({ms:performance.now()-started,phases:sums,nav,identical:JSON.stringify(a.state)===JSON.stringify(b.state)},null,2));
