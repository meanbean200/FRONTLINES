import { writeFileSync } from 'node:fs';
import { createDisconnectedRecoveryScenario } from '../src/garrison/RecoveryScenario';
import { RULES_VERSION } from '../src/garrison/GarrisonPolicy';
import { balance } from '../src/garrison/Inventory';
import { SaveSystem } from '../src/persistence/SaveSystem';

const {sim,g,crate,blocked}=createDisconnectedRecoveryScenario();
const fixture=new SaveSystem().parse(JSON.stringify(sim.state));
sim.garrisons.resolveEmergency(g.id,'recover');
for(let i=0;i<2400;i++)sim.step(.05);
const output=process.argv[2]??'output/recovery-targets-r1.json';
const result={kind:'synthetic disconnected recovery diagnostic',rules:RULES_VERSION,fixture,reachableId:crate.id,blockedId:blocked.id,finalState:sim.state,ledger:balance(sim.state)};
writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({output,rules:RULES_VERSION,elapsed:sim.state.elapsed,crates:sim.state.living!.crates,people:sim.state.soldiers.filter(s=>s.duty?.crateId).map(s=>({id:s.id,x:s.x,z:s.z,duty:s.duty})),ledger:result.ledger}));
