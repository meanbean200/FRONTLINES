async(page)=>{
  const [phase='before',key='medium',quality='balanced']=page.url().split('#')[1]?.split(':')??[];
  const fixtures=await (await page.request.get('http://127.0.0.1:4173/output/visual-rescue-world2/fixtures.json')).json(),fixture=fixtures[key],samples=[],errors=[];
  if(!fixture)throw Error('Unknown fixture '+key);
  await page.bringToFront();await page.setViewportSize({width:1600,height:900});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(phase.startsWith('preset')){await page.reload();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();}
  await page.evaluate(()=>{if(window.__drawAudit)return;window.__drawAudit={calls:0,triangles:0};for(const [method,countIndex,instanceIndex]of [['drawElements',1,-1],['drawArrays',2,-1],['drawElementsInstanced',1,4],['drawArraysInstanced',2,3]]){const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){window.__drawAudit.calls++;if(args[0]===this.TRIANGLES)window.__drawAudit.triangles+=args[countIndex]/3*(instanceIndex<0?1:args[instanceIndex]);return original.apply(this,args);};}});
  for(const speed of [1,5]){
    await page.evaluate(({fixture,quality})=>{const a=window.__FRONTLINES__;a.restoreState(fixture.state);a.focus(fixture.focus.x,fixture.focus.z,fixture.zoom);a.setQuality(quality);a.selectSquads([]);},{fixture,quality});await page.waitForTimeout(1600);
    await page.locator(`[data-speed="${speed}"]`).click();
    const sample=await page.evaluate(()=>new Promise(resolve=>{const start=performance.now(),elapsed=window.__FRONTLINES__.getState().elapsed,rows=[];let last;
      const tick=time=>{if(last!==undefined){const p=window.__FRONTLINES__.getPerf();rows.push({interval:time-last,cpu:p.frameMs,sim:p.simulationMs,...window.__drawAudit});}last=time;window.__drawAudit.calls=window.__drawAudit.triangles=0;
        if(time-start<8000){requestAnimationFrame(tick);return;}const s=window.__FRONTLINES__.getState(),sort=k=>rows.map(r=>r[k]).sort((a,b)=>a-b),mean=k=>rows.reduce((n,r)=>n+r[k],0)/rows.length;
        resolve({wallSeconds:(time-start)/1000,advanced:s.elapsed-elapsed,finalSpeed:s.simSpeed,active:s.soldiers.filter(s=>s.needs?.life==='active').length,meanInterval:mean('interval'),p95:sort('interval')[Math.floor(rows.length*.95)],cpuMs:mean('cpu'),simulationMs:mean('sim'),drawCalls:mean('calls'),triangles:mean('triangles'),visual:window.__FRONTLINES__.getVisualStats?.()??null});};requestAnimationFrame(tick);
    }));await page.locator('[data-speed="0"]').click();samples.push({speed,...sample});
  }
  return {phase,key,quality,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),scope:'Same frozen fixture, real 1x/5x controls, 8 wall seconds each. GL triangles include shadow passes. CPU means use rolling engine samples.',samples,errors,checks:{noErrors:!errors.length,advancement:samples.every(s=>s.advanced>=s.speed*s.wallSeconds*.9),frameCadence:samples.every(s=>s.p95<16.7)}};
}
