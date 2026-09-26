import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {positionReadiness} from '../src/combat/WeaponPositions';
import {balance,transfer} from '../src/garrison/Inventory';
import {writeFileSync,mkdirSync} from 'node:fs';

// Headless diagnostic, not player-facing acceptance. Ordinary construction,
// assignment and real delivery rules; no resource or person-position injection.
const state=createOperation('campaign',1944),sim=new BattlefieldSimulation(state),g=state.living!.garrisons.find(g=>g.faction!=='enemy')!;
if(process.argv.includes('--cold')){
  transfer(g.cache,state.living!.rearStock,'mortarHE',g.cache.mortarHE);
  transfer(g.cache,state.living!.rearStock,'mortarSmoke',g.cache.mortarSmoke);
  for(const s of state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction!=='enemy'))for(const key of ['mortarHE','mortarSmoke'] as const)transfer(s.carried!,state.living!.rearStock,key,s.carried![key]);
}
const id=sim.garrisons.requestFacility(g.id,'mortar',undefined,undefined,undefined,true);
if(!id)throw new Error('No valid field gun site');
const f=state.living!.facilities.find(f=>f.id===id)!,samples:unknown[]=[];
let crew=false,readyAt:number|undefined;
for(let tick=0;tick<1800*20;tick++){
  sim.step(.05);
  if(f.progress===1&&!crew)crew=sim.garrisons.autoCrew(id).accepted;
  if(tick%1200===0||f.progress===1&&f.stock.mortarHE>0&&!positionReadiness(state,f)){
    samples.push({at:state.elapsed,progress:f.progress,gun:f.stock,crew:f.weaponCrewIds?.map(id=>{const s=state.soldiers.find(s=>s.id===id)!;return {id,action:s.action,duty:s.duty,carried:s.carried,energy:s.needs?.energy};}),readiness:positionReadiness(state,f),forward:g.forwardStock,cache:g.cache,trucks:state.living!.trucks.filter(t=>t.faction!=='enemy').map(t=>({id:t.id,state:t.state,reason:t.reason,cargo:t.cargo})),balance:balance(state)});
    // Snapshot now; inventories continue mutating in place in the actual world.
    samples[samples.length-1]=structuredClone(samples.at(-1));
  }
  if(f.progress===1&&f.stock.mortarHE>0&&!positionReadiness(state,f)){readyAt=state.elapsed;break;}
}
const output={kind:'headless-diagnostic-not-browser-acceptance',coldDepotOnly:process.argv.includes('--cold'),startingSeed:1944,readyAt,simulatedSeconds:state.elapsed,finalBalance:balance(state),samples};
mkdirSync('docs/evidence/v1-player-experience',{recursive:true});
const path=`docs/evidence/v1-player-experience/support-chain-${Date.now()}.json`;
writeFileSync(path,JSON.stringify(output,null,2));console.log(JSON.stringify({path,readyAt,simulatedSeconds:state.elapsed,readiness:positionReadiness(state,f),progress:f.progress,ammo:f.stock.mortarHE}));
