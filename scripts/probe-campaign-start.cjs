async(page)=>{
  await page.setViewportSize({width:1440,height:960});await page.reload();await page.bringToFront();
  await page.getByRole('button',{name:'OPEN-ENDED CAMPAIGN SAVE & RESUME Trench war'}).click();
  await page.screenshot({path:'output/playwright/campaign-menu-2026-09-23.png'});
  await page.getByRole('button',{name:'Begin operation'}).click();
  await page.locator('[data-speed="0"]').click();
  await page.locator('.garrison-panel > summary').click();
  await page.locator('.garrison-panel').getByText('Facilities & shipments',{exact:true}).click();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'Ammunition dugout',exact:true}).click();
  const mode=await page.locator('#battlefield').getAttribute('data-mode');
  const position={x:-1490,z:-1508};
  const screen=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z),position);
  await page.mouse.click(screen.x,screen.y);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.screenshot({path:'output/playwright/campaign-placed-ammo-2026-09-23.png'});
  return {checks:{mode:after.operation.mode,noTimeLimit:after.operation.duration===0,bothGarrisons:after.living.garrisons.length===2,enemyNotInSelector:await page.locator('#garrison-choice option').count()===1,placementMode:mode==='facility',placedAmmo:after.living.facilities.some(f=>f.kind==='ammo'),newConnector:after.trenches.length===before.trenches.length+1,notInstantBuilt:after.living.facilities.every(f=>f.progress===0)},screen,before,after,toast:await page.locator('#toast').textContent()};
}
