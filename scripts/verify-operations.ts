import { existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createOperation } from '../src/operations/createOperation';
import { BattlefieldSimulation } from '../src/simulation/BattlefieldSimulation';
import { balance } from '../src/garrison/Inventory';
import { SaveSystem } from '../src/persistence/SaveSystem';

const target=process.argv[2]??'output/operation-pilot.json';
if(existsSync(target))throw Error('Choose a new output name; preserve prior evidence.');
const sourceFiles=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name)):e.name.endsWith('.ts')?[join(dir,e.name)]:[]);
const hash=createHash('sha256');for(const file of [...sourceFiles('src'),'scripts/verify-operations.ts'].sort())hash.update(file.replaceAll('\\','/')).update(readFileSync(file));
const runs:unknown[]=[];
for(const seed of [1944,1945,1946])for(const mode of ['advance','defense'] as const){
  const start=performance.now();let sim=new BattlefieldSimulation(createOperation(mode,seed));
  const friendly=sim.state.squads.filter(s=>s.faction==='player'),a=sim.state.operation!.objectives[0],b=sim.state.operation!.objectives[1];
  if(mode==='advance'){
    sim.issueMove(friendly.slice(0,2).map(s=>s.id),a);
    sim.issueMove(friendly.slice(2,5).map(s=>s.id),b);
  }
  const samples:unknown[]=[];let moved=false,saved=false;const frames:unknown[]=[];
  for(let tick=0;tick<19000&&sim.state.operation!.status==='active';tick++){
    if(mode==='advance'&&!moved&&sim.state.operation!.objectives[0].owner==='player'){
      sim.issueMove([friendly[1].id],b);moved=true;
    }
    sim.step(.05);
    if(tick%400===0){
      const state=sim.state,op=state.operation!;
      samples.push({at:state.elapsed,score:op.score,objectives:op.objectives.map(o=>({id:o.id,control:o.control,owner:o.owner,contested:o.contested})),able:state.squads.map(q=>({name:q.name,faction:q.faction,order:q.order.type,route:q.route.length,able:state.soldiers.filter(s=>s.squadId===q.id&&s.needs!.life==='active').length})),shots:op.shots,hits:op.hits});
      if(seed===1944)frames.push(structuredClone(state));
    }
    // Exercise actual serialized continuation, not only end-state validation.
    if(!saved&&sim.state.elapsed>120){sim=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(sim.state)));saved=true;}
  }
  const result={seed,mode,wallSeconds:(performance.now()-start)/1000,operation:sim.state.operation,ledger:balance(sim.state),deaths:sim.state.living!.metrics.deaths,samples,frames,finalState:sim.state};
  runs.push(result);console.log(JSON.stringify({...result,samples:undefined,frames:undefined,finalState:undefined}));
  writeFileSync(target,JSON.stringify({sourceHash:hash.copy().digest('hex'),status:'partial',runs}));
}
writeFileSync(target,JSON.stringify({sourceHash:hash.digest('hex'),status:'complete',runs}));
