async(page)=>{
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.reload();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  await page.waitForTimeout(500);
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const exact=JSON.stringify(loaded)===JSON.stringify(JSON.parse(saved));
  await page.locator('.garrison-panel > summary').click();
  const details=page.locator('.garrison-panel details').filter({has:page.getByText('Facilities & shipments',{exact:true})});if(!await details.evaluate(e=>e.open))await page.getByText('Facilities & shipments',{exact:true}).click();
  await page.getByRole('button',{name:'Supply store',exact:true}).click();await page.keyboard.press('Escape');
  const cancelled=await page.locator('.operation-menu').isHidden();
  await page.locator('[data-speed="5"]').click();await page.waitForTimeout(30000);await page.locator('[data-speed="0"]').click();
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForTimeout(250);
  await page.screenshot({path:'output/playwright/campaign-final-load-2026-09-23.png'});
  return {checks:{exact,cancelled},build:await page.locator('script[type="module"]').getAttribute('src'),state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved:await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2')),perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf())};
}
