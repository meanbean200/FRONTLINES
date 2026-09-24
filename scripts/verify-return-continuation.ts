import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { SaveSystem } from '../src/persistence/SaveSystem';
import { balance, total } from '../src/garrison/Inventory';
import { RULES_VERSION } from '../src/garrison/GarrisonPolicy';

const input=process.argv[2],output=process.argv[3],id=Number(process.argv[4]??806);
if(!input||!output)throw Error('Provide source save and a new evidence filename.');
const raw=readFileSync(input,'utf8'),payload=JSON.parse(raw),sim=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(payload.final??payload)));sim.setSpeed(5);
const person=()=>sim.state.soldiers.find(s=>s.id===id)!;
if(!person()?.duty)throw Error('Carrier missing from fixture');
const initial=structuredClone(person()),startSim=sim.state.elapsed,began=performance.now(),events:unknown[]=[];
let returning=false,delivered=false;
while(sim.state.elapsed-startSim<400&&performance.now()-began<45000&&!sim.awaitingSupplyDecision){
  const before=structuredClone(person());sim.step(.05);const after=person();
  if(!returning&&after.duty?.stage==='deliver'){
    returning=true;events.push({event:'return assigned',at:sim.state.elapsed,person:structuredClone(after)});
  }
  if(returning&&before.duty?.kind==='haul'&&before.duty.stage==='deliver'&&before.duty.arrivedAt!==undefined&&total(before.carried!)>0&&total(after.carried!)===0){
    delivered=true;events.push({event:'physical delivery',at:sim.state.elapsed,before,after:structuredClone(after)});break;
  }
}
const result={rules:RULES_VERSION,input,inputHash:createHash('sha256').update(raw).digest('hex'),initial,returning,delivered,elapsed:sim.state.elapsed,advanced:sim.state.elapsed-startSim,wallMs:performance.now()-began,pendingDecision:sim.awaitingSupplyDecision,events,ledger:balance(sim.state),final:sim.state};
writeFileSync(output,JSON.stringify(result),{flag:'wx'});
console.log(JSON.stringify({...result,initial:undefined,events:events.map((e:any)=>({event:e.event,at:e.at})),final:undefined,carrier:person()}));
