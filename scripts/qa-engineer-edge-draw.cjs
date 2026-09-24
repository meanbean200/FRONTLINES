async(page)=>{
  await page.bringToFront();await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  const initial=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const draw=async(points)=>{
    let projected;
    for(let n=0;n<4;n++){
      projected=await page.evaluate(points=>points.map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z)),points);
      if(projected.every(p=>p.visible&&p.x>250&&p.x<1170&&p.y>120&&p.y<720))break;
      await page.mouse.move(700,450);await page.mouse.wheel(0,250);await page.waitForTimeout(800);
    }
    if(projected.some(p=>!p.visible||p.x<250||p.x>1170||p.y<120||p.y>720))throw Error('Cannot draw safely outside HUD');
    await page.getByRole('button',{name:'⚒Trench B'}).click();
    await page.mouse.move(projected[0].x,projected[0].y);await page.mouse.down();
    for(const p of projected.slice(1))await page.mouse.move(p.x,p.y,{steps:30});await page.mouse.up();
  };
  await draw([{x:-1550,z:-1400},{x:-1350,z:-1400}]);
  await draw([{x:-1450,z:-1400},{x:-1450,z:-1480}]);
  const planned=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const ids=planned.trenches.filter(t=>!initial.trenches.some(a=>a.id===t.id)).map(t=>t.id);
  if(ids.length!==2)throw Error('Both drawn jobs were not accepted');
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'1×',exact:true}).click();await page.waitForTimeout(800);
  await page.screenshot({path:'output/playwright/engineer-edge-walking-r1.png'});
  const walking=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(20000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1000);
  await page.screenshot({path:'output/playwright/engineer-edge-three-fronts-r1.png'});
  return {checks:{ordinaryDraw:true,ids,walkingActions:[...new Set(walking.soldiers.filter(s=>s.squadId===walking.squads.find(q=>q.kind==='engineer').id).map(s=>s.action))],at:after.elapsed,progress:after.trenches.filter(t=>ids.includes(t.id)).map(t=>t.progress),note:after.squads.find(q=>q.kind==='engineer').orderNote},initial,planned,walking,after};
}
