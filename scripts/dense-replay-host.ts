/** High-frequency capture from the shipping simulation, checked against the frozen study host. */
import {createInterface} from 'node:readline';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {observation} from '../src/garrison/GarrisonPolicy';

let sim:BattlefieldSimulation|undefined;
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{
    const request=JSON.parse(line);
    if(request.command==='close')break;
    if(request.command==='initialize'){
      sim=new BattlefieldSimulation(request.state);
      console.log(JSON.stringify({ready:true}));continue;
    }
    if(!sim)throw new Error('Initialize a frozen night-scenario snapshot first.');
    if(request.command==='state'){console.log(JSON.stringify(sim.state));continue;}
    if(request.command!=='step')throw new Error('Unknown capture command.');
    const g=sim.state.living!.garrisons[0],frames=[];
    if(g.policy!=='rules')sim.garrisons.policyActions.set(g.id,{at:sim.state.elapsed,action:request.action,modelId:'study'});
    for(let step=0;step<100;step++){
      if(sim.state.simSpeed===0)sim.garrisons.resolveEmergency(g.id,'hold');
      sim.step(.05);
      if(step%5===4)frames.push(structuredClone(sim.state));
    }
    console.log(JSON.stringify({frames,observation:observation(sim.state,g,sim.state.soldiers)}));
  }catch(error){console.log(JSON.stringify({error:String(error)}));}
}
