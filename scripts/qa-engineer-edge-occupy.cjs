async(page)=>{
  await page.bringToFront();await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(8000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const complete=await page.evaluate(()=>window.__FRONTLINES__.getState()),engineer=complete.squads.find(q=>q.kind==='engineer');
  const works=complete.trenches.filter(t=>t.engineerSquadId);
  if(works.some(t=>t.progress!==1)||engineer.order.type!=='hold')throw Error('Earthworks still have remaining physical work');
  await page.screenshot({path:'output/playwright/engineer-edge-complete-r2.png'});
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).click();
  const main=works[0],point={x:(main.points[0].x+main.points.at(-1).x)/2,z:(main.points[0].z+main.points.at(-1).z)/2};
  const screen=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,1),point);
  const labels=await page.locator('.trench-capacity').evaluateAll(elements=>elements.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x+r.width/2,y:r.y+r.height/2,top:r.y};}));
  labels.sort((a,b)=>Math.hypot(a.x-screen.x,a.top-screen.y-20)-Math.hypot(b.x-screen.x,b.top-screen.y-20));
  if(!labels.length||Math.hypot(labels[0].x-screen.x,labels[0].top-screen.y-20)>3)throw Error('New network marker not in view');
  await page.mouse.click(labels[0].x,labels[0].y);
  const assigned=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const rifle=assigned.squads.find(q=>q.name==='Rifle 01');
  if(rifle.order.type!=='occupy-trench'||rifle.order.trenchId!==main.id)throw Error('Infantry did not join the new network');
  await page.getByRole('button',{name:'5×',exact:true}).click();const samples=[];
  for(let i=0;i<14;i++){
    await page.waitForTimeout(2000);
    samples.push(await page.evaluate(id=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,people:s.soldiers.filter(p=>p.squadId===id),garrisons:s.living.garrisons,perf:window.__FRONTLINES__.getPerf()};},rifle.id));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.screenshot({path:'output/playwright/engineer-edge-infantry-r1.png'});
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const entered=new Set(samples.flatMap(s=>s.people.filter(p=>p.cover==='trench').map(p=>p.id)));
  return {checks:{earthworksComplete:true,clearedQueue:engineer.constructionQueue,assignedNetwork:rifle.order.trenchId,everEntered:entered.size,alive:after.soldiers.filter(p=>p.needs.life==='active').length,at:after.elapsed},complete,labels,assigned,samples,after};
}
