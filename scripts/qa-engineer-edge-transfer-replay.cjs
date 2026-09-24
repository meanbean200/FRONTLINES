async(page)=>{
  await page.bringToFront();
  const originalSave=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Load',exact:true}).click();
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(before)!==JSON.stringify(loaded))throw Error('Completed-earthworks save did not reload exactly');
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).click();
  // Focus the construction crew beside the new T, then select infantry without moving the camera.
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).dblclick();
  await page.getByRole('button',{name:'× Rifle 01 10',exact:true}).click();
  await page.waitForTimeout(600);
  const capacities=await page.locator('.trench-capacity').allTextContents();
  await page.getByRole('button',{name:/0 \/ 109/}).click();
  const assigned=await page.evaluate(()=>window.__FRONTLINES__.getState()),rifle=assigned.squads.find(q=>q.name==='Rifle 01');
  if(rifle.order.trenchId!==256)throw Error('Cross-network assignment still rejected');
  if(!assigned.soldiers.some(s=>s.squadId===rifle.id&&s.duty?.relocationExit))throw Error('No physical relocation was scheduled');
  await page.screenshot({path:'output/playwright/engineer-edge-transfer-ordered-r1.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  const samples=[];
  for(let i=0;i<12;i++){
    await page.waitForTimeout(2000);
    samples.push(await page.evaluate(id=>{const s=window.__FRONTLINES__.getState();return {at:s.elapsed,people:s.soldiers.filter(p=>p.squadId===id),garrisons:s.living.garrisons};},rifle.id));
  }
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.screenshot({path:'output/playwright/engineer-edge-transfer-progress-r1.png'});
  return {checks:{exactReload:true,assigned:rifle.order,relocating:after.soldiers.filter(s=>s.squadId===rifle.id&&s.duty?.relocationExit).length,at:after.elapsed},originalSave,before,loaded,capacities,assigned,samples,after};
}
