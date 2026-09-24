async (page) => {
  const inspect = () => ({inner:{width:innerWidth,height:innerHeight},outer:{width:outerWidth,height:outerHeight},app:{width:document.querySelector('#app').clientWidth,height:document.querySelector('#app').clientHeight},state:JSON.stringify(window.__FRONTLINES__.getState()),saves:['frontlines-battlefield-v1','frontlines-battlefield-v2','frontlines-battlefield-v3'].map(k=>localStorage.getItem(k))});
  const before=await page.evaluate(inspect);
  const cdp=await page.context().newCDPSession(page);
  const native=await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.waitForTimeout(700);
  const after=await page.evaluate(inspect);
  await page.screenshot({path:'output/playwright/edge-viewport-released.png'});
  await cdp.detach();
  return {scope:'Remove the browser-testing viewport override without navigation, reload or storage writes',native,before:{...before,state:undefined,saves:undefined},after:{...after,state:undefined,saves:undefined},checks:{expanded:after.inner.width>before.inner.width,appFillsViewport:after.app.width===after.inner.width&&after.app.height===after.inner.height,statePreserved:before.state===after.state,savesPreserved:JSON.stringify(before.saves)===JSON.stringify(after.saves)}};
}
