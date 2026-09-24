async(page)=>{
  await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="meeting"]').click();
  await page.locator('#battle-size').selectOption('large');await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();await page.locator('#rifle-select').click();await page.getByRole('button',{name:'Close forces',exact:true}).click();
  await page.locator('#map-expand').click();const r=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(r.x+r.width*.5,r.y+r.height*.48,{button:'right'});await page.mouse.click(r.x+r.width*.5,r.y+r.height*.48);
  return {summary:await page.evaluate(()=>window.__FRONTLINES__.getSummary()),nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
