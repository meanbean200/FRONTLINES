// Real Edge native bounds and browser zoom; own ephemeral browser/profile only.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const folder=resolve('output/playwright',`viewport-native-${Date.now()}`);await mkdir(folder,{recursive:true});
// Empty userDataDir gives Playwright a fresh temporary profile, removed on
// close. Only this throwaway profile loads the test extension. Never attach.
const extension=resolve('tests/fixtures/viewport-extension');
const context=await chromium.launchPersistentContext('',{channel:'msedge',headless:false,chromiumSandbox:true,viewport:null,args:[`--load-extension=${extension}`,`--disable-extensions-except=${extension}`]}),page=context.pages()[0];
const cdp=await context.newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget');
const result={folder,samples:[],errors:[]};page.on('pageerror',e=>result.errors.push(e.message));
let worker;
const zoom=async factor=>worker.evaluate(async({url,factor})=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===url);if(!tab)throw Error('Owned QA tab missing');await chrome.tabs.setZoom(tab.id,factor);return chrome.tabs.getZoom(tab.id);},{url:page.url(),factor});
const read=()=>page.evaluate(()=>window.__FRONTLINES_VIEWPORT__());
async function sample(label){
  await page.waitForFunction(()=>{const d=window.__FRONTLINES_VIEWPORT__?.();return d&&Math.abs(d.cameraAspect-d.app.width/d.app.height)<.000001;});
  const d=await read();
  for(const key of ['document','body','app','canvas','ui',...(d.menu?['menu']:[])])for(const axis of ['width','height'])assert.ok(Math.abs(d[key][axis]-d.inner[axis])<1.1,`${label} ${key} ${axis}`);
  for(const axis of ['width','height'])assert.ok(Math.abs(d.backing[axis]-Math.floor(d.app[axis]*d.rendererPixelRatio))<1.1,`${label} drawing buffer ${axis}`);
  assert.equal(d.overflow,false);assert.equal(page.viewportSize(),null);
  result.samples.push({label,...d});return d;
}
async function shot(label){
  await page.waitForFunction(()=>{
    const s=window.__FRONTLINES__.getVisualStats(),p=window.__viewportPreviousCamera;
    window.__viewportPreviousCamera={...s.cameraTarget,zoom:s.zoomDistance};
    return s.generatedChunks===64&&s.triangles>50000&&p&&Math.hypot(s.cameraTarget.x-p.x,s.cameraTarget.z-p.z)<.001&&Math.abs(s.zoomDistance-p.zoom)<.001;
  });
  await page.bringToFront();const {bounds}=await cdp.send('Browser.getWindowBounds',{windowId});
  const helper=resolve(process.env.USERPROFILE,'.codex/skills/screenshot/scripts/take_screenshot.ps1');
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',helper,'-Path',join(folder,label+'.png'),'-Region',`${Math.max(0,bounds.left)},${Math.max(0,bounds.top)},${bounds.width},${bounds.height}`]);
}
try{
  worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  for(const [kind,base] of [['production',process.argv[2]??'http://127.0.0.1:4175/'],['standalone',pathToFileURL(resolve('FRONTLINES.html')).href]]){
    const url=new URL(base);url.searchParams.set('viewportDebug','1');await page.goto(url.href);await page.locator('#choose-operation').waitFor();
    for(const [width,height] of [[1400,900],[1700,980]]){
      await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await cdp.send('Browser.setWindowBounds',{windowId,bounds:{left:0,top:0,width,height}});
      const initial=await sample(`${kind}-native-${width}`);
      for(let i=0;i<3;i++){
        await cdp.send('Network.setCacheDisabled',{cacheDisabled:i===1});await page.reload();await page.locator('#choose-operation').waitFor();
        const d=await sample(`${kind}-refresh-${width}-${i}`);assert.deepEqual(d.inner,initial.inner);
      }
    }
    await page.waitForFunction(()=>window.__FRONTLINES__.getVisualStats().workerJobs>=3);await shot(`${kind}-native-refresh`);
    assert.equal(await zoom(1),1);const baseSize=await sample(`${kind}-zoom-100`);
    for(const percent of [80,125,150]){
      assert.equal(await zoom(percent/100),percent/100);
      await page.waitForFunction(target=>Math.abs(devicePixelRatio-target)<.01,baseSize.devicePixelRatio*percent/100);
      const d=await sample(`${kind}-zoom-${percent}`);assert.ok(Math.abs(d.inner.width-baseSize.inner.width*100/percent)<2);
      await page.reload();await page.locator('#choose-operation').waitFor();await sample(`${kind}-zoom-${percent}-refresh`);
      await shot(`${kind}-zoom-${percent}`);
    }
    await zoom(1);await page.waitForFunction(target=>devicePixelRatio===target,baseSize.devicePixelRatio);
    const before=await sample(`${kind}-before-fullscreen`);
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'fullscreen'}});await page.waitForFunction(h=>innerHeight>h,before.inner.height);await sample(`${kind}-browser-fullscreen`);await shot(`${kind}-fullscreen`);
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await page.waitForFunction(h=>innerHeight===h,before.inner.height);await sample(`${kind}-browser-fullscreen-exit`);
    // Actual user activation for DOM fullscreen on the host, including its menu.
    await page.evaluate(()=>{const b=document.createElement('button');b.id='qa-fullscreen';b.textContent='Test host fullscreen';b.onclick=()=>document.getElementById('app').requestFullscreen();document.querySelector('.operation-menu').prepend(b);});
    await page.locator('#qa-fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await sample(`${kind}-host-fullscreen`);
    await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);await sample(`${kind}-host-fullscreen-exit`);
    await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();await sample(`${kind}-native-gameplay`);await shot(`${kind}-native-gameplay`);
    await page.locator('#map-expand').click();assert.ok(await page.locator('.field-map').isVisible());await page.locator('.field-map [data-close]').click();
  }
  assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.failure=e.stack;result.failureViewport=await read().catch(()=>null);process.exitCode=1;await shot('failure').catch(()=>{});}
finally{
  await zoom(1).catch(()=>{});await cdp.send('Emulation.clearDeviceMetricsOverride').catch(()=>{});await cdp.detach();await context.close();
  await writeFile(join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({folder,passed:result.passed,samples:result.samples.length,failure:result.failure}));
}
