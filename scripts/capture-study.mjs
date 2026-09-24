import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const root=process.cwd(),output=resolve(process.argv[2]??'study-runs/first-study'),destination=join(output,'source');
if(existsSync(destination))throw new Error('Source evidence already exists; refusing to overwrite it.');
const folders=['core','garrison','simulation','construction','navigation','terrain'];
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(path,e.name)):[join(path,e.name)]);
const simulation=[...folders.flatMap(d=>walk(resolve('src',d))).filter(p=>p.endsWith('.ts')&&!p.endsWith('.test.ts')),resolve('scripts/study-host.ts'),resolve('scripts/neural-study.py')].sort();
const hash=createHash('sha256');simulation.forEach(p=>hash.update(readFileSync(p)));
const simulationHash=hash.digest('hex'),report=JSON.parse(readFileSync(join(output,'report.json'),'utf8'));
if(simulationHash!==report.simulationHash)throw new Error('Current source no longer matches the running study.');
const files=[...simulation,...['scripts/study-requirements.txt','package.json','package-lock.json'].map(p=>resolve(p))];
const sources={};
for(const file of files){const name=relative(root,file).replaceAll('\\','/'),target=join(destination,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(file,target);sources[name]=createHash('sha256').update(readFileSync(file)).digest('hex');}
writeFileSync(join(output,'source-manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),simulationHash,sources,configuration:{steps:report.configuration.steps,evaluationBaseSeed:report.evaluationBaseSeed,trainingSeeds:[101,202,303],network:[64,64],algorithm:'PPO',nSteps:512,batchSize:128,nEpochs:5,gamma:.995,learningRate:.0003,entropyCoefficient:.01,policyIntervalSeconds:5,episodeCampaignHours:72,normalization:'Fixed scaling in GarrisonPolicy.ts; no VecNormalize',humanAcceptance:'pending'}},null,2));
console.log(JSON.stringify({sourceFiles:files.length,simulationHash,output}));
