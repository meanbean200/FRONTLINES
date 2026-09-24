async(page)=>{
  await page.bringToFront();await page.evaluate(()=>window.__FRONTLINES__.focus(-1390,-1450,430));
  await page.locator('[data-speed="5"]').click();await page.waitForTimeout(30000);await page.locator('[data-speed="0"]').click();await page.waitForTimeout(200);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.screenshot({path:'output/playwright/campaign-combat-live-2026-09-23.png'});
  return {state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved:await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2')),perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf())};
}
