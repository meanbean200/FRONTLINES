async(page)=>{
  await page.locator('[data-speed="0"]').click();
  await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();
  await page.locator('.roster-row').filter({hasText:'Baker'}).dblclick();
  await page.getByRole('button',{name:'Close forces',exact:true}).click();
  await page.waitForTimeout(1000);await page.mouse.move(850,410);await page.mouse.wheel(0,-900);await page.waitForTimeout(1000);
  return {summary:await page.evaluate(()=>window.__FRONTLINES__.getSummary()),nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
