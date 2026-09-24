async(page)=>{
  await page.keyboard.press('Escape');
  await page.locator('[data-speed="0"]').click();await page.locator('#hold-command').click();
  if(!await page.locator('.hud-tools').evaluate(el=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();await page.locator('.roster-row').filter({hasText:'Fox'}).click();await page.getByRole('button',{name:'Close forces',exact:true}).click();
  await page.locator('#hold-command').click();await page.locator('#map-expand').click();const r=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(r.x+r.width*.5,r.y+r.height*((-250+2000)/4000));await page.waitForTimeout(900);
  await page.locator('#support-command').click();await page.locator('[data-support="mortarSmoke"]').click();
  const target=await page.evaluate(()=>window.__FRONTLINES__.projectWorld(0,-250,.2));if(!target.visible)throw Error('Target not in view');await page.mouse.click(target.x,target.y);
  const requested=await page.evaluate(()=>window.__FRONTLINES__.getCombatDiagnostics().support);await page.locator('[data-speed="5"]').click();
  return {requested,nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
