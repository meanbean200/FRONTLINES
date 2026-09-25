// Deliberately reproduce the OLD test-tool failure in our own disposable Edge.
// Never connects to CDP, a running browser, or a user's profile.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const folder=resolve('output/playwright',`viewport-before-${Date.now()}`);
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:false});
const context=await browser.newContext({viewport:{width:960,height:600}});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
const result={folder,samples:[]};
const read=()=>page.evaluate(()=>{
  const box=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
  return {inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],visual:[visualViewport?.width,visualViewport?.height],dpr:devicePixelRatio,document:box('html'),body:box('body'),app:box('#app'),canvas:box('#battlefield'),menu:box('.operation-menu'),backing:[document.querySelector('canvas').width,document.querySelector('canvas').height]};
});
try{
  await page.goto(process.argv[2]??'http://127.0.0.1:4175/');await page.locator('#choose-operation').waitFor();
  const {windowId}=await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{left:0,top:0,width:1700,height:1000}});
  result.samples.push({stage:'pinned',...await read()});
  await page.setViewportSize({width:0,height:0});
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width:1690,height:990}});
  await page.waitForFunction(()=>innerWidth>1200);
  result.samples.push({stage:'after-native-resize',...await read()});
  await page.reload();await page.locator('#choose-operation').waitFor();
  result.samples.push({stage:'after-refresh',...await read()});
  await page.bringToFront();
  const {bounds}=await cdp.send('Browser.getWindowBounds',{windowId});
  // Capture the ENTIRE native window: a page-only screenshot hides unused space.
  const helper=resolve(process.env.USERPROFILE,'.codex/skills/screenshot/scripts/take_screenshot.ps1');
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',helper,'-Path',join(folder,'refresh-full-window.png'),'-Region',`${bounds.left},${bounds.top},${bounds.width},${bounds.height}`]);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  result.samples.push({stage:'after-cdp-clear',...await read()});
  await page.reload();await page.locator('#choose-operation').waitFor();
  result.samples.push({stage:'refresh-after-cdp-clear',...await read()});
}catch(error){result.failure=String(error);process.exitCode=1;}
finally{
  await cdp.send('Emulation.clearDeviceMetricsOverride').catch(()=>{});
  await cdp.detach();await context.close();await browser.close();
  await writeFile(join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
