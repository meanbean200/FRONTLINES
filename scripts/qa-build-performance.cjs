async(page)=>{
  await page.bringToFront();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const samples=[];
  for(const speed of [1,5]){
    await page.locator(`[data-speed="${speed}"]`).click();await page.waitForTimeout(1500);
    const sample=await page.evaluate(()=>new Promise(resolve=>{
      const start=performance.now(),elapsed=window.__FRONTLINES__.getState().elapsed,intervals=[];let last;
      const tick=time=>{if(last!==undefined)intervals.push(time-last);last=time;if(time-start<10000){requestAnimationFrame(tick);return;}
        intervals.sort((a,b)=>a-b);const state=window.__FRONTLINES__.getState();
        resolve({wallSeconds:(time-start)/1000,advanced:state.elapsed-elapsed,personnel:state.soldiers.length,frames:intervals.length,p95:intervals[Math.floor(intervals.length*.95)],worst:intervals.at(-1),perf:window.__FRONTLINES__.getPerf()});
      };requestAnimationFrame(tick);
    }));
    await page.locator('[data-speed="0"]').click();samples.push({speed,...sample});
  }
  await page.screenshot({path:'output/playwright/build-performance-final-r1.png'});
  return {scope:'Short 96-person construction-scene smoke check, 1600x900; not a 300/1000-person stress test',samples,errors,checks:{noErrors:!errors.length,advancement:samples.every(s=>s.advanced>=s.wallSeconds*s.speed*.9),frameCadence:samples.every(s=>s.p95<16.7)}};
}
