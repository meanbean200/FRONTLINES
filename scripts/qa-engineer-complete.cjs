async(page)=>{
  await page.bringToFront();
  const initial=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const ids=initial.trenches.filter(t=>t.engineerSquadId).map(t=>t.id);
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1200);
  const labels=await page.locator('.trench-capacity').evaluateAll(elements=>elements.filter(e=>getComputedStyle(e).display!=='none').map(e=>({text:e.textContent,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y}})));
  await page.screenshot({path:'output/playwright/engineer-final-three-fronts-r1.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<30;i++){
    await page.waitForTimeout(1000);
    const sample=await page.evaluate(ids=>{
      const s=window.__FRONTLINES__.getState();return {at:s.elapsed,trenches:s.trenches.filter(t=>ids.includes(t.id)),engineer:s.squads.find(q=>q.kind==='engineer'),people:s.soldiers.filter(p=>s.squads.find(q=>q.id===p.squadId).kind==='engineer'),perf:window.__FRONTLINES__.getPerf()};
    },ids);
    samples.push(sample);if(sample.trenches.every(t=>t.status==='complete'))break;
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(800);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const screenshot='output/playwright/engineer-progress-'+Math.round(initial.elapsed)+'-'+Date.now()+'.png';
  await page.screenshot({path:screenshot});
  return {checks:{allComplete:after.trenches.filter(t=>ids.includes(t.id)).every(t=>t.status==='complete'),at:after.elapsed,labels,screenshot},initial,ids,samples,after};
}
