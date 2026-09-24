async(page)=>{
  await page.bringToFront();await page.reload();
  const earlierSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(earlierSave)!==JSON.stringify(loaded))throw Error('Completed-earthworks save changed on final build');
  await page.getByRole('button',{name:/Engineer 1 8$/}).dblclick();
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).click();await page.waitForTimeout(600);
  await page.getByRole('button',{name:/0 \/ 109/}).click();
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(5000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(100);
  const travelling=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const text=await page.locator('#selection-detail').innerText();
  if(!text.includes('Relocating')||!travelling.soldiers.some(s=>s.duty?.relocationExit))throw Error('Transfer not visible in selection status');
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(600);
  const marker=await page.locator('.squad-marker.selected small').innerText();
  if(marker!=='RELOCATING')throw Error('World label falsely says defending: '+marker);
  await page.screenshot({path:'output/playwright/engineer-edge-transfer-walking-final-r1.png'});
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  await page.getByRole('button',{name:'1×',exact:true}).click();await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Load',exact:true}).click();
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(saved)!==JSON.stringify(restored))throw Error('Mid-transfer save did not continue exactly');
  await page.getByRole('button',{name:'5×',exact:true}).click();const samples=[];
  for(let i=0;i<11;i++){
    await page.waitForTimeout(2000);
    samples.push(await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,people:s.soldiers.filter(p=>p.squadId===1),perf:window.__FRONTLINES__.getPerf()};}));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(100);
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(600);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState()),people=after.soldiers.filter(s=>s.squadId===1);
  if(people.some(s=>s.duty?.relocationExit||s.cover!=='trench'))throw Error('Not all 10 people physically entered');
  await page.screenshot({path:'output/playwright/engineer-edge-transfer-complete-final-r1.png'});
  return {checks:{initialExactLoad:true,midTransferExactLoad:true,travellingText:text,travellingMarker:marker,entered:people.length,alive:after.soldiers.filter(s=>s.needs.life==='active').length,paused:after.simSpeed===0,at:after.elapsed},build:await page.locator('script[type="module"]').getAttribute('src'),earlierSave,loaded,travelling,saved,restored,samples,after};
}
