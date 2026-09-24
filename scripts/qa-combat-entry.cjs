async(page)=>{
  await page.bringToFront();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const fixture=await (await page.request.get('http://127.0.0.1:4173/output/playwright/combat-entry-fixture-r1.json')).json();
  await page.evaluate(state=>{window.__FRONTLINES__.restoreState(state);window.__FRONTLINES__.focus(-1930,-2000,150);},fixture.state);
  await page.waitForTimeout(1200);
  await page.getByRole('button',{name:/^× Baker /}).click();
  await page.getByRole('button',{name:/Defend trench/}).click();
  await page.getByRole('button',{name:'1×',exact:true}).click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().soldiers.filter(s=>s.squadId===260).every(s=>s.duty));
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const approaching=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const people=approaching.soldiers.filter(s=>s.squadId===260);
  if(people.some(s=>!s.duty.entryPoint||s.duty.entryPoint.x<-2000))throw Error('Squad detoured to the remote trench entrance');
  if(!(await page.locator('.garrison-panel').getAttribute('open'))&&!(await page.locator('.garrison-panel').evaluate(e=>e.open)))throw Error('Trench explanation did not open');
  await page.screenshot({path:'output/playwright/combat-nearest-entry-r1.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().elapsed>=45,{}, {timeout:15000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const entered=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(entered.soldiers.filter(s=>s.squadId===260).some(s=>s.x<-2010||Math.abs(s.z+2000)>2))throw Error('Nearby entry did not finish locally');
  const savedAfter=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  if(savedAfter!==saved)throw Error('Synthetic test replaced saved campaign');
  await page.screenshot({path:'output/playwright/combat-entered-r1.png'});
  return {scope:fixture.scope,checks:{nearestEntry:true,allEightEntered:true,saveUnchanged:true},approaching,entered};
}
