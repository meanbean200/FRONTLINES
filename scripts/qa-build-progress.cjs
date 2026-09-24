async(page)=>{
  await page.bringToFront();
  const initial=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const meal=initial.living.facilities.find(f=>f.kind==='meal'&&f.progress<1&&initial.living.garrisons.find(g=>g.id===f.garrisonId)?.faction!=='enemy');
  if(!meal)throw Error('First queue a meal bay through the construction UI.');
  if(await page.locator('#build-panel').isHidden())await page.locator('#build-command').click();
  await page.locator('.build-job').filter({hasText:'Meal bay'}).click();
  await page.locator('[data-speed="5"]').click();
  await page.waitForTimeout(20000);await page.locator('[data-speed="0"]').click();
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),f=state.living.facilities.find(f=>f.id===meal.id),t=state.trenches.find(t=>t.id===f.connectorId);
  const screenshot=`output/playwright/build-progress-${Math.floor(state.elapsed)}.png`;await page.screenshot({path:screenshot});
  const w=state.living,stocks=[w.rearStock,...(w.enemySupply?[w.enemySupply.stock]:[]),...w.garrisons.flatMap(g=>[g.cache,g.forwardStock]),...w.facilities.map(f=>f.stock),...w.trucks.map(t=>t.cargo),...w.crates.map(c=>c.stock),...state.soldiers.map(s=>s.carried),...(state.operation?.campaign?.replacements?.manifests??[]).map(m=>m.stock)];
  const errors=Object.keys(w.ledger.initial).map(k=>w.ledger.initial[k]+w.ledger.imported[k]-w.ledger.consumed[k]-w.ledger.lost[k]-stocks.reduce((n,s)=>n+(s?.[k]??0),0)-(k==='fuel'?w.trucks.reduce((n,t)=>n+t.fuel,0):0));
  return {scope:'20 wall-clock seconds of actual 5x browser simulation, no advance hook',screenshot,advanced:state.elapsed-initial.elapsed,facility:f,connector:t.progress,workers:state.soldiers.filter(s=>s.duty?.facilityId===meal.id).map(s=>({id:s.id,action:s.action,stage:s.duty?.stage})),checks:{advances:state.elapsed-initial.elapsed>50,materialsDelivered:f.paid,workProgress:t.progress>.001||f.progress>0,completed:f.progress===1,inventoryConserved:Math.max(...errors.map(Math.abs))<1e-6}};
}
