import { writeFileSync } from 'node:fs';
import { createRecoveryScenario } from '../src/garrison/RecoveryScenario';
import { balance, transfer } from '../src/garrison/Inventory';
import { SaveSystem } from '../src/persistence/SaveSystem';
import { RULES_VERSION } from '../src/garrison/GarrisonPolicy';

const {sim,g,crate}=createRecoveryScenario();
const paused=new SaveSystem().parse(JSON.stringify(sim.state));
transfer(crate.stock,g.forwardStock,'food',40);transfer(crate.stock,g.forwardStock,'water',60);
const withdrawal=new SaveSystem().parse(JSON.stringify(sim.state));
const output=process.argv[2]??'output/recovery-trips-r1.json';
writeFileSync(output,JSON.stringify({kind:'synthetic physical recovery diagnostic',rules:RULES_VERSION,paused,withdrawal,ledger:balance(sim.state)},null,2),{flag:'wx'});
console.log(JSON.stringify({output,elapsed:paused.elapsed,people:paused.soldiers.length,ledger:balance(sim.state)}));
