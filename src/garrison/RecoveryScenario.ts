import { createStudyScenario } from './StudyScenario';
import { inventory, RESOURCES } from './types';
import { transfer } from './Inventory';

/** Explicit diagnostic setup, never normal gameplay or an invisible refill. */
export function createRecoveryScenario() {
  const sim=createStudyScenario(1944,0,16),state=sim.state,w=state.living!,g=w.garrisons[0];
  // Disable external transport by an accounted fuel cutoff. Keep all stock in-world.
  w.nextDelivery=1e9;
  for(const truck of w.trucks){w.rearStock.fuel+=truck.fuel;truck.fuel=0;truck.state='blocked';truck.route=[{x:truck.x+20,z:truck.z}];truck.routeIndex=0;truck.reason='Diagnostic fuel cutoff';}
  g.nextSupport=1e9;
  for(let i=0;i<1500;i++)sim.step(.05);
  const crate={id:state.nextEntityId++,x:g.entrance.x-35,z:g.entrance.z-20,stock:inventory()};w.crates.push(crate);
  for(const key of RESOURCES){transfer(g.cache,crate.stock,key,g.cache[key]);transfer(g.forwardStock,w.rearStock,key,g.forwardStock[key]);}
  for(const s of state.soldiers){
    for(const key of RESOURCES)transfer(s.carried!,crate.stock,key,s.carried![key]);
    delete s.duty;s.needs!.energy=90;s.needs!.hunger=80;s.needs!.thirst=80;
  }
  g.cutoff='decision';g.nextDecision=0;w.emergencyResumeSpeed=1;state.simSpeed=0;
  return {sim,g,crate};
}

/** An unreachable nearer crate must not hide the reachable entrance-side crate. */
export function createDisconnectedRecoveryScenario(onlyBlocked=false) {
  const setup=createRecoveryScenario(),{sim,g,crate}=setup,state=sim.state;
  const blocked={id:state.nextEntityId++,x:g.entrance.x-20,z:g.entrance.z+15,stock:inventory()};
  for(const key of ['food','water'] as const)transfer(crate.stock,blocked.stock,key,onlyBlocked?crate.stock[key]:6);
  if(onlyBlocked)transfer(crate.stock,blocked.stock,'materials',crate.stock.materials);
  const trench={id:state.nextEntityId++,points:[{x:blocked.x-10,z:blocked.z},{x:blocked.x+10,z:blocked.z}],width:4.2,depth:1.75,progress:1,status:'complete' as const};
  state.trenches.push(trench);state.living!.crates.unshift(blocked);
  return {...setup,blocked,trench};
}
