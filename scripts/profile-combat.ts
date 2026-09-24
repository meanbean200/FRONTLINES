import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
const sim=new BattlefieldSimulation(createOperation('advance'));
sim.issueMove(sim.state.squads.filter(q=>q.faction==='player').slice(0,3).map(q=>q.id),{x:-1180,z:-1400});
const start=performance.now();for(let n=0;n<900;n++)sim.step(.05);
console.log(JSON.stringify({wallMs:performance.now()-start,elapsed:sim.state.elapsed,shots:sim.state.operation!.shots,people:sim.state.soldiers.length}));
