async(page)=>{
  await page.bringToFront();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'Load',exact:true}).click();await page.waitForTimeout(1500);
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(saved)!==JSON.stringify(restored)||restored.simSpeed!==0)throw Error('Paused multi-front save changed on final Load');
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1500);
  const elapsed=await page.evaluate(()=>window.__FRONTLINES__.getState().elapsed);
  if(elapsed!==restored.elapsed)throw Error('Paused simulation advanced');
  const screenshot='output/playwright/engineer-final-load-r2-'+Date.now()+'.png';
  await page.screenshot({path:screenshot});
  const bundle=await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.getAttribute('src')));
  return {checks:{exactSave:true,paused:true,elapsedUnchanged:true,bundle,screenshot,at:elapsed},saved,restored};
}
