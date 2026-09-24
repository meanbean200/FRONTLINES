async(page)=>{
  await page.reload();await page.bringToFront();
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const savedRestored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(savedRestored)!==saved)throw Error('Paused mid-combat save did not restore exactly');
  const fixture=(await (await page.request.get('http://127.0.0.1:4173/output/playwright/combat-entry-r1.json')).json()).evidence.entered;
  fixture.simSpeed=0;
  for(const s of fixture.soldiers){
    if(s.squadId===305){s.z=-1970;s.nextShotAt=0;}
    if(s.garrisonId)s.nextShotAt=0;
  }
  await page.evaluate(state=>{window.__FRONTLINES__.restoreState(state);window.__FRONTLINES__.focus(-1930,-1990,65);},fixture);
  await page.getByRole('button',{name:/^× Baker /}).click();
  await page.locator('.garrison-panel>summary').click();
  await page.waitForTimeout(1200);
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'1×',exact:true}).click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().operation.shots>0,{}, {timeout:12000});
  await page.waitForFunction(()=>document.querySelector('.garrison-panel').hasAttribute('data-alarm'));
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.waitForTimeout(300);
  const alarm=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),summary:document.querySelector('#garrison-summary').textContent}));
  if(!alarm.summary.includes('COMBAT ALARM'))throw Error('No visible combat alarm');
  await page.screenshot({path:'output/playwright/combat-alarm-night-r2.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(start=>window.__FRONTLINES__.getState().elapsed>start+80,alarm.state.elapsed,{timeout:22000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.waitForTimeout(300);
  const after=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),perf:window.__FRONTLINES__.getPerf(),summary:document.querySelector('#garrison-summary').textContent,saved:localStorage.getItem('frontlines-battlefield-v2')}));
  if(after.saved!==saved)throw Error('Fixture overwrote saved campaign');
  if(!after.state.soldiers.some(s=>s.garrisonId&&s.needs.interruptedSleep>0))throw Error('No sleepers responded');
  await page.screenshot({path:'output/playwright/combat-trench-firefight-r2.png'});
  return {scope:'Synthetic night trench fixture; actual simulation firing and ordinary UI speed/selection controls',checks:{exactPausedLoad:true,alarm:alarm.summary,wokeSleepers:true,shots:after.state.operation.shots,hits:after.state.operation.hits,deaths:after.state.soldiers.filter(s=>s.needs.life==='dead').length,saveUnchanged:true},before,alarm,after};
}
