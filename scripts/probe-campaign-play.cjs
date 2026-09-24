async(page)=>{
  await page.bringToFront();
  const start=await page.evaluate(()=>window.__FRONTLINES__.getState().elapsed);
  await page.locator('[data-speed="5"]').click();
  await page.waitForFunction(at=>window.__FRONTLINES__.getState().elapsed>=at+175,start,{timeout:45000});
  await page.locator('[data-speed="0"]').click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.screenshot({path:'output/playwright/campaign-live-2026-09-23.png'});
  return {checks:{physicallyAdvanced:true,saved:!!saved,enemySelectorHidden:await page.locator('#garrison-choice option').count()===1},state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved,perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf())};
}
