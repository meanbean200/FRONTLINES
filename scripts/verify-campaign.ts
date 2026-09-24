import {writeFileSync,existsSync} from 'node:fs';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance,localInventory} from '../src/garrison/Inventory';
const target=process.argv[2],seconds=Number(process.argv[3]??1800);if(!target||existsSync(target))throw Error('Choose an unused evidence file');
const sim=new BattlefieldSimulation(createOperation('campaign')),start=performance.now(),samples:unknown[]=[],ticks:number[]=[],frames:unknown[]=[];
let continued=false,maxLedgerError=0;
for(let tick=0;tick<seconds*20;tick++){
  const begin=performance.now();sim.step(.05);ticks.push(performance.now()-begin);
  if(tick%2400===0){
    const s=sim.state,w=s.living!,sample={at:s.elapsed,hours:w.campaignHours,operation:s.operation!.status,shots:s.operation!.shots,hits:s.operation!.hits,raid:s.operation!.campaign,able:s.soldiers.filter(s=>s.needs!.life==='active').length,garrisons:w.garrisons.map(g=>({name:g.name,watch:g.watchPresent,required:g.watchRequired,cutoff:g.cutoff,stock:localInventory(s,g),forward:g.forwardStock,activities:sim.garrisons.people(g).reduce((m,p)=>(m[p.action]=(m[p.action]??0)+1,m),{} as Record<string,number>)})),facilities:w.facilities.map(f=>({kind:f.kind,progress:f.progress,paid:f.paid})),trucks:w.trucks.map(t=>({side:t.faction??'player',x:t.x,state:t.state,reason:t.reason,ammo:t.cargo.ammo})),ledger:balance(s)};
    maxLedgerError=Math.max(maxLedgerError,...Object.values(balance(s)).map(Math.abs));samples.push(sample);frames.push(structuredClone(s));console.log(JSON.stringify(sample));
    writeFileSync(target,JSON.stringify({status:'partial',wallSeconds:(performance.now()-start)/1000,samples,frames,maxLedgerError}));
  }
  if(!continued&&sim.state.elapsed>=200){const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));for(let i=0;i<100;i++){sim.step(.05);b.step(.05);}if(JSON.stringify(b.state)!==JSON.stringify(sim.state))throw Error('Save continuation mismatch');continued=true;}
  if(sim.state.simSpeed===0||sim.state.operation!.status!=='active')break;
}
ticks.sort((a,b)=>a-b);writeFileSync(target,JSON.stringify({status:'complete',wallSeconds:(performance.now()-start)/1000,continued,maxLedgerError,tickP95:ticks[Math.floor(ticks.length*.95)],tickMax:ticks.at(-1),samples,frames,finalState:sim.state}));
console.log(JSON.stringify({target,continued,wallSeconds:(performance.now()-start)/1000,at:sim.state.elapsed,status:sim.state.operation!.status,maxLedgerError,p95:ticks[Math.floor(ticks.length*.95)],max:ticks.at(-1)}));
