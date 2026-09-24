async(page)=>{
  const f=(await (await page.request.get('http://127.0.0.1:4173/output/visual-rescue-world2/fixtures.json')).json()).impact,errors=[],samples=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.evaluate(f=>{window.__FRONTLINES__.restoreState(f.state);window.__FRONTLINES__.focus(f.focus.x,f.focus.z,50);},f);await page.waitForTimeout(1500);
  for(const [name,ms]of [['burst',650],['dust',1800],['settled',6000]]){await page.locator('[data-speed="1"]').click();await page.waitForTimeout(ms);await page.locator('[data-speed="0"]').click();await page.screenshot({path:`output/playwright/visual-impact-${name}.png`});samples.push({name,elapsed:await page.evaluate(()=>window.__FRONTLINES__.getState().elapsed),visual:await page.evaluate(()=>window.__FRONTLINES__.getVisualStats())});}
  return {scope:'Frozen real TypeScript mortar impact, followed with actual 1x controls. No fake crater or hidden damage injected.',samples,errors,checks:{noErrors:!errors.length,burstHasDust:samples[0].visual.particles>0}};
}
