import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

// Installation exposes an experimental choice. It never changes the game's rule-based default.
const output=resolve(process.argv[2]??'study-runs/living-3-final');
const report=JSON.parse(readFileSync(join(output,'report.json'),'utf8'));
if(report.status!=='completed'||report.evaluations.length!==96||report.runs.filter(r=>!r.error).length!==6)throw new Error('Require a completed six-seed comparison; never install a partial study.');
const walk=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(folder,e.name)):[join(folder,e.name)]);
const files=['core','garrison','simulation','construction','navigation','terrain'].flatMap(d=>walk(resolve('src',d))).filter(p=>p.endsWith('.ts')&&!p.endsWith('.test.ts'));
files.push(resolve('scripts/study-host.ts'),resolve('scripts/neural-study.py'));
const digest=createHash('sha256');files.sort().forEach(p=>digest.update(readFileSync(p)));
if(digest.digest('hex')!==report.simulationHash)throw new Error('Current simulation differs from the evaluated source.');
const candidates=['learned','hybrid'].map(mode=>{
  const source=join(output,`${mode}-101`),target=resolve('public/models',mode),metadata=JSON.parse(readFileSync(join(source,'metadata.json'),'utf8'));
  const sha=createHash('sha256').update(readFileSync(join(source,'policy.onnx'))).digest('hex');
  const evaluated=report.runs.find(r=>r.mode===mode&&r.seed===101&&!r.error);
  if(!evaluated||evaluated.metadata.sha256!==sha||evaluated.metadata.modelId!==metadata.modelId)throw new Error(`Export is not the evaluated ${mode}-101 identity.`);
  if(metadata.sha256!==sha||metadata.rulesVersion!==report.rulesVersion||metadata.observationVersion!==report.observationVersion||metadata.observationSize!==32||metadata.actionSize!==6)throw new Error(`Incompatible ${mode} export.`);
  if(existsSync(target))throw new Error(`Preserve existing installation: ${target}`);
  return {mode,source,target,modelId:metadata.modelId,sha256:sha};
});
for(const candidate of candidates){
  mkdirSync(candidate.target,{recursive:true});
  for(const name of ['metadata.json','policy.onnx','parity.json'])copyFileSync(join(candidate.source,name),join(candidate.target,name),constants.COPYFILE_EXCL);
}
console.log(JSON.stringify({status:'experimental, not adopted',simulationHash:report.simulationHash,candidates},null,2));
