async (page) => {
  const out='output/playwright/operations-v2/r2-';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.reload();
  await page.locator('[data-mode-choice="breakthrough"]').waitFor();
  const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await page.waitForTimeout(1500);await page.screenshot({path:out+'01-briefing.png'});
  await page.locator('#launch-operation').click();
  await page.locator('.primary-intent').waitFor();
  await page.keyboard.press('Space');
  const initial=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {mode:s.operation.mode,runtime:s.operation.runtime,elapsed:s.elapsed,personnel:s.soldiers.length,contacts:s.operation.contacts?.player??[],speed:s.simSpeed};});
  await page.waitForTimeout(1500);await page.screenshot({path:out+'02-breakthrough-deployment.png'});
  await page.keyboard.press('g');await page.locator('.field-map').waitFor();
  await page.screenshot({path:out+'03-breakthrough-map.png'});
  const map=await page.locator('.field-map h2').textContent();await page.keyboard.press('Escape');
  // Select and draw an order using mouse input; diagnostics only read the result.
  const marker=page.locator('.squad-marker:not(.enemy)').first();await marker.click();
  const box=await marker.boundingBox();
  await page.mouse.move(box.x+box.width/2+20,box.y+box.height+40);await page.mouse.down({button:'right'});
  await page.mouse.move(box.x+box.width/2+90,box.y+box.height+115,{steps:15});await page.mouse.up({button:'right'});
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  const moving=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState(),selected=window.__FRONTLINES__.getSummary().selected;return {elapsed:s.elapsed,speed:s.simSpeed,squad:s.squads.find(q=>q.id===selected[0]),soldiers:s.soldiers.filter(p=>p.squadId===selected[0]).map(p=>({x:p.x,z:p.z,action:p.action})),toast:document.querySelector('.toast')?.textContent};});
  await page.screenshot({path:out+'04-drawn-order.png'});
  await page.keyboard.press('Escape');await page.locator('#save-session').click();
  const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km'));return {mode:s.operation.mode,phase:s.operation.runtime.phase,elapsed:s.elapsed,order:s.squads[0].order};});
  await page.locator('#continue-save').click();
  const loaded=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {mode:s.operation.mode,phase:s.operation.runtime.phase,elapsed:s.elapsed,order:s.squads[0].order};});
  await page.keyboard.press('Escape');await page.locator('#choose-operation').click();
  const modes=[];
  for(const mode of ['line-defense','meeting','open-front']){
    await page.locator(`[data-mode-choice="${mode}"]`).click();await page.locator('#launch-operation').click();await page.waitForTimeout(1400);
    modes.push(await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {mode:s.operation.mode,phase:s.operation.runtime.phase,personnel:s.soldiers.length,trenches:s.trenches.length,enemyPlans:s.operation.enemyAI?.plans.length??0,hidden:!(s.operation.contacts?.player??[]).some(c=>c.visible)};}));
    await page.screenshot({path:`${out}05-${mode}.png`});
    await page.keyboard.press('Escape');await page.locator('#choose-operation').click();
  }
  // Change placement through the real menu. Existing save stays the first operation.
  await page.locator('[data-mode-choice="breakthrough"]').click();await page.locator('#sector-seed').fill('1945');await page.locator('#sector-seed').press('Tab');
  await page.locator('#launch-operation').click();await page.keyboard.press('g');await page.locator('.field-map').waitFor();
  await page.screenshot({path:out+'06-alternate-sector.png'});
  const alternate=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.runtime);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  const sizes=[];
  for(const size of [{width:1280,height:720},{width:960,height:600}]){await page.setViewportSize(size);await page.waitForTimeout(350);if(await page.locator('#choose-operation').count())await page.locator('#choose-operation').click();await page.screenshot({path:`${out}07-menu-${size.width}.png`});sizes.push(await page.evaluate(()=>{const d=document.querySelector('.operation-menu'),b=d.getBoundingClientRect();return {width:innerWidth,height:innerHeight,centered:Math.abs(b.x+b.width/2-innerWidth/2)<2,fits:b.right<=innerWidth&&b.bottom<=innerHeight,noOverflow:d.scrollWidth<=d.clientWidth,scrollable:d.scrollHeight>d.clientHeight};}));}
  await page.setViewportSize({width:1920,height:1080});
  const saveStill=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')).operation.mode);
  return {scope:'Headed Edge / production / real menu, map, selection, drawn-order, save and load controls',before,initial,moving,saved,loaded,modes,map,alternate,sizes,errors,checks:{runtimeV2:initial.runtime.version===2,startHidden:initial.contacts.length===0,drawnOrder:!!moving.squad.order.drawnPath,clockAdvances:moving.elapsed>initial.elapsed,saveMode:saved.mode===loaded.mode,saveOrder:JSON.stringify(saved.order)===JSON.stringify(loaded.order),newGamesPreserveSave:saveStill==='breakthrough',fourModes:modes.length===3&&modes.every(m=>m.hidden),differentPlacement:JSON.stringify(alternate.front)!==JSON.stringify(initial.runtime.front)||alternate.locations[0].name!==initial.runtime.locations[0].name,layouts:sizes.every(s=>s.centered&&s.fits&&s.noOverflow),noPageErrors:errors.length===0}};
}
