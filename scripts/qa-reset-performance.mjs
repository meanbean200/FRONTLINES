// Synthetic load benchmark, explicitly NOT normal-control gameplay acceptance.
// Owns a disposable Edge profile; never attaches to a player browser or save.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=path.resolve(process.argv[2]),results=[],errors=[];
const browser=await chromium.launch({channel:'msedge',headless:false,args:['--window-size=1640,980']});
const context=await browser.newContext({viewport:null});
try{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:4175/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  for(const count of [300,1000]){
    const fixture=JSON.parse(await readFile(path.join(folder,`performance-${count}.json`),'utf8'));
    for(const quality of count===300?['balanced','high']:['balanced'])for(const speed of [1,5]){
      await page.evaluate(({fixture,quality})=>{const a=window.__FRONTLINES__;a.restoreState(fixture);a.setQuality(quality);a.focus(-1000,-1500,720);},{fixture,quality});
      await page.waitForTimeout(3000);await page.locator('[data-speed="1"]').click();await page.waitForTimeout(12000);await page.locator(`[data-speed="${speed}"]`).click();await page.waitForTimeout(1500);
      const row=await page.evaluate(async()=>{
        const a=window.__FRONTLINES__,before=a.getState(),frames=[];let last,start;
        await new Promise(resolve=>{function tick(t){start??=t;if(last!==undefined)frames.push(t-last);last=t;if(t-start<6000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
        frames.sort((a,b)=>a-b);const after=a.getState();return{wallSeconds:(last-start)/1000,frames:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],p99:frames[Math.floor(frames.length*.99)],advanced:after.elapsed-before.elapsed,shots:after.operation.shots-before.operation.shots,active:after.soldiers.filter(p=>p.needs.life==='active').length,speed:after.simSpeed,perf:a.getPerf(),visual:a.getVisualStats(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
      });await page.locator('[data-speed="0"]').click();
      const result={count,quality,requestedSpeed:speed,...row};results.push(result);console.log(JSON.stringify(result));
      await page.screenshot({path:path.join(folder,`performance-${count}-${quality}-${speed}.png`),scale:'css'});
    }
  }
}finally{
  await writeFile(path.join(folder,'performance-report.json'),JSON.stringify({scope:'Synthetic world fixtures. Not evidence of normal-control construction, missions, or weapon acceptance.',results,errors},null,2));
  for(const page of context.pages())try{const c=await context.newCDPSession(page);await c.send('Emulation.clearDeviceMetricsOverride');await c.detach();}catch{}
  await browser.close();
}
