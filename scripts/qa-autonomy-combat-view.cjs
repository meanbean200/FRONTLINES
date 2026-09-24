async(page)=>{
  if(await page.locator('.field-map').isVisible())await page.locator('.field-map [data-close]').click();
  await page.locator('[data-speed="0"]').click();await page.locator('#map-expand').click();await page.locator('button[data-scale="theater"]').click();const r=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(r.x+r.width*.5,r.y+r.height*.48);if(await page.locator('.field-map').isVisible())await page.locator('.field-map [data-close]').click();await page.waitForTimeout(900);
  return {summary:await page.evaluate(()=>window.__FRONTLINES__.getSummary()),visual:await page.evaluate(()=>window.__FRONTLINES__.getVisualStats()),nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
