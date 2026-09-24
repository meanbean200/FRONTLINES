import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';

const [session,source,speedText,target]=process.argv.slice(2),speed=Number(speedText);
if(!session||!source||![1,5].includes(speed)||!target||existsSync(target)||existsSync(target+'.probe.cjs'))throw Error('Pass browser session, current/state file, speed 1/5 and unused output path.');
let state;if(source!=='current'){const payload=JSON.parse(readFileSync(source,'utf8'));state=payload.evidence?.state??payload.finalState??payload;state.simSpeed=0;}
const probe=`async(page)=>{
  await page.bringToFront();
  ${state?`await page.evaluate(s=>window.__FRONTLINES__.restoreState(s),${JSON.stringify(state)});await page.evaluate(()=>window.__FRONTLINES__.focus(${state.operation?'-1390,-1450,430':'-2400,-1110,850'}));`:''}
  await page.locator('[data-speed="${speed}"]').click();await page.waitForTimeout(5000);
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const cadence=await page.evaluate(()=>new Promise(resolve=>{const values=[];let last,start;function frame(now){if(start===undefined)start=now;if(last!==undefined)values.push(now-last);last=now;if(now-start<20000)requestAnimationFrame(frame);else{values.sort((a,b)=>a-b);resolve({wallSeconds:(now-start)/1000,samples:values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)],max:values.at(-1)});}}requestAnimationFrame(frame);}));
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState()),perf=await page.evaluate(()=>window.__FRONTLINES__.getPerf());
  await page.locator('[data-speed="0"]').click();await page.waitForTimeout(200);
  await page.screenshot({path:${JSON.stringify(target.replace(/\.json$/,'.png'))}});
  return {scope:${JSON.stringify(source)},speed:${speed},checks:{sameWorld:before.soldiers.length===after.soldiers.length&&before.operation?.mode===after.operation?.mode,requestedSpeed:before.simSpeed===${speed}&&after.simSpeed===${speed},advanced:after.elapsed>before.elapsed},build:await page.locator('script[type="module"]').getAttribute('src'),cadence,perf,simulationSeconds:after.elapsed-before.elapsed,counts:{soldiers:after.soldiers.length,garrisons:after.living.garrisons.length,trucks:after.living.trucks.length},before:before.elapsed,after:after.elapsed,shotsBefore:before.operation?.shots,shotsAfter:after.operation?.shots,state:after};
}`;
writeFileSync(target+'.probe.cjs',probe,{flag:'wx'});
const cli=join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
const raw=execFileSync(process.execPath,[cli,'--yes','--package','@playwright/cli','playwright-cli','-s='+session,'run-code','--filename',target+'.probe.cjs'],{encoding:'utf8',timeout:55000,maxBuffer:16*1024*1024});
const match=raw.match(/### Result\s*\n([\s\S]*?)\n### Ran Playwright code/);if(!match)throw Error(raw);
const evidence=JSON.parse(match[1]);writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),evidence},null,2),{flag:'wx'});console.log(JSON.stringify({...evidence,state:undefined}));
