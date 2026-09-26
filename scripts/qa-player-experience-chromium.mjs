// Ordinary production controls in a second browser, with read-only diagnostics.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const folder=path.resolve('output/playwright',`player-experience-chromium-${Date.now()}`);
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true}),report={folder,errors:[],browser:browser.version()};
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1.25});
  page.setDefaultTimeout(15000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  report.stage='setup';console.log(report.stage);
  await page.goto('http://127.0.0.1:4175/');await page.locator('#choose-operation').click();
  await page.locator('.advanced-setup>summary').click();await page.locator('#setup-time').selectOption('night');
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.screenshot({path:path.join(folder,'briefing.png'),scale:'css'});
  await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  report.stage='support';console.log(report.stage);
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState());assert.equal(state.operation.setup.advanced.time,'night');
  await page.locator('.hud-tools>summary').click();await page.locator('#open-fire-support').click();
  await page.locator('#fire-ammunition').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  assert.equal(await page.locator('#fire-ammunition').inputValue(),'mortarSmoke');
  report.stage='map';console.log(report.stage);
  await page.locator('.support-controls>summary').click();await page.keyboard.press('m');assert.ok(await page.locator('.field-map').isVisible());await page.keyboard.press('m');
  await page.locator('[data-speed="1"]').click();await page.waitForFunction(before=>window.__FRONTLINES__.getState().elapsed>before+1,state.elapsed);await page.locator('[data-speed="0"]').click();
  report.stage='complete';console.log(report.stage);
  await page.screenshot({path:path.join(folder,'night-gameplay.png'),scale:'css'});
  report.checks={nightApplied:true,nativeSupportSelect:true,map:true,simulationAdvances:true};
  report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvas:{width:document.querySelector('#battlefield').clientWidth,height:document.querySelector('#battlefield').clientHeight}}));
  assert.deepEqual(report.viewport.canvas,{width:1280,height:720});assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{await browser.close();await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
