async (page) => {
  await page.bringToFront();
  const result=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const inspect=page.getByRole('button',{name:'Inspect battlefield Esc'});
  if(await inspect.isVisible())await inspect.click();
  const speedDisabled=await page.getByRole('button',{name:'5×',exact:true}).isDisabled();
  const holdDisabled=await page.getByRole('button',{name:'◈Hold H'}).isDisabled();
  if(!speedDisabled||!holdDisabled)throw Error('Result controls should be disabled');
  await page.keyboard.press('Space');await page.keyboard.press('h');
  await page.waitForTimeout(1500);
  const frozen=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(result)!==JSON.stringify(frozen))throw Error('Result changed under ordinary controls');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await page.waitForTimeout(1000);
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(restored)!==JSON.stringify(saved))throw Error('Original saved defense was not preserved');
  await page.screenshot({path:'output/playwright/enemy-ai-final-preserved-save-r2.png'});
  return {checks:{resultFrozen:true,speedDisabled,holdDisabled,originalSaveExact:true,result:result.operation.status,offensiveSeconds:result.elapsed,friendlyAble:result.soldiers.filter(p=>p.needs.life==='active'&&result.squads.find(q=>q.id===p.squadId).faction==='player').length,restoredMode:restored.operation.mode,restoredSeconds:restored.elapsed,restoredPlans:restored.operation.enemyAI.plans.length},result,restored};
}
