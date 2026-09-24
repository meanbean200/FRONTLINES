async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(before.operation.objectives.find(o=>o.id==='farm').owner!=='player')throw Error('Farm not yet captured');
  await page.getByRole('button',{name:/^× Baker /}).click();
  const target=await page.evaluate(()=>window.__FRONTLINES__.projectWorld(-1070,-1332));
  if(!target.visible)throw Error('Village target outside camera');
  await page.mouse.click(target.x,target.y,{button:'right'});
  await page.waitForFunction(()=>{const q=window.__FRONTLINES__.getState().squads.find(q=>q.name==='Baker');return q.order.type==='move'&&q.route.length;});
  return {checks:{reinforcement:'Baker to village after farm capture'},before,after:await page.evaluate(()=>window.__FRONTLINES__.getState())};
}
