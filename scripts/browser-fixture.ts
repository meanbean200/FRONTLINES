import type { BattlefieldState } from '../src/core/types';
import { addSquad } from '../src/simulation/createBattlefield';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { transfer } from '../src/garrison/Inventory';

/** Reproducible in-trench performance fixture, separate from retired learning scenarios. */
export function browserFixture(count=300):BattlefieldState {
  const state:BattlefieldState={schemaVersion:1,seed:1944,elapsed:0,simSpeed:1,nextEntityId:1,soldiers:[],squads:[],trenches:[],craters:[]};
  const groups=Math.ceil(count/100),assignments:{ids:number[];trench:number}[]=[];
  let remaining=count;
  for(let g=0;g<groups;g++){
    const size=Math.min(100,remaining),x=-2800+(g%5)*470,z=-1150+Math.floor(g/5)*330,ids:number[]=[];
    for(let i=0;i<size;i+=10){const squad=addSquad(state,i+10>=size?'engineer':'rifle',Math.min(10,size-i),x+12+i*2.6,z,`Camp ${g+1} / ${i/10+1}`);ids.push(squad.id);}
    const trench=state.nextEntityId++;
    state.trenches.push({id:trench,points:[{x,z},{x:x+330,z},{x:x+330,z:z+80},{x:x+165,z:z+80},{x:x+165,z}],width:4.2,depth:1.75,progress:1,status:'complete'});
    // addSquad creates an open-field formation. For this already-garrisoned
    // workload, initialize people inside the completed corridor, not in the
    // enclosed field beyond its walls. Exterior assembly is tested separately.
    state.soldiers.filter(s=>ids.includes(s.squadId)).forEach((s,i)=>{s.x=x+12+i*3;s.z=z;});
    assignments.push({ids,trench});remaining-=size;
  }
  const sim=new BattlefieldSimulation(state);
  for(const a of assignments){if(!sim.garrisons.assign(a.ids,a.trench))throw new Error('Unassignable benchmark layout');}
  for(const g of state.living!.garrisons){transfer(state.living!.rearStock,g.cache,'food',100);transfer(state.living!.rearStock,g.cache,'water',120);transfer(state.living!.rearStock,g.cache,'materials',30);}
  return state;
}
