import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
import {balance} from '../src/garrison/Inventory';
import {RULES_VERSION} from '../src/garrison/GarrisonPolicy';

const target=process.argv[2];if(!target||existsSync(target))throw Error('Provide a new evidence filename.');
const sourceFiles=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name)):e.name.endsWith('.ts')?[join(dir,e.name)]:[]);
const source=createHash('sha256');for(const file of [...sourceFiles('src'),'scripts/verify-speed-continuation.ts'].sort())source.update(file.replaceAll('\\','/')).update(readFileSync(file));
const runs:unknown[]=[],started=performance.now();
for(const seed of [1944,1945,1946])for(const speed of [1,2,5]){
  const sim=new BattlefieldSimulation(createOperation('defense',seed));sim.setSpeed(speed);
  const start=performance.now();let ticks=0;
  while(sim.state.operation!.status==='active'&&ticks++<19000&&performance.now()-started<45000)sim.step(.05);
  const canonical=structuredClone(sim.state);canonical.simSpeed=1;
  const result={seed,speed,rules:RULES_VERSION,wallMs:performance.now()-start,elapsed:sim.state.elapsed,status:sim.state.operation!.status,reason:sim.state.operation!.reason,shots:sim.state.operation!.shots,hits:sim.state.operation!.hits,hash:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),ledger:balance(sim.state),final:sim.state};
  runs.push(result);console.log(JSON.stringify({...result,final:undefined}));
  if(result.status==='active')break;
}
writeFileSync(target,JSON.stringify({rules:RULES_VERSION,sourceHash:source.digest('hex'),wallMs:performance.now()-started,runs}),{flag:'wx'});
