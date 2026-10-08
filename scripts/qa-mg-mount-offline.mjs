// Isolated Edge and one copied HTML file; no network, save or runtime injection.
// The actual published title battle contains installed MGs. Camera-only focus
// inspects one through the normal transparent menu, then real controls enter Sandbox.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const folder=resolve('output/playwright',`mg-mount-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,errors:[],network:[],visual:null,mount:null};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);
  await page.waitForFunction(()=>window.__FRONTLINES__?.getState().living?.facilities.some(f=>f.kind==='emplacement'&&f.progress===1&&f.installation?.kind==='crew-mg'));
  report.mount=await page.evaluate(()=>{const a=window.__FRONTLINES__,f=a.getState().living.facilities.find(f=>f.kind==='emplacement'&&f.progress===1&&f.installation?.kind==='crew-mg');a.focus(f.x,f.z,9);return {id:f.id,x:f.x,z:f.z,installation:f.installation};});
  await page.waitForFunction(()=>window.__FRONTLINES__.getVisualStats().zoomDistance<30);await page.waitForTimeout(1200);
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());
  await page.screenshot({path:join(folder,'offline-title-mg-mount.png')});
  await page.getByRole('button',{name:'Sandbox',exact:true}).click();await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.screenshot({path:join(folder,'offline-sandbox.png')});
  assert.equal(report.network.length,0);assert.equal(report.errors.length,0);assert.ok(report.mount);assert.ok(report.visual.zoomDistance<30);
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
