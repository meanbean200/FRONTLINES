async(page)=>{
  await page.bringToFront();
  const result=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),saved:localStorage.getItem('frontlines-battlefield-v2')}));
  if(result.state.operation.status==='active')throw Error('Operation not finished');
  await page.screenshot({path:'output/playwright/combat-offensive-result-r1.png'});
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.waitForTimeout(1000);
  await page.screenshot({path:'output/playwright/combat-mid-battle-load-r1.png'});
  return {scope:'Ordinary offensive; after-action and UI load of the isolated paused mid-battle save',checks:{result:result.state.operation.status,elapsed:result.state.elapsed,restoredAt:restored.elapsed,restoredSpeed:restored.simSpeed},result,restored};
}
