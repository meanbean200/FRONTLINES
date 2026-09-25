import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {createOperation} from '../src/operations/createOperation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {isDeepStrictEqual} from 'node:util';

// Headless diagnostic reproduces Operations.test; never player-facing acceptance.
const a=new BattlefieldSimulation(createOperation('advance')),totals:Record<string,number>={},max:Record<string,number>={};
const tick=(sim:BattlefieldSimulation)=>{sim.step(.05);for(const [key,value] of Object.entries(sim.stepCosts)){totals[key]=(totals[key]??0)+value;max[key]=Math.max(max[key]??0,value);}};
a.issueMove(a.state.squads.filter(s=>s.faction!=='enemy').slice(0,3).map(s=>s.id),{x:-1180,z:-1400});
const start=performance.now();for(let i=0;i<800;i++)tick(a);
const b=new BattlefieldSimulation(new SaveSystem().parse(JSON.stringify(a.state)));
function difference(a:unknown,b:unknown,path='state'):unknown{
  if(isDeepStrictEqual(a,b))return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
      const v=difference((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],path+'.'+key);if(v)return v;
    }
  }return {path,a,b};
}
for(let i=0;i<800;i++){tick(a);tick(b);const left=JSON.parse(JSON.stringify(a.state)),right=JSON.parse(JSON.stringify(b.state));if(!isDeepStrictEqual(left,right)){console.log(JSON.stringify({tick:i,difference:difference(left,right)}));break;}}
console.log(JSON.stringify({wallMs:performance.now()-start,totals,max}));
