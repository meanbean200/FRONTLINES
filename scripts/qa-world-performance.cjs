async(page)=>{
 const phase=page.url().split('#')[1]||'before';if(!/^[a-z0-9-]+$/.test(phase))throw Error('Simple phase required');
 const data=await(await page.request.get(`http://127.0.0.1:4173/output/playwright/world-rebase/${phase}-world.json`)).json();
 await page.reload();
 const errors=[],samples=[],saved=await page.evaluate(()=>JSON.stringify(localStorage));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.bringToFront();await page.setViewportSize({width:1600,height:900});
 if(await page.locator('#launch-operation').isVisible())await page.locator('#launch-operation').click();
 await page.locator('[data-speed="0"]').click();
 const bundle=await page.locator('script[type="module"]').getAttribute('src');
 if(data.worldSize===4000&&await page.evaluate(()=>window.__FRONTLINES__.getVisualStats().generatedChunks)!==64)throw Error('Stale runtime: 4 km measurements require 64 real rendered chunks');
 for(const speed of [1,5]){
  await page.evaluate(f=>{const a=window.__FRONTLINES__;a.restoreState(f.state);a.focus(f.focus.x,f.focus.z,f.zoom);a.setQuality('balanced');a.selectSquads([]);},data.fixture);
  await page.waitForTimeout(3500);await page.locator(`[data-speed="${speed}"]`).click();
  samples.push(await page.evaluate(speed=>new Promise(resolve=>{
   const start=performance.now(),elapsed=window.__FRONTLINES__.getState().elapsed,rows=[];let last;
   const tick=time=>{if(last!==undefined){const p=window.__FRONTLINES__.getPerf(),v=window.__FRONTLINES__.getVisualStats();rows.push({dt:time-last,cpu:p.frameMs,sim:p.simulationMs,calls:v.drawCalls});}last=time;
    if(time-start<8000){requestAnimationFrame(tick);return;}
    const s=window.__FRONTLINES__.getState(),sorted=rows.map(r=>r.dt).sort((a,b)=>a-b),mean=k=>rows.reduce((n,r)=>n+r[k],0)/rows.length;
    resolve({speed,wallSeconds:(time-start)/1000,advanced:s.elapsed-elapsed,finalSpeed:s.simSpeed,active:s.soldiers.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),cpuMs:mean('cpu'),simulationMs:mean('sim'),drawCalls:mean('calls'),perf:window.__FRONTLINES__.getPerf(),visual:window.__FRONTLINES__.getVisualStats()});};requestAnimationFrame(tick);
  }),speed));await page.locator('[data-speed="0"]').click();
 }
 await page.screenshot({path:`output/playwright/world-rebase/${phase}-300.png`});
 return {phase,bundle,worldSize:data.worldSize,generatedChunks:data.chunks,generationMs:data.generationMs,navigation:data.routes,samples,errors,checks:{noErrors:!errors.length,savesUntouched:saved===await page.evaluate(()=>JSON.stringify(localStorage)),advanced:samples.every(s=>s.advanced>=s.wallSeconds*s.speed*.9),p95:samples.every(s=>s.p95<16.7)}};
}
