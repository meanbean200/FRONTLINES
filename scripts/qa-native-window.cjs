async (page) => {
  if(page.viewportSize()!==null)throw Error('Native sizing must be configured as viewport:null at browser creation. Zero dimensions are not a reset.');
  const cdp=await page.context().newCDPSession(page);
  const {windowId}=await cdp.send('Browser.getWindowForTarget');
  const read=()=>page.evaluate(()=>({inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],canvas:[document.querySelector('#battlefield').clientWidth,document.querySelector('#battlefield').clientHeight]}));
  const state=await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState()));
  const save=await page.evaluate(()=>JSON.stringify(localStorage));
  const samples=[];
  try {
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
    for(const [width,height] of [[1200,850],[1600,960]]){
      const previous=await page.evaluate(()=>innerWidth);
      await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width,height,left:80,top:40}});
      await page.waitForFunction(w=>innerWidth!==w&&document.querySelector('#battlefield').clientWidth===innerWidth,previous,{timeout:5000});
      samples.push(await read());
    }
  } finally {
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'maximized'}});
  }
  await page.waitForFunction(()=>innerWidth>1800&&document.querySelector('#battlefield').clientWidth===innerWidth,undefined,{timeout:5000});
  const final=await read();
  const nativeScreenshot=await cdp.send('Page.captureScreenshot',{format:'png'});
  await cdp.detach();
  return {samples,final,checks:{resizes:samples.every(s=>s.inner[0]===s.canvas[0]&&s.inner[1]===s.canvas[1]),state:state===await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState())),save:save===await page.evaluate(()=>JSON.stringify(localStorage))},nativeScreenshot};
}
