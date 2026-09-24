async(page)=>{
  await page.bringToFront();const result=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const raw=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:'Inspect battlefield Esc',exact:true}).click();
  await page.keyboard.press('Space');await page.keyboard.press('h');await page.waitForTimeout(500);
  const frozen=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(result)!==JSON.stringify(frozen))throw Error('Victory state changed after commands');
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(restored)!==raw)throw Error('Mode changes altered the mid-transfer campaign');
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).dblclick();
  await page.waitForTimeout(800);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(after.simSpeed!==0||after.elapsed!==restored.elapsed)throw Error('Restored pause not respected');
  await page.screenshot({path:'output/playwright/engineer-edge-final-paused-save-r1.png'});
  return {checks:{victoryFrozen:true,exactSavedState:true,stillPaused:true,at:after.elapsed,alive:after.soldiers.filter(s=>s.needs.life==='active').length},build:await page.locator('script[type="module"]').getAttribute('src'),result,restored,after,saved:raw};
}
