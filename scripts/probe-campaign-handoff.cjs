async(page)=>{
  await page.bringToFront();await page.locator('[data-speed="0"]').click();await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const modes=[];
  for(const mode of ['advance','defense','sandbox']){
    await page.getByRole('button',{name:'MENU',exact:true}).click();await page.getByRole('button',{name:'New operation',exact:true}).click();
    await page.locator(`[data-mode-choice="${mode}"]`).click();await page.locator('#launch-operation').click();await page.waitForTimeout(250);
    const entered=await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.mode??'sandbox');
    await page.getByRole('button',{name:'MENU',exact:true}).click();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
    const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
    modes.push({mode,entered,exactRestore:JSON.stringify(restored)===JSON.stringify(JSON.parse(saved)),saveUntouched:await page.evaluate(raw=>localStorage.getItem('frontlines-battlefield-v2')===raw,saved)});
  }
  await page.evaluate(()=>window.__FRONTLINES__.focus(-1490,-1508,150));await page.waitForTimeout(1200);
  await page.screenshot({path:'output/playwright/campaign-handoff-ammo-2026-09-23.png'});
  await page.getByRole('button',{name:'MENU',exact:true}).click();await page.getByRole('button',{name:'New operation',exact:true}).click();
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(250);
  await page.screenshot({path:'output/playwright/campaign-handoff-menu-1024-2026-09-23.png'});
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,menu:document.querySelector('.operation-menu').getBoundingClientRect().toJSON()}));
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();await page.setViewportSize({width:1440,height:960});
  return {checks:{allModes:modes.every(m=>m.mode===m.entered&&m.exactRestore&&m.saveUntouched),noHorizontalOverflow:layout.scrollWidth===layout.width},modes,layout,saved,state:await page.evaluate(()=>window.__FRONTLINES__.getState())};
}
