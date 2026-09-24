async (page) => {
  await page.bringToFront();
  await page.getByRole('combobox',{name:'Front',exact:true}).selectOption({label:'East'});
  await page.getByText('TRENCH COMMAND',{exact:true}).click();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<30;i++){
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(()=>{
      const s=window.__FRONTLINES__.getState();
      return {at:s.elapsed,speed:s.simSpeed,operation:s.operation,garrisons:s.living.garrisons.map(g=>({id:g.id,underFireUntil:g.underFireUntil,watchTarget:g.watchTarget})),squads:s.squads.map(q=>({id:q.id,faction:q.faction,x:q.x,z:q.z,order:q.order,movement:q.movementState,route:q.route.length,able:s.soldiers.filter(p=>p.squadId===q.id&&p.needs.life==='active').length}))};
    }));
    if(samples.at(-1).operation.status!=='active')break;
  }
  if(samples.at(-1).operation.status==='active')await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'output/playwright/enemy-ai-defense-contact-r1.png'});
  return {scope:'Production browser; ordinary UI all infantry Defend trench, east front, 5x. No state fixtures.',before,samples,after:await page.evaluate(()=>window.__FRONTLINES__.getState()),perf:await page.evaluate(()=>window.__FRONTLINES__.getPerf())};
}
