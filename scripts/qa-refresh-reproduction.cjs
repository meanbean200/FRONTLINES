async (page) => {
  const context = await page.context().browser().newContext({viewport: {width: 960, height: 600}});
  const testPage = await context.newPage();
  const cdp = await context.newCDPSession(testPage);
  const {windowId} = await cdp.send('Browser.getWindowForTarget');
  const read = () => testPage.evaluate(() => ({
    inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
    canvas: [document.querySelector('#battlefield').clientWidth, document.querySelector('#battlefield').clientHeight],
  }));
  try {
    await testPage.goto(page.url());
    await testPage.locator('#choose-operation').waitFor();
    await testPage.setViewportSize({width: 0, height: 0});
    await cdp.send('Browser.setWindowBounds', {windowId, bounds: {windowState: 'normal'}});
    await cdp.send('Browser.setWindowBounds', {windowId, bounds: {width: 1500, height: 900}});
    await testPage.waitForFunction(() => innerWidth > 1300);
    const afterResize = await read();
    await testPage.reload();
    await testPage.locator('#choose-operation').waitFor();
    const afterReload = await read();
    const nativeScreenshot = await cdp.send('Page.captureScreenshot', {format: 'png'});
    return {afterResize, afterReload, viewport: testPage.viewportSize(), nativeScreenshot};
  } finally {
    await cdp.detach();
    await context.close();
  }
}
