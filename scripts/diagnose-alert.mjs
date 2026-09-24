import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';
const report=JSON.parse(readFileSync('study-runs/living-2-final/report.json','utf8'));
const seed=Number(process.argv[2]??9906),scenario=Number(process.argv[3]??5),output=process.argv[4]??'output/rules-alert-diagnostic.json';
const reference=report.evaluations.find(r=>r.mode==='rules'&&r.seed===seed&&r.scenario===scenario);
if(!reference)throw new Error('Wait for the corresponding held-out baseline.');
const proc=spawn('node',['--import','tsx','scripts/study-host.ts'],{stdio:['pipe','pipe','inherit'],windowsHide:true});
const lines=createInterface({input:proc.stdout}),timer=setTimeout(()=>proc.kill(),60000);
const request=message=>new Promise((resolve,reject)=>{const exit=()=>reject(new Error('Host exited'));proc.once('exit',exit);lines.once('line',line=>{proc.off('exit',exit);const value=JSON.parse(line);if(value.error)reject(new Error(value.error));else resolve(value);});proc.stdin.write(JSON.stringify(message)+'\n');});
const frames=[];
try{
  const contract=await request({command:'reset',mode:'rules',seed:seed+17,scenario});
  let result;
  for(let step=0;step<1081;step++){
    result=await request({command:'step',action:[0,0,0,0,0,0]});
    if(step%12===0){
      const s=await request({command:'state'}),g=s.living.garrisons[0];
      frames.push({hours:s.living.campaignHours,readiness:g.readiness,cache:g.cache,stores:s.living.facilities.filter(f=>f.kind==='store').map(f=>f.stock),forward:g.forwardStock,people:s.soldiers.map(p=>({id:p.id,x:p.x,z:p.z,health:p.health,needs:p.needs,action:p.action,duty:p.duty,carried:p.carried}))});
    }
    if(result.terminated||result.truncated)break;
  }
  const error=Math.max(...Object.keys(result.metrics).map(k=>Math.abs(result.metrics[k]-reference.metrics[k])));
  const dead=frames.at(-1).people.filter(p=>p.needs.life==='dead').map(p=>p.id);
  const histories=dead.map(id=>({id,frames:frames.map(f=>({...f,people:f.people.filter(p=>p.id===id||p.duty?.patientId===id)})).filter(f=>f.people.some(p=>p.id===id&&p.needs.life!=='dead')).slice(-12)}));
  writeFileSync(output,JSON.stringify({rulesVersion:contract.rulesVersion,caseSeed:seed,scenario,referenceRulesVersion:report.rulesVersion,metrics:result.metrics,maxMetricDifference:error,histories},null,2),{flag:'wx'});
  console.log(JSON.stringify({dead,maxMetricDifference:error,lastFrames:histories.map(h=>({id:h.id,last:h.frames.at(-1)}))},null,2));
}finally{clearTimeout(timer);proc.stdin.end('{"command":"close"}\n');lines.close();}
