async(page)=>{
  await page.bringToFront();
  if(await page.getByRole('button',{name:'Load saved campaign',exact:true}).isVisible())await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const existing=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(before.simSpeed!==0)throw Error('Expected a paused excavation checkpoint');
  if(existing!==null&&JSON.stringify(before)!==existing)throw Error('Preserve the existing campaign; only retry from that exact saved state');
  if(existing===null)await page.getByRole('button',{name:'Save',exact:true}).click();
  const stored=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(25000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const complete=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const q=complete.squads.find(q=>q.kind==='engineer'),jobs=complete.trenches.filter(t=>t.engineerSquadId===q.id);
  if(!jobs.length||jobs.some(t=>t.progress!==1)||q.order.type!=='hold')throw Error('Earthworks did not complete');
  await page.screenshot({path:'output/playwright/engineer-depth-complete-r1.png'});
  await page.getByRole('button',{name:'Load',exact:true}).click();await page.waitForTimeout(1500);
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(stored!==JSON.stringify(loaded))throw Error('Paused excavation did not restore exactly');
  const covers=await page.evaluate(()=>{
    const state=window.__FRONTLINES__.getState(),q=state.squads.find(q=>q.kind==='engineer');
    return state.soldiers.filter(s=>s.squadId===q.id).map(s=>({id:s.id,stored:s.cover,...window.__FRONTLINES__.terrainProbe(s.x,s.z)}));
  });
  await page.screenshot({path:'output/playwright/engineer-depth-restored-r1.png'});
  return {checks:{completedAt:complete.elapsed,queueEmpty:(q.constructionQueue??[]).length===0,allJobsComplete:true,exactPausedRestore:true,schema:JSON.parse(stored).policySchema,covers,build:await page.locator('script[type="module"]').getAttribute('src')},before,stored,complete,loaded};
}
