async(page)=>{
  await page.bringToFront();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'Load',exact:true}).click();await page.waitForTimeout(800);
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(saved)!==JSON.stringify(restored))throw Error('Final build did not restore the exact saved engineer state');
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1000);
  const screenshot='output/playwright/engineer-final-load-'+Date.now()+'.png';
  await page.screenshot({path:screenshot});
  const bundle=await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.getAttribute('src')));
  return {checks:{exactSave:true,paused:restored.speed===0,bundle,screenshot,at:restored.elapsed},saved,restored};
}
