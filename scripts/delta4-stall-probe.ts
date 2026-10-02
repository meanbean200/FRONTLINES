// Read a captured ordinary-player state; diagnose a CLONE, never the live game.
import {readFileSync} from 'node:fs';
import {SaveSystem} from '../src/persistence/SaveSystem';
import {BattlefieldSimulation} from '../src/simulation/BattlefieldSimulation';
import {distance,type Vec2,type SoldierState} from '../src/core/types';
import type {Garrison} from '../src/garrison/types';
import {constructionDiagnostics} from '../src/diagnostics/ConstructionDiagnostic';
const raw=readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''),payload=raw.includes('### Result')?JSON.parse(raw.split('### Result')[1].split('### Ran Playwright code')[0].trim()):raw;
const state=new SaveSystem().parse(typeof payload==='string'?payload:JSON.stringify(payload)),sim=new BattlefieldSimulation(state);
sim.garrisons.network.sync(state.trenches);
const internal=sim.garrisons as unknown as {workPoint:(a:Vec2,b:Vec2,p:number,s:SoldierState)=>Vec2|undefined;assignDuty:(s:SoldierState,g:Garrison,kind:string,p:Vec2,reason:string,duration:number,outside:boolean)=>boolean};
const steps=Number(process.argv[3]??0);
if(steps){
  state.simSpeed=1;
  for(let i=0;i<steps;i++){
    sim.stepFixed();
    if(i%200===0||i===steps-1)console.log(JSON.stringify({at:state.elapsed,sites:constructionDiagnostics(state).filter(f=>f.garrisonId===431).map(f=>({id:f.id,progress:f.progress,connector:f.connectorProgress,readout:f.readout,workers:f.workers}))}));
  }
  process.exit(0);
}
for(const f of state.living!.facilities.filter(f=>f.paid&&f.progress<1&&f.workOrder)){
  const t=state.trenches.find(t=>t.id===f.connectorId)!,g=state.living!.garrisons.find(g=>g.id===f.garrisonId)!;
  const diagnostics=constructionDiagnostics(state).find(row=>row.id===f.id);
  console.log(JSON.stringify({diagnostics,origin:t.points[0],site:{x:f.x,z:f.z},nearby:state.soldiers.filter(p=>distance(p,t.points[0])<5||p.duty&&distance(p.duty.destination,t.points[0])<5).map(p=>({id:p.id,tools:p.equipment?.tools,x:p.x,z:p.z,life:p.needs?.life,duty:p.duty}))}));
  for(const id of f.workOrder!.workerIds){const s=state.soldiers.find(p=>p.id===id)!;const p=internal.workPoint(t.points[0],f,t.progress,s);
    console.log(JSON.stringify({site:f.id,person:id,target:p,assignable:p?internal.assignDuty(s,g,'construct',p,'Diagnostic cloned route',8,!sim.garrisons.network.corridorContains(p)):false}));
  }
}
