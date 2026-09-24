async page => {
  await page.getByRole('button',{name:'OPEN-ENDED CAMPAIGN SAVE & RESUME Trench war'}).click();
  await page.getByRole('button',{name:'Begin operation'}).click();
  await page.locator('[data-speed="0"]').click();
  await page.screenshot({path:'output/playwright/combat-v3-campaign-start.png'});
  return {scope:'Fresh campaign via actual Edge menu controls, isolated origin 4174',state:await page.evaluate(()=>window.__FRONTLINES__.getState()),overflow:await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth})),errors:await page.locator('.vite-error-overlay').count()};
}
