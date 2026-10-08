// Uses the existing isolated Edge pattern because CLI navigation rejects file: URLs.
// All game actions use player controls. No runtime world or save injection.
import {chromium} from 'playwright';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const folder=resolve('output/playwright',`truck-offline-${Date.now()}`);await mkdir(folder,{recursive:true});
const entry=join(folder,'FRONTLINES.html');await copyFile('FRONTLINES.html',entry);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,viewport:{width:1600,height:900}}),page=await context.newPage();
const report={folder,errors:[],network:[],visual:null,truck:null};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});
try{
  await page.goto(pathToFileURL(entry).href);await page.getByRole('button',{name:'Sandbox',exact:true}).click();await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.getByText('Command',{exact:true}).click();await page.getByRole('button',{name:'Positions',exact:true}).click();await page.getByRole('button',{name:'Supplies',exact:true}).click();
  await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Delivery truck',exact:true})}).first().getByRole('button',{name:'Locate',exact:true}).click();
  await page.getByRole('button',{name:'Close position management',exact:true}).click();await page.mouse.move(800,450);await page.mouse.wheel(0,-1100);
  await page.waitForFunction(()=>window.__FRONTLINES__.getVisualStats().zoomDistance<30);await page.waitForTimeout(800);
  report.visual=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());
  report.truck=await page.evaluate(()=>window.__FRONTLINES__.getState().living.trucks.find(t=>t.role==='shuttle'));
  await page.screenshot({path:join(folder,'offline-truck.png')});
  assert.equal(report.network.length,0);assert.equal(report.errors.length,0);assert.ok(report.truck);assert.ok(report.visual.zoomDistance<30);
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await writeFile(join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
