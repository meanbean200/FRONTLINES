async (page) => {
  await page.bringToFront();
  const before=await page.evaluate(()=>({at:window.__FRONTLINES__.getState().elapsed,wall:performance.now()}));
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<30;i++){
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(()=>{
      const s=window.__FRONTLINES__.getState();
      return {at:s.elapsed,wall:performance.now(),operation:s.operation,perf:window.__FRONTLINES__.getPerf(),friendlyAble:s.soldiers.filter(p=>p.needs.life==='active'&&s.squads.find(q=>q.id===p.squadId).faction==='player').length,garrisons:s.living.garrisons.map(g=>({id:g.id,underFireUntil:g.underFireUntil,watchTarget:g.watchTarget})),squads:s.squads.map(q=>({id:q.id,x:q.x,z:q.z,order:q.order,movement:q.movementState,route:q.route.length}))};
    }));
    if(samples.at(-1).operation.status!=='active')break;
  }
  if(samples.at(-1).operation.status==='active')await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.waitForTimeout(300);
  const screenshot='output/playwright/enemy-ai-match-'+Math.round(before.at)+'-'+Date.now()+'.png';
  await page.screenshot({path:screenshot});
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  return {scope:'Continuation of ordinary-control operation, at 5x.',checks:{mode:after.operation.mode,status:after.operation.status,at:after.elapsed,shots:after.operation.shots,hits:after.operation.hits,screenshot},before,samples,after};
}
