// Legacy probe runner: the first argument is an evidence label, NOT a browser
// session. Never attach to a player's browser or copy their saved campaigns.
import {chromium} from 'playwright';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const [label,probe,target,url='http://127.0.0.1:4175/']=process.argv.slice(2);
if(!label||!probe||!target||existsSync(target))throw Error('Pass label, probe file, unused evidence path, and optional URL.');
const source=readFileSync(probe,'utf8').trim();
if(/connectOverCDP|launchPersistentContext/.test(source))throw Error('Probes may not attach to reusable browsers/profiles.');
const browser=await chromium.launch({channel:'msedge',headless:false});
let evidence;
try {
  const context=await browser.newContext({viewport:source.includes('setViewportSize')?{width:1440,height:900}:null});
  const page=await context.newPage();
  await page.goto(url);await page.locator('#choose-operation').waitFor();
  evidence=await new Function('return ('+source+')')()(page);
  if(Object.values(evidence.checks??{}).some(value=>value===false))process.exitCode=1;
  if(evidence.nativeScreenshot?.data){const screenshot=target.replace(/\.json$/,'.png');writeFileSync(screenshot,Buffer.from(evidence.nativeScreenshot.data,'base64'),{flag:'wx'});evidence.nativeScreenshot=screenshot;}
}catch(error){evidence={failure:String(error)};process.exitCode=1;}
finally {
  // Even exceptions cannot leave emulation in a later reused game window.
  try {for(const owned of browser.contexts())for(const tab of owned.pages()){
    const cdp=await owned.newCDPSession(tab).catch(()=>null);
    if(cdp){await cdp.send('Emulation.clearDeviceMetricsOverride').catch(()=>{});await cdp.detach().catch(()=>{});}
  }} finally {await browser.close();}
  writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),label,probe,isolated:true,evidence},null,2),{flag:'wx'});
  console.log(JSON.stringify({target,isolated:true,checks:evidence?.checks,failure:evidence?.failure}));
}
