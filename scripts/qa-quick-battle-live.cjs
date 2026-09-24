async(page)=>{
  const out=`output/playwright/quick-battle/live-${Date.now()}-`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.reload();
  await page.locator('[data-mode-choice="open-front"]').click();await page.locator('#battle-size').selectOption('large');
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#sector-seed').press('Tab');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  const samples=[];
  for(const speed of [1,5]){
    await page.locator(`[data-speed="${speed}"]`).click();await page.waitForTimeout(1500);
    const before=await page.evaluate(()=>({sim:window.__FRONTLINES__.getState().elapsed,wall:performance.now()}));
    await page.waitForTimeout(6000);
    const after=await page.evaluate(()=>({sim:window.__FRONTLINES__.getState().elapsed,wall:performance.now(),perf:window.__FRONTLINES__.getPerf()}));
    samples.push({speed,simSeconds:after.sim-before.sim,wallSeconds:(after.wall-before.wall)/1000,perf:after.perf});
  }
  await page.locator('[data-speed="0"]').click();
  const state=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {population:s.soldiers.length,setup:s.operation.setup,elapsed:s.elapsed,commander:s.operation.runtime.commander,facilities:s.living.facilities.length,trucks:s.living.trucks.map(t=>t.state),orders:s.operation.enemyAI.plans.map(p=>p.orders)};});
  await page.screenshot({path:out+'battle.png'});await page.keyboard.press('g');await page.screenshot({path:out+'map.png'});await page.keyboard.press('Escape');
  await page.locator('#build-command').click();const build=await page.locator('#build-panel').innerText();await page.screenshot({path:out+'build.png'});await page.locator('[data-build-close]').click();
  // Keyboard-only entry into Advanced Setup must not scroll/reset or issue game orders.
  await page.locator('.operation-menu-button').click();await page.locator('#change-settings').click();
  await page.locator('.advanced-setup>summary').focus();await page.keyboard.press('Enter');
  const advanceOpen=await page.locator('.advanced-setup').evaluate(el=>el.open);
  const sizes=[];for(const width of [1280,960]){await page.setViewportSize({width,height:width===1280?720:600});await page.locator('#setup-time').selectOption('night');await page.screenshot({path:`${out}advanced-${width}.png`});sizes.push(await page.locator('.operation-menu').evaluate(el=>({width:innerWidth,noHorizontalOverflow:el.scrollWidth===el.clientWidth,scrollable:el.scrollHeight>el.clientHeight})));}
  return {scope:'Real controls, 160-person deployment gameplay; short samples are not full-combat performance certification',screenshots:out,bundle:await page.locator('script[type="module"]').getAttribute('src'),samples,state,build,advanceOpen,sizes,errors,checks:{population:state.population===160,simulationAdvanced:samples.every(s=>s.simSeconds/s.wallSeconds>=s.speed*.9),smoothSample:samples.every(s=>s.perf.p95Ms<16.7),enemyActive:state.orders.some(n=>n>0),buildAvailable:build.includes('Build & dig'),keyboardAdvanced:advanceOpen,layouts:sizes.every(s=>s.noHorizontalOverflow&&s.scrollable),noPageErrors:errors.length===0}};
}
