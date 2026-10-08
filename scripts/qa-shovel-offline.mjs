// One copied HTML, isolated Edge, networking disabled. Actual player controls
// order excavation; diagnostics only read state/project points or move the camera.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {select,ground,settle} from './qa-reset-controls.mjs';

const folder=resolve('output/playwright',`shovel-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,errors:[],network:[],work:null,visual:null};
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);
  await page.getByRole('button',{name:'Sandbox',exact:true}).click();
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await select(page,'Engineer 1');
  await page.evaluate(()=>window.__FRONTLINES__.focus(-1392,-1250,125));await settle(page);
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.map(t=>t.id));
  await page.keyboard.press('b');
  const a=await ground(page,-1403,-1270),b=await ground(page,-1403,-1230);
  assert.ok(a.visible&&b.visible,'Excavation points must be on screen');
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:30});await page.mouse.up();
  await page.waitForFunction(ids=>window.__FRONTLINES__.getState().trenches.some(t=>!ids.includes(t.id)),before);
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(ids=>{
    const s=window.__FRONTLINES__.getState();
    return s.trenches.some(t=>!ids.includes(t.id)&&t.progress>.12&&t.progress<1)&&s.soldiers.some(p=>p.action==='digging');
  },before,{timeout:60000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  report.work=await page.evaluate(ids=>{
    const a=window.__FRONTLINES__,s=a.getState(),diggers=s.soldiers.filter(p=>p.action==='digging');
    a.focus(diggers[0].x,diggers[0].z,9);
    return {elapsed:s.elapsed,trenches:s.trenches.filter(t=>!ids.includes(t.id)).map(t=>({id:t.id,progress:t.progress})),
      diggers:diggers.map(p=>({id:p.id,action:p.action,equipment:p.equipment,life:p.needs?.life,health:p.health}))};
  },before);
  await settle(page);
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());
  await page.screenshot({path:join(folder,'offline-digging.png')});
  assert.ok(report.work.diggers.length>0);assert.ok(report.work.diggers.every(p=>p.equipment.tools&&p.life==='active'));
  assert.equal(report.network.length,0);assert.equal(report.errors.length,0);
}catch(e){report.failure=String(e);process.exitCode=1;await page.screenshot({path:join(folder,'failed.png')}).catch(()=>{});}
finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
