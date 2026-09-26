// The browser CLI cannot navigate file://. Use the same isolated Edge fallback
// as qa-file-boot, with only UI controls and passive state/storage inspection.
import {chromium} from 'playwright';
import {mkdir,mkdtemp,copyFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const target=process.argv[2];if(!target)throw Error('Supply an unused evidence result path');
try{await access(target);throw Error('Evidence path already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir('output/playwright',{recursive:true});
const folder=await mkdtemp(resolve('output/playwright/endless-disk-'));
await copyFile('FRONTLINES.html',join(folder,'FRONTLINES.html'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1654,height:910}}),page=await context.newPage();
const report={scope:'Offline standalone Endless via normal controls; isolated profile; no injected state',errors:[],requests:[],checks:{},folder};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>report.requests.push(r.url()));
// Compare serialized simulation semantics: JSON intentionally omits undefined
// optional properties, just like the save format. Keep every actual value.
const state=()=>page.evaluate(()=>{const s=window.__FRONTLINES__.getState();delete s.policySchema;return JSON.parse(JSON.stringify(s));});
try{
  await page.goto(pathToFileURL(join(folder,'FRONTLINES.html')).href);
  await page.getByRole('button',{name:'Quick Battle',exact:true}).click();
  await page.getByRole('button',{name:'Endless',exact:true}).click();
  await page.getByRole('combobox',{name:'Map',exact:true}).selectOption('seed');
  await page.locator('#sector-seed').fill('1944');
  await page.getByRole('combobox',{name:'Reinforcements',exact:true}).selectOption('continuous');
  await page.getByRole('combobox',{name:'Day / night cycle'}).selectOption('20');
  await page.getByRole('button',{name:'Prepare battle'}).click();
  await page.getByRole('button',{name:'Begin endless battle'}).click();
  await page.locator('[data-speed="0"]').click();
  const before=await state();assert.equal(before.operation.battleMode,'endless');
  assert.equal(before.operation.endless.options.reinforcements,'continuous');assert.equal(before.operation.setup.calendarDayMinutes,20);
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('button',{name:'Save & Exit',exact:true}).click();
  assert.equal((await page.evaluate(()=>window.__FRONTLINES__.getSessionStats())).kind,'attract');
  await page.reload();await page.getByRole('button',{name:'Continue →'}).click();
  const after=await state();assert.deepEqual(after,before);report.checks.exactContinue=true;
  report.stateHash=createHash('sha256').update(JSON.stringify(after)).digest('hex');
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('button',{name:'End Battle…',exact:true}).click();
  await page.getByRole('button',{name:'Keep fighting',exact:true}).click();
  assert.deepEqual(await state(),after);report.checks.cancelUnchanged=true;
  await page.getByRole('button',{name:'End Battle…',exact:true}).click();
  await page.getByRole('button',{name:'End Battle',exact:true}).click();
  await page.getByRole('heading',{name:'Battle concluded',exact:true}).waitFor();
  const final=await state();assert.equal(final.operation.status,'ended');assert.equal(final.operation.endless.ended.cause,'player-ended');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v4')).operation.status),'active');
  report.checks.explicitEndPreservesSave=true;
  await page.screenshot({path:join(folder,'concluded.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Save record & Exit',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Continue →'}).click();
  await page.getByRole('heading',{name:'Battle concluded',exact:true}).waitFor();
  assert.equal((await state()).operation.status,'ended');report.checks.concludedRecordRestores=true;
  assert.equal(report.errors.length,0);assert.ok(report.requests.every(url=>!/^https?:/.test(url)));
  report.checks.noNetworkDependencies=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;await page.screenshot({path:join(folder,'failure.png')}).catch(()=>{});}
finally{await browser.close();await writeFile(target,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));}
