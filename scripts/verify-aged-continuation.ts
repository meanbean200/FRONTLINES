import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { SaveSystem } from '../src/persistence/SaveSystem';
import { balance } from '../src/garrison/Inventory';

const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw Error('Provide source save and a new evidence filename.');
const raw=readFileSync(input,'utf8'),sim=new BattlefieldSimulation(new SaveSystem().parse(raw));sim.state.simSpeed=5;
const start=performance.now();for(let i=0;i<20;i++)sim.step(.05);
const final=JSON.stringify(sim.state),result={input,inputHash:createHash('sha256').update(raw).digest('hex'),elapsed:sim.state.elapsed,wallMs:performance.now()-start,stateHash:createHash('sha256').update(final).digest('hex'),ledger:balance(sim.state),state:sim.state};
writeFileSync(output,JSON.stringify(result),{flag:'wx'});console.log(JSON.stringify({...result,state:undefined}));
