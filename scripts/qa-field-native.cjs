async (page) => {
  if(page.viewportSize()!==null)throw Error('Stop: player viewport must be native, not emulated.');
  const before=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),storage:JSON.stringify(Object.fromEntries(Object.entries(localStorage))),menu:Boolean(document.documentElement.dataset.menu),chosen:document.querySelector('.mode-card.chosen')?.dataset.modeChoice}));
  if(!before.menu)throw Error('Player is in a live game; do not reload during play.');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.reload();await page.waitForFunction(()=>window.__FRONTLINES__?.ready);
  await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),before.state);
  if(before.chosen)await page.locator(`[data-mode-choice="${before.chosen}"]`).click();
  const cdp=await page.context().newCDPSession(page),native=await cdp.send('Browser.getWindowForTarget'),samples=[];
  try {
    for(const [name,bounds]of [['desktop',{windowState:'maximized'}],['compact',{width:1040,height:780,left:40,top:40}],['short',{width:880,height:640,left:40,top:40}]]){
      await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'normal'}});await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds});await page.waitForTimeout(300);
      await page.locator('.operation-menu').evaluate(e=>e.scrollTop=0);
      samples.push(await page.evaluate(name=>{const r=document.querySelector('.operation-menu').getBoundingClientRect(),app=document.querySelector('#app').getBoundingClientRect();return {name,width:innerWidth,height:innerHeight,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,centered:Math.abs(r.x+r.width/2-innerWidth/2)<1,fills:app.width===innerWidth&&app.height===innerHeight};},name));
      await page.screenshot({path:`output/playwright/field-native-final-${name}.png`});await page.locator('#menu-quality').scrollIntoViewIfNeeded();
    }
  } finally {
    await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'normal'}});await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'maximized'}});await cdp.detach();
  }
  await page.locator('.operation-menu').evaluate(e=>e.scrollTop=0);
  const after=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),storage:JSON.stringify(Object.fromEntries(Object.entries(localStorage)))}));
  return {scope:'Built UI in the player Edge window; native resize and preserved campaign',samples,errors,checks:{nativeViewport:page.viewportSize()===null,allSizes:samples.every(s=>s.inside&&s.centered&&s.fills),campaignPreserved:JSON.stringify(before.state)===JSON.stringify(after.state),savesUntouched:before.storage===after.storage,noPageErrors:!errors.length}};
}
