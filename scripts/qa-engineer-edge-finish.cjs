async(page)=>{
  await page.bringToFront();
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(800);
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState()),ids=before.trenches.filter(t=>t.engineerSquadId).map(t=>t.id);
  await page.getByRole('button',{name:'5×',exact:true}).click();const samples=[];
  for(let i=0;i<38;i++){
    await page.waitForTimeout(1000);
    const sample=await page.evaluate(ids=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,trenches:s.trenches.filter(t=>ids.includes(t.id)),engineer:s.squads.find(q=>q.kind==='engineer'),perf:window.__FRONTLINES__.getPerf()};},ids);
    samples.push(sample);if(sample.trenches.every(t=>t.progress===1)&&sample.engineer.order.type==='hold')break;
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.mouse.move(780,430);await page.mouse.wheel(0,350);await page.waitForTimeout(1000);
  await page.screenshot({path:'output/playwright/engineer-edge-complete-r1.png'});
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState()),q=after.squads.find(q=>q.kind==='engineer');
  return {checks:{allComplete:after.trenches.filter(t=>ids.includes(t.id)).every(t=>t.progress===1),order:q.order.type,queue:q.constructionQueue,at:after.elapsed},before,samples,after};
}
