async(page)=>{
  await page.bringToFront();
  if(await page.locator('.operation-menu').isVisible()){await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();}
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),saved=await page.evaluate(()=>JSON.stringify(localStorage));
  if(await page.locator('#build-panel').isHidden())await page.locator('#build-command').click();
  const samples=[];
  for(const [width,height]of [[1920,1080],[1366,768],[907,510],[821,462],[560,760]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    const sample=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};},panel=box('#build-panel'),dock=box('.command-dock');return {width:innerWidth,height:innerHeight,panel,dock,fit:panel.x>=0&&panel.r<=innerWidth&&panel.b<=dock.y&&dock.r<=innerWidth&&dock.b<=innerHeight,hasScroll:document.querySelector('#build-panel').scrollHeight>panel.h,clockVisible:document.querySelector('#battle-time').getBoundingClientRect().width>0};});samples.push(sample);
    await page.locator('[data-build-kind="emplacement"]').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/build-layout-${width}-r2.png`});
  }
  await page.setViewportSize({width:1600,height:900});await page.locator('[data-build-close]').click();
  await page.mouse.move(700,440);await page.mouse.wheel(0,-450);await page.waitForTimeout(750);await page.screenshot({path:'output/playwright/build-close-terrain-r2.png'});
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  return {scope:'Construction controls, responsive scrolling and no save writes',samples,checks:{allFit:samples.every(s=>s.fit&&s.clockVisible),savedUnchanged:saved===await page.evaluate(()=>JSON.stringify(localStorage)),pausedUnchanged:JSON.stringify(state)===JSON.stringify(after)}};
}
