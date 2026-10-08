// Isolated Edge and one HTML file, offline. Real controls order building entry;
// diagnostics only inspect state, project coordinates and move the camera.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {select,ground,settle} from './qa-reset-controls.mjs';
const twoStorey=process.argv.includes('--two-story');
const building=twoStorey?{id:16,x:-1114.393851395206,z:-1409.685198970648,floor:1}:{id:21,x:-1084.0350364107953,z:-1383.716106394356,floor:0};
const folder=resolve('output/playwright',`house${twoStorey?'-two':''}-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,building,errors:[],network:[],occupation:null,visual:null};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);
  await page.getByRole('button',{name:'Sandbox',exact:true}).click();await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__FRONTLINES__.getState().seed),1944,'Fixture uses the existing seed-1944 village');
  await select(page,'Rifle 01');
  // Existing seed-1944 village buildings, not placed/injected by this check.
  const {x,z}=building;
  await page.evaluate(([x,z])=>window.__FRONTLINES__.focus(x,z,60),[x,z]);await settle(page);await page.waitForTimeout(1200);
  await page.screenshot({path:join(folder,'offline-house.png')});
  const p=await ground(page,x,z);await page.mouse.click(p.x,p.y);
  if(twoStorey)await page.getByRole('combobox',{name:'Floor',exact:true}).selectOption('1');
  await page.getByRole('button',{name:'Occupy floor',exact:true}).click();await page.getByRole('button',{name:'Close position management',exact:true}).click();
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(({id,floor})=>window.__FRONTLINES__.getState().soldiers.filter(s=>s.building?.id===id&&s.building.stage==='station'&&s.building.floor===floor).length>=8,building,{timeout:90000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  report.occupation=await page.evaluate(id=>{const s=window.__FRONTLINES__.getState();return {elapsed:s.elapsed,people:s.soldiers.filter(p=>p.building?.id===id).map(p=>({id:p.id,stage:p.building.stage,floor:p.building.floor,action:p.action}))};},building.id);
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());await page.screenshot({path:join(folder,'offline-occupied-cutaway.png')});
  assert.equal(report.occupation.people.filter(p=>p.stage==='station'&&p.floor===building.floor).length,8);assert.equal(report.errors.length,0);assert.equal(report.network.length,0);
}catch(e){report.failure=String(e);process.exitCode=1;await page.screenshot({path:join(folder,'failed.png')}).catch(()=>{});}
finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
