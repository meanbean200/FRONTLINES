async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const savedBefore = await page.evaluate(() => ['frontlines-battlefield-v1','frontlines-battlefield-v2','frontlines-battlefield-v3'].map(k => localStorage.getItem(k)));
  await page.getByRole('button', {name:'OPEN-ENDED CAMPAIGN SAVE & RESUME Trench war', exact:true}).click();
  await page.getByRole('button', {name:'Begin operation →', exact:true}).click();
  await page.locator('[data-speed="0"]').click();
  await page.getByRole('button', {name:'Your force', exact:true}).click();
  await page.locator('.roster-row').filter({hasText:'Able'}).dblclick();
  await page.getByRole('button', {name:'Your force', exact:true}).click();
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => JSON.stringify(window.__FRONTLINES__.getState()));
  const samples = [];
  for (const [width,height] of [[1654,910],[1280,800],[1200,800],[1024,768],[800,600],[640,480],[390,700],[320,568],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(350);
    const sample = await page.evaluate(() => {
      const visible = s => {const e=document.querySelector(s);return e.getBoundingClientRect().width>0 && getComputedStyle(e).display!=='none';};
      const rect = s => {const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const overlap = (a,b) => Math.min(a.right,b.right)>Math.max(a.x,b.x) && Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y);
      const objective=rect('.operation-hud'),session=rect('.session-controls'),tools=rect('.hud-tools'),dock=rect('.command-dock'),garrison=rect('.garrison-panel'),support=rect('.support-controls');
      return {width:innerWidth,height:innerHeight,objective,session,tools,dock,garrison,support,checks:{rosterClosed:!visible('#force-roster'),inspectorClosed:!visible('#selection-card'),objectivesClear:!overlap(objective,session),toolsClear:!overlap(tools,dock),rightPanelsClear:!overlap(garrison,support),noOverflow:document.documentElement.scrollWidth===innerWidth,commandsInBounds:dock.x>=0&&dock.right<=innerWidth&&dock.bottom<=innerHeight,objectivesInBounds:objective.x>=0&&objective.right<=innerWidth&&objective.y>=0&&objective.bottom<=innerHeight}};
    });
    if ([1654,1280,640,390,320,844].includes(width)) await page.screenshot({path:`output/playwright/clean-hud-r2-${width}x${height}.png`});
    await page.getByRole('button', {name:'Your force', exact:true}).click();
    sample.checks.rosterOpens = await page.locator('#force-roster').isVisible();
    await page.getByRole('button', {name:'Selected squad details', exact:true}).click();
    sample.checks.inspectorOpensAlone = await page.locator('#selection-card').isVisible() && !await page.locator('#force-roster').isVisible();
    sample.checks.holdAccessible = await page.locator('#hold-command').isVisible();
    const bounds = await page.locator('#selection-card').boundingBox();
    sample.checks.inspectorFits = bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=width && bounds.y+bounds.height<=height;
    await page.getByRole('button', {name:'Selected squad details', exact:true}).click();
    samples.push(sample);
  }
  await page.setViewportSize({width:1654,height:910});
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.stringify(window.__FRONTLINES__.getState()));
  await page.locator('[data-objective="1"]').click();
  await page.waitForTimeout(900);
  const focused = await page.evaluate(() => {const api=window.__FRONTLINES__,o=api.getState().operation.objectives[1],p=api.projectWorld(o.x,o.z);return Math.abs(p.x-innerWidth/2)<5&&Math.abs(p.y-innerHeight/2)<5;});
  const modeChecks = [];
  for (const choice of ['QUICK OPERATION 10 MIN Village offensive','DEFENSIVE OPERATION 15 MIN Hold the crossroads','PEACEFUL SANDBOX OPEN ENDED Living battlefield']) {
    await page.getByRole('button', {name:'MENU',exact:true}).click();
    await page.getByRole('button', {name:'New operation',exact:true}).click();
    await page.getByRole('button', {name:choice,exact:true}).click();
    await page.locator('#launch-operation').click();
    await page.locator('[data-speed="0"]').click();
    await page.waitForTimeout(500);
    const sandbox = choice.startsWith('PEACEFUL');
    const timerVisible = await page.locator('.operation-topline b').isVisible();
    modeChecks.push({choice,pass:sandbox?!await page.locator('.operation-hud').isVisible():timerVisible&&/^\d+:\d{2}$/.test(await page.locator('.operation-topline b').innerText())});
  }
  // Restore only this QA session, not any saved slot or the user's 4173 origin.
  await page.evaluate(s => window.__FRONTLINES__.restoreState(JSON.parse(s)), before);
  await page.locator('[data-objective="0"]').click();
  const savedAfter = await page.evaluate(() => ['frontlines-battlefield-v1','frontlines-battlefield-v2','frontlines-battlefield-v3'].map(k => localStorage.getItem(k)));
  return {scope:'Actual Edge clean HUD, selection, opt-in drawers, all-mode objective display and responsive checks; paused campaign and all save keys preserved',samples,modeChecks,errors,checks:{allLayouts:samples.every(s=>Object.values(s.checks).every(Boolean)),objectivesFocusCamera:focused,allModes:modeChecks.every(m=>m.pass),campaignUnchanged:before===after,savesUnchanged:JSON.stringify(savedBefore)===JSON.stringify(savedAfter),noPageErrors:!errors.length}};
}
