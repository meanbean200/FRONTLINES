import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
const folder=path.resolve(process.argv[2]);
const pairs=[['09-fixed-mid-build-before','09-fixed-mid-build-after'],['33-building-occupied-before-save','34-building-after-refresh'],['53-new-defense-save','54-defense-after-reload'],['60-fight-before-save','60-fight-after-load'],['76-meeting-save-before','76-meeting-save-after']];
function normalize(value){
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='policySchema').map(([k,v])=>[k,normalize(v)]));
  return value;
}
const results=[];
for(const [before,after] of pairs){
  const a=JSON.parse(await readFile(path.join(folder,before+'.json'),'utf8')),b=JSON.parse(await readFile(path.join(folder,after+'.json'),'utf8'));
  results.push({before,after,identical:isDeepStrictEqual(normalize(a),normalize(b))});
}
const report={scope:'Normal-controls paused saves. Compare all captured fields except policySchema, which SaveSystem adds as compatibility metadata.',results};
await writeFile(path.join(folder,'save-comparison.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(results.some(r=>!r.identical))process.exitCode=1;
