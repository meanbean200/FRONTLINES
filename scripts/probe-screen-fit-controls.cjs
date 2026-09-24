async(page)=>{
  await page.bringToFront();await page.reload();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2')),before=await page.evaluate(()=>window.__FRONTLINES__.getState()),samples=[];
  for(const [width,height] of [[1024,600],[600,400],[390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    await page.locator('#roster-toggle').click();await page.locator('.roster-row.engineer').first().click();
    await page.locator('[data-hud-panel="selection"]').click();await page.waitForTimeout(250);
    const selected=await page.locator('.selection-card').isVisible(),forceClosed=await page.locator('.force-roster').isHidden();
    await page.screenshot({path:`output/playwright/screen-fit-details-final-${width}x${height}-2026-09-23.png`});
    await page.locator('[data-hud-panel="map"]').click();const mapVisible=await page.locator('.map-panel').isVisible();await page.locator('#map-overview').click();
    await page.locator('.garrison-panel > summary').click();await page.waitForTimeout(250);const mapClosed=await page.locator('.map-panel').isHidden();
    const facilities=page.locator('.garrison-panel details').filter({has:page.getByText('Facilities & shipments',{exact:true})});if(!await facilities.evaluate(e=>e.open))await page.getByText('Facilities & shipments',{exact:true}).click();
    await page.getByRole('button',{name:'Ammunition dugout',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`output/playwright/screen-fit-trench-final-${width}x${height}-2026-09-23.png`});
    await page.getByRole('button',{name:'Ammunition dugout',exact:true}).click();await page.waitForTimeout(250);
    const placement=await page.evaluate(()=>{const a=document.querySelector('.mode-label').getBoundingClientRect(),b=document.querySelector('.command-dock').getBoundingClientRect(),t=document.querySelector('.toast').getBoundingClientRect();return {mode:document.querySelector('#battlefield').dataset.mode,hintInBounds:a.x>=0&&a.right<=innerWidth&&a.y>=0&&a.bottom<=b.y,toastAboveHint:t.bottom<=a.y};});
    await page.keyboard.press('Escape');const cancelled=await page.locator('.operation-menu').isHidden();
    await page.locator('#help-toggle').click();await page.locator('#controls-drawer p').last().scrollIntoViewIfNeeded();const help=await page.locator('#controls-drawer').evaluate(e=>({scrollable:e.scrollHeight>e.clientHeight,rect:e.getBoundingClientRect().toJSON()}));await page.locator('#help-close').click();
    await page.getByRole('button',{name:'MENU',exact:true}).click();await page.getByRole('button',{name:'New operation',exact:true}).click();
    await page.screenshot({path:`output/playwright/screen-fit-menu-final-${width}x${height}-2026-09-23.png`});await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
    samples.push({width,height,selected,forceClosed,mapVisible,mapClosed,placement,cancelled,help});
  }
  return {checks:{controls:samples.every(s=>s.selected&&s.forceClosed&&s.mapVisible&&s.mapClosed&&s.cancelled&&s.placement.mode==='facility'&&s.placement.hintInBounds&&s.placement.toastAboveHint),stateUnchanged:JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>window.__FRONTLINES__.getState())),saveUntouched:saved===await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))},samples};
}
