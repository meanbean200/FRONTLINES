async (page) => {
  const out='output/playwright/operations-v2/r5-';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1600,height:900});await page.reload();
  await page.locator('[data-mode-choice="open-front"]').click();await page.locator('#launch-operation').click();
  await page.waitForTimeout(1700);await page.locator('[data-speed="5"]').click();
  const start=await page.evaluate(()=>({at:window.__FRONTLINES__.getState().elapsed,wall:performance.now(),bundle:document.querySelector('script[type=module]').src}));
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().elapsed>=95,null,{timeout:35000});
  await page.locator('[data-speed="0"]').click();
  const live=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,wall:performance.now(),mode:s.operation.mode,phase:s.operation.runtime.phase,commander:s.operation.runtime.commander,plans:s.operation.enemyAI.plans.map(p=>({role:p.role,orders:p.orders})),works:s.living.facilities.length,deliveries:s.living.trucks.map(t=>({side:t.faction??'player',state:t.state})),perf:window.__FRONTLINES__.getPerf()};});
  await page.screenshot({path:out+'live-campaign.png'});
  await page.locator('#build-command').click();await page.screenshot({path:out+'build-panel.png'});
  const build=await page.locator('#build-panel').innerText();await page.locator('[data-build-close]').click();
  await page.keyboard.press('g');await page.screenshot({path:out+'live-map.png'});await page.keyboard.press('Escape');
  await page.locator('#save-command').click();await page.reload();await page.locator('#continue-save').click();
  const resumed=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {mode:s.operation.mode,elapsed:s.elapsed,phase:s.operation.runtime.phase,commander:s.operation.runtime.commander};});
  const layouts=[];
  for(const size of [{width:2560,height:1440},{width:960,height:600}]){await page.setViewportSize(size);await page.waitForTimeout(450);await page.screenshot({path:`${out}live-${size.width}.png`});layouts.push(await page.evaluate(()=>{const canvas=document.querySelector('#battlefield').getBoundingClientRect(),hud=document.querySelector('.operation-hud').getBoundingClientRect();return {width:innerWidth,height:innerHeight,canvasFills:canvas.width===innerWidth&&canvas.height===innerHeight,hudFits:hud.x>=0&&hud.right<=innerWidth&&hud.y>=0&&hud.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};}));}
  await page.setViewportSize({width:1920,height:1080});
  return {scope:'Real Edge 5x clock, enemy orders, ongoing works/logistics, Build inspector, save/reload via UI, gameplay resizing; no developer state writes',start,live,build,resumed,layouts,errors,checks:{clockAdvanced:live.at>=95,commanderActive:live.plans.some(p=>p.orders>0),worksCreated:live.works>0,buildUsable:build.includes('Build & dig'),reloadExact:resumed.elapsed===live.at&&JSON.stringify(resumed.commander)===JSON.stringify(live.commander),layouts:layouts.every(l=>l.canvasFills&&l.hudFits&&!l.overflow),noPageErrors:errors.length===0}};
}
