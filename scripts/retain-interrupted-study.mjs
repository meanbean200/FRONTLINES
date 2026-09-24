import {readFileSync,writeFileSync} from 'node:fs';
const path=(process.argv[2]??'study-runs/first-study')+'/report.json',report=JSON.parse(readFileSync(path,'utf8'));
report.status='stopped-for-versioned-foundation-revision';
report.recommendation='Inconclusive. Retained exploratory runs; do not pool with a revised source identity.';
report.stoppedAt=new Date().toISOString();
report.stopReason=process.argv[3]??'Review found missing explicit rationing/withdrawal resupply and delivery observations. Foundation revised before final comparison.';
writeFileSync(path,JSON.stringify(report,null,2));
console.log({status:report.status,runsRetained:report.runs.length});
