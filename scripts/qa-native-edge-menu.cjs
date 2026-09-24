async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const before=await page.evaluate(()=>({state:JSON.stringify(window.__FRONTLINES__.getState()),storage:JSON.stringify(Object.fromEntries(Object.entries(localStorage))),chosen:document.querySelector('.mode-card.chosen').dataset.modeChoice}));
  if(page.viewportSize()!==null)throw Error('Player session still has an emulated viewport. Stop without applying another override.');
  await page.reload();
  await page.evaluate(s=>window.__FRONTLINES__.restoreState(JSON.parse(s)),before.state);
  await page.locator(`[data-mode-choice="${before.chosen}"]`).click();
  const cdp=await page.context().newCDPSession(page),native=await cdp.send('Browser.getWindowForTarget');
  const samples=[],modes=[];
  try {
    for(const [label,bounds] of [['maximized',{windowState:'maximized'}],['1280x850',{width:1280,height:850,left:30,top:30}],['960x720',{width:960,height:720,left:30,top:30}],['650x620',{width:650,height:620,left:30,top:30}],['430x760',{width:430,height:760,left:30,top:30}]]) {
      await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'normal'}});
      await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds});
      await page.waitForTimeout(500);
      await page.locator('.operation-menu').evaluate(e=>e.scrollTop=0);
      const sample=await page.evaluate(()=>{
        const app=document.querySelector('#app').getBoundingClientRect(),canvas=document.querySelector('#battlefield').getBoundingClientRect(),menu=document.querySelector('.operation-menu').getBoundingClientRect();
        return {inner:{width:innerWidth,height:innerHeight},outer:{width:outerWidth,height:outerHeight},menu:{x:menu.x,y:menu.y,width:menu.width,height:menu.height},checks:{appFills:app.width===innerWidth&&app.height===innerHeight,canvasFills:canvas.width===innerWidth&&canvas.height===innerHeight,menuCentered:Math.abs(menu.x+menu.width/2-innerWidth/2)<1,menuFits:menu.x>=0&&menu.right<=innerWidth&&menu.y>=0&&menu.bottom<=innerHeight,noHorizontalOverflow:document.documentElement.scrollWidth===innerWidth&&document.querySelector('.operation-menu').scrollWidth<=menu.width}};
      });
      await page.screenshot({path:`output/playwright/menu-native-r2-${label}.png`});
      await page.locator('#menu-quality').scrollIntoViewIfNeeded();
      sample.checks.settingsReachable=await page.locator('#menu-quality').isVisible();
      samples.push({label,...sample});
    }
    await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'maximized'}});
    for(const mode of ['campaign','advance','defense','sandbox']){
      await page.locator(`[data-mode-choice="${mode}"]`).click();
      modes.push(await page.evaluate(mode=>{
        const chosen=document.querySelector('.mode-card.chosen'),info=document.querySelector('.mode-description').textContent;
        return {mode,description:info,checks:{oneSelection:document.querySelectorAll('.mode-card.chosen').length===1&&document.querySelectorAll('.mode-card[aria-pressed=true]').length===1,rightSelection:chosen.dataset.modeChoice===mode,selectionLabel:getComputedStyle(chosen.querySelector('strong'),'::after').content.includes('SELECTED'),rightDescription:info.includes(mode==='campaign'?'No time limit':mode==='advance'?'180 control points':mode==='defense'?'Defend the village':'No enemy')}};
      },mode));
    }
    await page.locator('[data-mode-choice="advance"]').click();
    await page.keyboard.press('Shift+Tab');
    const focus=await page.evaluate(()=>({focused:document.activeElement.getAttribute('data-mode-choice'),selected:document.querySelector('.mode-card.chosen').dataset.modeChoice,outline:getComputedStyle(document.activeElement).outlineStyle,selectedFill:getComputedStyle(document.querySelector('.mode-card.chosen')).backgroundColor,focusedFill:getComputedStyle(document.activeElement).backgroundColor}));
    await page.screenshot({path:'output/playwright/menu-keyboard-focus-r2.png'});
    await page.keyboard.press('Enter');
    const activated=await page.locator('[data-mode-choice="campaign"]').getAttribute('aria-pressed')==='true';
    await page.locator(`[data-mode-choice="${before.chosen}"]`).click();
    await page.locator('.operation-menu').evaluate(e=>e.scrollTop=0);
    const after=await page.evaluate(()=>({state:JSON.stringify(window.__FRONTLINES__.getState()),storage:JSON.stringify(Object.fromEntries(Object.entries(localStorage)))}));
    return {scope:'Real Edge window resizing with viewport=null; menu selection and keyboard verification',samples,modes,focus,errors,checks:{nativeViewport:page.viewportSize()===null,allWindowSizes:samples.every(s=>Object.values(s.checks).every(Boolean)),allModes:modes.every(m=>Object.values(m.checks).every(Boolean)),focusDistinct:focus.focused==='campaign'&&focus.selected==='advance'&&focus.outline==='dashed'&&focus.focusedFill!==focus.selectedFill,keyboardSelects:activated,statePreserved:before.state===after.state,savesPreserved:before.storage===after.storage,noPageErrors:!errors.length}};
  } finally {
    await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'normal'}});
    await cdp.send('Browser.setWindowBounds',{windowId:native.windowId,bounds:{windowState:'maximized'}});
    await cdp.detach();
  }
}
