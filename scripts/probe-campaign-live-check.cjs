async(page)=>{
  const events=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())events.push({event:'navigation',url:frame.url(),at:Date.now()});});page.on('crash',()=>events.push({event:'crash',at:Date.now()}));page.on('pageerror',e=>events.push({event:'error',text:String(e)}));
  await page.bringToFront();await page.getByRole('button',{name:'OPEN-ENDED CAMPAIGN SAVE & RESUME Trench war'}).click();await page.getByRole('button',{name:'Begin operation'}).click();await page.locator('[data-speed="5"]').click();
  const samples=[];for(let i=0;i<7;i++){await page.waitForTimeout(4000);samples.push(await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),perf:window.__FRONTLINES__.getPerf(),menu:document.documentElement.dataset.menu})));}
  if(!await page.locator('.operation-menu').isVisible()){await page.locator('[data-speed="0"]').click();await page.getByRole('button',{name:'Save',exact:true}).click();}
  await page.screenshot({path:'output/playwright/campaign-live-check-2026-09-23.png'});
  return {checks:{noNavigation:events.length===0,advanced:samples.at(-1).state.elapsed>110},events,samples,saved:await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))};
}
