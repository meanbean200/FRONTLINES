import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createOperation} from '../src/operations/createOperation';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {balance} from '../src/garrison/Inventory';
import type {OperationId} from '../src/operations/OperationalTypes';
const [target,durationArg]=process.argv.slice(2);if(!target)throw new Error('Pass an unused evidence JSON path');
const duration=Number(durationArg??600);if(!Number.isInteger(duration)||duration<1||duration>3600)throw new Error('Duration must be 1..3600 seconds');
const runs=[];
for(const [mode,lane] of [['breakthrough',0],['breakthrough',2],['line-defense',0],['meeting',0],['open-front',0]] as [OperationId,number][]){
  const start=performance.now(),sim=new BattlefieldSimulation(createOperation(mode,1944)),s=sim.state,r=s.operation!.runtime!;
  const ids=s.squads.filter(q=>q.faction==='player'&&q.kind==='rifle').slice(0,2).map(q=>q.id);
  if(mode==='breakthrough')sim.issueMove(ids,r.routes.filter(r=>r.side==='player')[lane].destination);
  if(mode==='meeting')ids.forEach((id,i)=>sim.issueMove([id],r.locations[i].position));
  const snapshots=[];let checks=0;
  for(let i=0;i<duration*20;i++){
    const before=s.elapsed;sim.step(.05);if(s.elapsed===before)break;
    if(i%2000===0){snapshots.push({at:s.elapsed,status:s.operation!.status,phase:r.phase,shots:s.operation!.shots,player:s.squads.filter(q=>ids.includes(q.id)).map(q=>({id:q.id,x:q.x,z:q.z,order:q.order.type,movement:q.movementState})),enemyPlans:s.operation!.enemyAI?.plans.map(p=>({id:p.squadId,role:p.role,reason:p.reason,orders:p.orders}))});try{new SaveSystem().parse(JSON.stringify(s));}catch(error){writeFileSync(target.replace(/\.json$/,`-${mode}-${lane}-failed-save.json`),JSON.stringify(s),{flag:'wx'});console.error(JSON.stringify({mode,lane,at:s.elapsed,failed:'save validation'}));throw error;}checks++;}
  }
  const ledger=balance(s),result={mode,lane,elapsed:s.elapsed,status:s.operation!.status,reason:s.operation!.reason,phase:r.phase,shots:s.operation!.shots,hits:s.operation!.hits,dead:s.soldiers.filter(p=>p.needs?.life==='dead').length,saveChecks:checks,ledgerMaxError:Math.max(...Object.values(ledger).map(Math.abs)),wallSeconds:(performance.now()-start)/1000,snapshots};
  runs.push(result);writeFileSync(target.replace(/\.json$/,`-${mode}-${lane}.state.json`),JSON.stringify(s),{flag:'wx'});console.log(JSON.stringify({...result,snapshots:undefined}));
}
writeFileSync(target,JSON.stringify({scope:`Actual fixed-step simulation, legal movement commands, no combat overrides; ${duration} simulated seconds per run unless paused/terminal`,runs},null,2),{flag:'wx'});
