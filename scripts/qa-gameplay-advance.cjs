async(page)=>{
  await page.locator('[data-speed="5"]').click();await page.waitForTimeout(35000);await page.locator('[data-speed="0"]').click();
  const stamp=Date.now();await page.screenshot({path:'output/playwright/gameplay-rescue/advance-'+stamp+'.png'});
  return {stamp,first:await page.evaluate(()=>window.__FRONTLINES_AUDIT.first),state:await page.evaluate(()=>window.__FRONTLINES__.getState()),audit:await page.evaluate(()=>{const a=window.__FRONTLINES_AUDIT;return {first:a.first,events:a.events,samples:a.samples};})};
}
