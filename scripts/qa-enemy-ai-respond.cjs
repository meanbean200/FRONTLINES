async (page) => {
  await page.bringToFront();
  await page.getByRole('button',{name:/^× Baker /}).click();
  await page.getByRole('button',{name:/^× Charlie /}).click({modifiers:['Shift']});
  await page.getByRole('button',{name:/^× Dog /}).click({modifiers:['Shift']});
  const target=await page.evaluate(()=>window.__FRONTLINES__.projectWorld(-1070,-1332));
  if(!target.visible)throw Error('Village is off screen');
  await page.mouse.click(target.x,target.y,{button:'right'});
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().squads.filter(q=>['Baker','Charlie','Dog'].includes(q.name)).every(q=>q.order.type==='move'&&q.route.length));
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<20;i++){
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(()=>({at:window.__FRONTLINES__.getState().elapsed,operation:window.__FRONTLINES__.getState().operation})));
    if(samples.at(-1).operation.status!=='active')break;
  }
  const advanced=await page.evaluate(()=>window.__FRONTLINES__.getState());
  // This run should still be active; a result requires using its menu load instead.
  if(advanced.operation.status!=='active')throw Error('Battle ended before mid-fight load check');
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await page.waitForTimeout(300);
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const exact=JSON.stringify(saved)===JSON.stringify(restored);
  if(!exact)throw Error('Paused enemy plans did not restore exactly');
  await page.screenshot({path:'output/playwright/enemy-ai-saved-battle-r1.png'});
  return {scope:'Ordinary roster selection, right-click reinforcements, Save, 20-second play, Load; no fixtures.',checks:{exactSavedState:exact,enemyPlanCount:saved.operation.enemyAI.plans.length,savedPaused:saved.simSpeed===0},saved,samples,advanced,restored};
}
