async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(before.operation?.mode!=='campaign'||before.simSpeed!==0)throw Error('Use a paused disposable campaign.');
  const engineer=before.squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy');
  const points=await page.evaluate(q=>[{x:q.x-100,z:q.z+40},{x:q.x-40,z:q.z+40}].map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3)),engineer);
  if(points.some(p=>!p.visible))throw Error('Focus the engineer and zoom out first.');
  if(await page.locator('#battlefield').getAttribute('data-mode')!=='trench')await page.keyboard.press('b');
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:20});
  const preview=await page.locator('.draft-readout').innerText();await page.mouse.up();
  const afterTrench=await page.evaluate(()=>({n:window.__FRONTLINES__.getState().trenches.length,mode:document.querySelector('#battlefield').dataset.mode,toast:document.querySelector('#toast').textContent}));
  await page.getByRole('button',{name:'Your force',exact:true}).click();
  const able=before.squads.find(q=>q.name==='Able');await page.locator(`[data-squad="${able.id}"]`).click();await page.getByRole('button',{name:'Your force',exact:true}).click();
  await page.locator('#move-command').click();
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:20});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.order-ink path[marker-end]')?.getAttribute('d').length>5);
  const afterMove=await page.evaluate(id=>({order:window.__FRONTLINES__.getState().squads.find(q=>q.id===id).order,toast:document.querySelector('#toast').textContent}),able.id);
  await page.screenshot({path:'output/playwright/field-issued-orders.png'});
  return {scope:'Actual draw/release through canvas and command buttons in a settled camera view',preview,afterTrench,afterMove,checks:{trenchIssued:afterTrench.n===before.trenches.length+1,returnedToSelection:afterTrench.mode==='select',routeIssued:afterMove.order.drawnPath?.length>1}};
}
