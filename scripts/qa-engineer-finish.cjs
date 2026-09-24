async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const ids=before.trenches.filter(t=>t.engineerSquadId).map(t=>t.id);
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<15;i++){
    await page.waitForTimeout(1000);
    const sample=await page.evaluate(ids=>{
      const s=window.__FRONTLINES__.getState();return {at:s.elapsed,trenches:s.trenches.filter(t=>ids.includes(t.id)),engineer:s.squads.find(q=>q.kind==='engineer'),perf:window.__FRONTLINES__.getPerf()};
    },ids);
    samples.push(sample);if(sample.trenches.every(t=>t.status==='complete')&&sample.engineer.order.type==='hold')break;
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.mouse.move(620,430);await page.mouse.wheel(0,350);await page.waitForTimeout(1200);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const screenshot='output/playwright/engineer-completed-network-'+Date.now()+'.png';
  await page.screenshot({path:screenshot});
  const engineer=after.squads.find(q=>q.kind==='engineer');
  return {checks:{allComplete:after.trenches.filter(t=>ids.includes(t.id)).every(t=>t.status==='complete'),finishedOrder:engineer.order.type,queue:engineer.constructionQueue,work:engineer.engineerWork??null,at:after.elapsed,screenshot},before,ids,samples,after};
}
