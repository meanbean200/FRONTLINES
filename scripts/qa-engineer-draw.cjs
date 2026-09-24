async(page)=>{
  await page.bringToFront();
  await page.waitForFunction(()=>!document.querySelector('.tactical-overlay').classList.contains('camera-moving'));
  const initial=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const draw=async(points)=>{
    const projected=await page.evaluate(points=>points.map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z)),points);
    if(projected.some(p=>!p.visible||p.x<250||p.x>1170||p.y<120||p.y>720))throw Error('Trench draw outside clear playfield: '+JSON.stringify(projected));
    await page.getByRole('button',{name:'⚒Trench B'}).click();
    await page.mouse.move(projected[0].x,projected[0].y);await page.mouse.down();
    for(const p of projected.slice(1))await page.mouse.move(p.x,p.y,{steps:40});
    await page.mouse.up();
  };
  await draw([{x:-1550,z:-1400},{x:-1350,z:-1400}]);
  await draw([{x:-1450,z:-1400},{x:-1450,z:-1480}]);
  const planned=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(planned.trenches.length!==initial.trenches.length+2)throw Error('Expected both drawn trenches to be accepted');
  await page.screenshot({path:'output/playwright/engineer-plans-r1.png'});
  const newIds=planned.trenches.filter(t=>!initial.trenches.some(old=>old.id===t.id)).map(t=>t.id);
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<15;i++){
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(ids=>{
      const s=window.__FRONTLINES__.getState(),q=s.squads.find(q=>q.kind==='engineer');
      return {at:s.elapsed,trenches:s.trenches.filter(t=>ids.includes(t.id)),engineer:q,people:s.soldiers.filter(p=>p.squadId===q.id),perf:window.__FRONTLINES__.getPerf()};
    },newIds));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(1000);
  await page.screenshot({path:'output/playwright/engineer-fronts-r1.png'});
  return {scope:'Production browser; ordinary engineer roster selection and two left-drawn trenches, no fixtures.',initial,planned,newIds,samples,after:await page.evaluate(()=>window.__FRONTLINES__.getState())};
}
