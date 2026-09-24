async(page)=>{
  await page.bringToFront();
  await page.setViewportSize({width:1440,height:960});
  if(await page.getByRole('button',{name:'PEACEFUL SANDBOX OPEN ENDED Living battlefield'}).isVisible())await page.getByRole('button',{name:'PEACEFUL SANDBOX OPEN ENDED Living battlefield'}).click();
  if(await page.getByRole('button',{name:'Enter sandbox'}).isVisible())await page.getByRole('button',{name:'Enter sandbox'}).click();
  const phase=page.url().includes('depth-check=after')?'after':'before';
  if(!['before','after'].includes(phase))throw Error('Unknown capture name');
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  const initial=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const points=[{x:-1550,z:-1400},{x:-1350,z:-1400}];
  let projected;
  for(let i=0;i<4;i++){
    projected=await page.evaluate(points=>points.map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z)),points);
    if(projected.every(p=>p.visible&&p.x>250&&p.x<1170&&p.y>120&&p.y<720))break;
    await page.mouse.move(700,450);await page.mouse.wheel(0,250);await page.waitForTimeout(800);
  }
  if(projected.some(p=>!p.visible||p.x<250||p.x>1170||p.y<120||p.y>720))throw Error('Drawing overlaps HUD');
  await page.getByRole('button',{name:'⚒Trench B'}).click();
  await page.mouse.move(projected[0].x,projected[0].y);await page.mouse.down();
  await page.mouse.move(projected[1].x,projected[1].y,{steps:30});await page.mouse.up();
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(14000);
  const samples=[];
  for(let i=0;i<10;i++){
    await page.waitForTimeout(500);
    samples.push(await page.evaluate(()=>{
      const state=window.__FRONTLINES__.getState(),id=state.squads.find(q=>q.kind==='engineer').id;
      return {elapsed:state.elapsed,perf:window.__FRONTLINES__.getPerf(),engineers:state.soldiers.filter(s=>s.squadId===id).map(s=>({id:s.id,action:s.action,storedCover:s.cover,...window.__FRONTLINES__.terrainProbe(s.x,s.z)}))};
    }));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(900);
  await page.mouse.move(700,450);await page.mouse.wheel(0,-700);await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const q=state.squads.find(q=>q.kind==='engineer');
  const probes=await page.evaluate(id=>window.__FRONTLINES__.getState().soldiers.filter(s=>s.squadId===id).map(s=>({id:s.id,x:s.x,z:s.z,action:s.action,storedCover:s.cover,...window.__FRONTLINES__.terrainProbe(s.x,s.z)})),q.id);
  await page.screenshot({path:`output/playwright/engineer-depth-${phase}-r1.png`});
  // Camera-only diagnostic close-up; all gameplay above uses normal controls.
  const left=probes.reduce((a,b)=>a.x<b.x?a:b);
  await page.evaluate(p=>window.__FRONTLINES__.focus(p.x,p.z,40),left);await page.waitForTimeout(1200);
  await page.screenshot({path:`output/playwright/engineer-depth-${phase}-left-r1.png`});
  return {checks:{phase,ordinaryDraw:true,elapsed:state.elapsed,dug:state.trenches.filter(t=>!initial.trenches.some(a=>a.id===t.id)).map(t=>({id:t.id,span:t.excavation,progress:t.progress})),probes,selection:await page.locator('#selection-detail').innerText(),labels:await page.locator('.trench-capacity').allTextContents()},initial,state,samples};
}
