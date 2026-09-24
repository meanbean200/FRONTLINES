async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getSummary());
  await page.keyboard.down('KeyA');
  const box=await page.getByRole('button',{name:'Select Baker',exact:true}).boundingBox();
  if(!box)throw Error('Baker label is not on screen');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  const during=await page.evaluate(()=>({summary:window.__FRONTLINES__.getSummary(),inert:document.querySelector('.tactical-overlay').inert,opacity:getComputedStyle(document.querySelector('.tactical-overlay')).opacity}));
  await page.keyboard.up('KeyA');
  const baker=await page.evaluate(()=>window.__FRONTLINES__.getState().squads.find(q=>q.name==='Baker').id);
  if(!during.summary.selected.includes(baker))throw Error('Moving-camera label click failed to change selection');
  await page.screenshot({path:'output/playwright/continuous-labels-selection-r1.png'});
  return {checks:{changedSelection:JSON.stringify(before.selected)!==JSON.stringify(during.summary.selected),selectedBaker:true,visible:during.opacity==='1'&&!during.inert,elapsedUnchanged:before.elapsed===during.summary.elapsed},before,during};
}
