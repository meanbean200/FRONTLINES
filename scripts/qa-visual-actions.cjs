async(page)=>{
  const suffix=page.url().split('#')[1]||'action';if(!/^[a-z0-9-]+$/.test(suffix))throw Error('Use a simple unused screenshot suffix.');
  const errors=[],shots=[],saved=await page.evaluate(()=>JSON.stringify(localStorage));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.bringToFront();await page.setViewportSize({width:1600,height:900});
  await page.locator('.operation-menu-button').click();await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().drawCalls>20);await page.waitForTimeout(1400);
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState()),q=before.squads.find(q=>q.kind==='rifle'&&q.faction!=='enemy');
  await page.locator('#roster-toggle').click();await page.locator(`[data-squad="${q.id}"]`).click();await page.locator('#roster-toggle').click();
  // Real order control and real inventory: no support missions injected by this probe.
  await page.locator('.support-controls>summary').click();await page.locator('[data-support="smokeGrenades"]').click();
  const target={x:q.x-16,z:q.z-5},p=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.05),target);if(!p.visible)throw Error('Smoke target not on screen');
  await page.mouse.click(p.x,p.y);const accepted=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.supportMissions?.some(m=>m.kind==='smokeGrenades'&&m.stage==='preparing'));
  if(!accepted)throw Error(await page.locator('#toast').innerText());await page.locator('.support-controls>summary').click();
  await page.locator('[data-speed="1"]').click();await page.waitForTimeout(5500);await page.locator('[data-speed="0"]').click();
  const smoke=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.smokeFields),spent=await page.evaluate(()=>window.__FRONTLINES__.getState().living.ledger.consumed.smokeGrenades)-before.living.ledger.consumed.smokeGrenades;await page.evaluate(p=>window.__FRONTLINES__.focus(p.x,p.z,60),target);await page.waitForTimeout(1200);
  await page.screenshot({path:`output/playwright/visual-${suffix}-smoke.png`});shots.push('smoke');
  const particles=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats().particles);
  // Exercise menu switches, real canvas sizing and state preservation under presentation changes.
  const paused=await page.evaluate(()=>window.__FRONTLINES__.getState());
  for(const quality of ['low','high','balanced']){
    await page.locator('.operation-menu-button').click();await page.locator('#menu-quality').selectOption(quality);await page.locator('#resume-session').click();await page.waitForTimeout(1000);
    await page.screenshot({path:`output/playwright/visual-${suffix}-${quality}.png`});shots.push(quality);
  }
  const stable=await page.evaluate(s=>JSON.stringify(s)===JSON.stringify(window.__FRONTLINES__.getState()),paused);
  const dimensions=[];for(const [width,height]of [[1920,1080],[2560,1440],[1000,600]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);dimensions.push(await page.locator('#battlefield').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,viewport:[innerWidth,innerHeight]})));}
  await page.screenshot({path:`output/playwright/visual-${suffix}-compact.png`});await page.setViewportSize({width:1600,height:900});
  // Explicitly controlled lighting inspection, not a claim of a night playthrough.
  await page.evaluate(()=>{const a=window.__FRONTLINES__,s=a.getState();s.living.campaignHours=22;a.restoreState(s);});await page.waitForTimeout(1300);await page.screenshot({path:`output/playwright/visual-${suffix}-night.png`});
  return {scope:'Fresh campaign through menu, roster selection, actual smoke order and 1x time, quality menu and window sizes. Additional controlled 22:00 lighting snapshot. No save writes.',errors,smoke,spent,particles,dimensions,shots,checks:{smokeDelivered:smoke.length>0,realGrenadeSpent:spent===1,effectsVisible:particles>0,qualityStateStable:stable,fullCanvas:dimensions.every(d=>Math.abs(d.width-d.viewport[0])<2&&Math.abs(d.height-d.viewport[1])<2),savesUntouched:saved===await page.evaluate(()=>JSON.stringify(localStorage)),noErrors:!errors.length}};
}
