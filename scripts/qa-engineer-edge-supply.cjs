async(page)=>{
  await page.bringToFront();
  const savedBefore=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  await page.getByRole('button',{name:'5×',exact:true}).click();const samples=[];
  for(let i=0;i<18;i++){
    await page.waitForTimeout(2000);
    samples.push(await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,g:s.living.garrisons.find(g=>g.trenchId===256),trucks:s.living.trucks.map(t=>({id:t.id,state:t.state,garrisonId:t.garrisonId,x:t.x,z:t.z,cargo:t.cargo})),people:s.soldiers.filter(p=>p.squadId===1)};}));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(100);
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).dblclick();await page.waitForTimeout(600);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState()),g=after.living.garrisons.find(g=>g.trenchId===256);
  await page.screenshot({path:'output/playwright/engineer-edge-new-network-supply-r1.png'});
  return {checks:{at:after.elapsed,forwardDelivery:samples.some(s=>s.g.forwardStock.food>0),footDelivery:g.cache.food>0,food:g.cache.food,water:g.cache.water,alive:after.soldiers.filter(s=>s.needs.life==='active').length,savedUnchanged:savedBefore===await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))},samples,after};
}
