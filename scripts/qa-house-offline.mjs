// Isolated Edge and one HTML file, offline. Real controls order building entry;
// diagnostics only inspect state, project coordinates and move the camera.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {select,ground,settle} from './qa-reset-controls.mjs';
const folder=resolve('output/playwright',`house-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,errors:[],network:[],occupation:null,visual:null};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);
  await page.getByRole('button',{name:'Sandbox',exact:true}).click();await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__FRONTLINES__.getState().seed),1944,'Fixture uses the existing seed-1944 village');
  await select(page,'Rifle 01');
  // One-floor Farm building 22 in the generated seed-1944 world, not placed/injected.
  const x=-1084.0350364107953,z=-1383.716106394356;
  await page.evaluate(([x,z])=>window.__FRONTLINES__.focus(x,z,60),[x,z]);await settle(page);await page.waitForTimeout(1200);
  await page.screenshot({path:join(folder,'offline-house.png')});
  const p=await ground(page,x,z);await page.mouse.click(p.x,p.y);
  await page.getByRole('button',{name:'Occupy floor',exact:true}).click();await page.getByRole('button',{name:'Close position management',exact:true}).click();
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().soldiers.some(s=>s.building?.id===21&&s.building.stage==='station'),{},{timeout:60000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  report.occupation=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {elapsed:s.elapsed,people:s.soldiers.filter(p=>p.building?.id===21).map(p=>({id:p.id,stage:p.building.stage,floor:p.building.floor,action:p.action}))};});
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());await page.screenshot({path:join(folder,'offline-occupied-cutaway.png')});
  assert.ok(report.occupation.people.some(p=>p.stage==='station'));assert.equal(report.errors.length,0);assert.equal(report.network.length,0);
}catch(e){report.failure=String(e);process.exitCode=1;await page.screenshot({path:join(folder,'failed.png')}).catch(()=>{});}
finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
