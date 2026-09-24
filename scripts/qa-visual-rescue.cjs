async(page)=>{
  const phase=page.url().split('#')[1]||'candidate',fixtures=await (await page.request.get('http://127.0.0.1:4173/output/visual-rescue-world2/fixtures.json')).json(),errors=[],samples=[];
  if(!/^[a-z0-9-]+$/.test(phase))throw Error('Use a new simple screenshot suffix in the URL hash.');
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.reload();
  await page.bringToFront();await page.setViewportSize({width:1600,height:900});
  if(await page.locator('.operation-menu').isVisible())await page.getByRole('button',{name:'Begin operation'}).click();
  await page.locator('[data-speed="0"]').click();const saved=await page.evaluate(()=>JSON.stringify(localStorage));
  for(const key of ['strategic','medium','infantry','trench','village','battle','logistics','impact','aftermath']){
    const fixture=fixtures[key];await page.evaluate(f=>{const a=window.__FRONTLINES__;a.restoreState(f.state);a.focus(f.focus.x,f.focus.z,f.zoom);a.selectSquads([]);},fixture);
    const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().drawCalls>20);await page.waitForTimeout(2200);await page.screenshot({path:`output/playwright/visual-${phase}-${key}.png`});
    samples.push({key,perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf()),stateUnchanged:await page.evaluate(s=>JSON.stringify(window.__FRONTLINES__.getState())===JSON.stringify(s),restored)});
  }
  return {scope:fixtures.scope,phase,samples,errors,checks:{noErrors:!errors.length,renderDoesNotChangeState:samples.every(s=>s.stateUnchanged),savesUntouched:saved===await page.evaluate(()=>JSON.stringify(localStorage))}};
}
