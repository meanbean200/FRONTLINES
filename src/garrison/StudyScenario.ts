import { type BattlefieldState } from '../core/types';
import { addSquad } from '../simulation/createBattlefield';
import { BattlefieldSimulation } from '../simulation/BattlefieldSimulation';
import { transfer } from './Inventory';

/** Scenario differences change initial conditions, never the simulation's rules. */
export function createStudyScenario(seed=1944,scenario=0,size=24):BattlefieldSimulation {
  if(scenario===2)size=Math.max(size,48);
  const state:BattlefieldState={schemaVersion:1,seed,elapsed:0,simSpeed:1,nextEntityId:1,soldiers:[],squads:[],trenches:[],craters:[]};
  const x=-1800+(seed%7)*25,z=-1220;
  for(let i=0;i<size;i+=8)addSquad(state,i+8>=size?'engineer':'rifle',Math.min(8,size-i),x-8-(i%4)*2,z-8-Math.floor(i/8)*6,`Study ${i/8+1}`);
  const id=state.nextEntityId++;
  state.trenches.push({id,points:[{x,z},{x:x+140,z}],width:4.2,depth:1.75,progress:1,status:'complete'});
  if(scenario>=1)state.trenches.push({id:state.nextEntityId++,points:[{x:x+65,z},{x:x+65,z:z+65}],width:4.2,depth:1.75,progress:1,status:'complete'});
  if(scenario>=2)state.trenches.push({id:state.nextEntityId++,points:[{x:x+65,z:z+65},{x:x+135,z:z+65},{x:x+135,z}],width:4.2,depth:1.75,progress:1,status:'complete'});
  const sim=new BattlefieldSimulation(state);sim.issueOccupyNearest(state.squads.map(q=>q.id),id);
  // Explicit mortality fixture; normal play remains gated on end-to-end acceptance.
  state.living!.lethalNeeds=true;
  const g=state.living!.garrisons[0];if(!g)throw new Error('Scenario is not assignable');
  // Explicit initial stock belongs to the fixture manifest, never a per-step refill.
  transfer(state.living!.rearStock,g.cache,'food',size*2);transfer(state.living!.rearStock,g.cache,'water',size*3);transfer(state.living!.rearStock,g.cache,'materials',40);
  if(scenario===3)state.living!.nextDelivery=600;
  if(scenario===4)state.living!.campaignHours=20;
  if(scenario===5)state.living!.campaignHours=20;
  return sim;
}
