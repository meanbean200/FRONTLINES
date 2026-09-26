// Native Edge window: run with a CLI config containing contextOptions.viewport=null.
async page => {
 if(page.viewportSize()!==null)throw new Error('This check requires an actual native window, not an emulated viewport');
 const cdp=await page.context().newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget'),result={kind:'native-headed-edge',samples:[]};
 const sample=async name=>{
  await page.locator('#choose-operation').waitFor();await page.waitForTimeout(700);
  const d=await page.evaluate(()=>window.__FRONTLINES_VIEWPORT__());
  result.samples.push({name,...d});await page.screenshot({path:`output/playwright/home-native-${name}.png`});
  if(d.canvas.width!==d.inner.width||d.canvas.height!==d.inner.height||Math.abs(d.cameraAspect-d.inner.width/d.inner.height)>.001)throw new Error('Native viewport mismatch: '+name);
 };
 await sample('cold');
 for(const [width,height] of [[1600,960],[1366,850]]){
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{left:0,top:0,width,height}});await sample(`resize-${width}`);
  await page.reload();await sample(`refresh-${width}`);
 }
 await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'maximized'}});await sample('maximized');
 await page.reload();await sample('maximized-refresh');
 await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await sample('restored');
 await page.keyboard.press('Control+-');await page.keyboard.press('Control+-');await sample('browser-zoom-out');
 await page.reload();await sample('zoom-refresh');await page.keyboard.press('Control+0');await sample('zoom-reset');
 await cdp.detach();await page.evaluate(r=>{window.__HOME_NATIVE_QA__=r;},result);
}
