// CLI file navigation is unavailable; use the repository's isolated Edge pattern.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const folder=resolve('output/playwright',`soldier-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,errors:[],network:[],visual:null};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  await page.evaluate(()=>{const a=window.__FRONTLINES__,s=a.getState().soldiers[0];a.focus(s.x,s.z,9);});
  await page.waitForFunction(()=>window.__FRONTLINES__.getVisualStats().zoomDistance<30);
  await page.waitForTimeout(1400);
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());
  await page.screenshot({path:join(folder,'offline-soldiers.png')});
  assert.equal(report.network.length,0);assert.equal(report.errors.length,0);assert.ok(report.visual.submittedSoldiers>0);
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
