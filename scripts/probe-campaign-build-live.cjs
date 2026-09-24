async(page)=>{
  await page.bringToFront();if(!await page.locator('.garrison-panel').evaluate(e=>e.open))await page.locator('.garrison-panel > summary').click();
  const details=page.locator('.garrison-panel details').filter({has:page.getByText('Facilities & shipments',{exact:true})});if(!await details.evaluate(e=>e.open))await page.getByText('Facilities & shipments',{exact:true}).click();
  await page.getByRole('button',{name:'Ammunition dugout',exact:true}).click();const point=await page.evaluate(()=>window.__FRONTLINES__.projectWorld(-1490,-1508));await page.mouse.click(point.x,point.y);
  const placed=await page.evaluate(()=>window.__FRONTLINES__.getState().living.facilities.some(f=>f.kind==='ammo'));await page.locator('[data-speed="5"]').click();
  await page.waitForTimeout(30000);await page.locator('[data-speed="0"]').click();await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));await page.waitForTimeout(200);await page.screenshot({path:'output/playwright/campaign-ammo-construction-live-2026-09-23.png'});
  return {checks:{placed,saved:!!saved},state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved,perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf())};
}
