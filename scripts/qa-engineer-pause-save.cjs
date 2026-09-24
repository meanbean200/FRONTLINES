async(page)=>{
  await page.bringToFront();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v2')));
  const ids=saved.trenches.filter(t=>t.engineerSquadId).map(t=>t.id);
  await page.getByRole('button',{name:'◈Hold H'}).click();
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(3000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const stopped=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(saved.trenches.filter(t=>ids.includes(t.id)).some(t=>JSON.stringify(t.excavation)!==JSON.stringify(stopped.trenches.find(p=>p.id===t.id).excavation)))throw Error('Hold did not stop every front');
  await page.getByRole('button',{name:'Resume R',exact:true}).click();
  await page.getByRole('button',{name:'5×',exact:true}).click();await page.waitForTimeout(8000);
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  const resumed=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(!ids.every(id=>resumed.trenches.find(t=>t.id===id).progress>stopped.trenches.find(t=>t.id===id).progress))throw Error('Resume did not restart both jobs');
  await page.getByRole('button',{name:'Load',exact:true}).click();await page.waitForTimeout(800);
  const restored=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(JSON.stringify(restored)!==JSON.stringify(saved))throw Error('Saved multi-front state changed on Load');
  await page.getByRole('button',{name:'⚒ Engineer 1 8',exact:true}).click();
  await page.getByRole('button',{name:'⌖',exact:true}).click();await page.waitForTimeout(1200);
  await page.screenshot({path:'output/playwright/engineer-close-fronts-r1.png'});
  return {checks:{allFrontsPaused:true,allJobsResumed:true,exactSavedState:true},saved,stopped,resumed,restored};
}
