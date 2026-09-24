async (page) => {
  if (page.viewportSize() !== null) throw Error('Launch with edge-player.config.json; native sizing must be configured before opening the page.');
  // Run in a disposable context, never reload the player's unsaved battle.
  const context = await page.context().browser().newContext({viewport: null, storageState: await page.context().storageState()});
  const testPage = await context.newPage();
  const cdp = await context.newCDPSession(testPage);
  const {windowId} = await cdp.send('Browser.getWindowForTarget');
  const samples = [], errors = [], screenshots = [];
  testPage.on('pageerror', error => errors.push(error.message));
  const read = () => testPage.evaluate(() => ({
    inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
    canvas: [document.querySelector('#battlefield').clientWidth, document.querySelector('#battlefield').clientHeight],
    menu: [document.querySelector('.operation-menu').getBoundingClientRect().width, document.querySelector('.operation-menu').getBoundingClientRect().height],
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  const storage = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort())));
  try {
    await testPage.goto(page.url());
    await testPage.locator('#choose-operation').waitFor();
    for (const windowState of ['normal', 'maximized']) {
      await cdp.send('Network.setCacheDisabled', {cacheDisabled: false});
      await cdp.send('Browser.setWindowBounds', {windowId, bounds: {windowState}});
      if (windowState === 'normal') await cdp.send('Browser.setWindowBounds', {windowId, bounds: {left: 80, top: 40, width: 1400, height: 900}});
      await testPage.waitForFunction(() => innerWidth > 1200 && document.querySelector('#battlefield').clientWidth === innerWidth);
      // Sample a settled native size ONCE, then never resize between reloads.
      await testPage.waitForTimeout(250);
      const baseline = await read();
      for (let reload = 0; reload < 3; reload++) {
        if (reload === 1) await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
        await testPage.reload();
        await testPage.locator('#choose-operation').waitFor();
        const initial = await read();
        await testPage.waitForFunction(() => window.__FRONTLINES__.getPerf().chunks >= 8);
        const settled = await read();
        const path = 'output/playwright/cinematic-ui/native-refresh-'+Date.now()+'-'+windowState+'-'+reload+'.png';
        await testPage.screenshot({path, animations: 'disabled'});
        screenshots.push(path);
        samples.push({windowState, reload, cacheDisabled: reload > 0, baseline, initial, settled,
          fits: [initial, settled].every(s => s.inner.every((n, i) => n === baseline.inner[i] && n === s.canvas[i] && n === s.menu[i]) && !s.overflow),
          native: testPage.viewportSize() === null});
      }
    }
    // A copied save must still be usable after reload. Never write the real slot.
    const hasSave = await testPage.locator('#main-continue').isEnabled();
    let loaded = null;
    if (hasSave) {
      const saved = await testPage.evaluate(() => JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')));
      await testPage.locator('#main-continue').click();
      loaded = await testPage.evaluate(() => window.__FRONTLINES__.getState());
      if (saved.simSpeed !== 0) throw Error('Exact copied-save check requires a paused fixture.');
      const savedEqual = JSON.stringify(saved) === JSON.stringify(loaded);
      if (!savedEqual) throw Error('Copied save did not resume exactly.');
      await testPage.locator('.operation-menu-button').click();
      await testPage.locator('#return-main').click();
    }
    const checks = {reloadsFit: samples.every(s => s.fits && s.native), noPageErrors: errors.length === 0,
      storageUnchanged: storage === await testPage.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).sort()))),
      saveContinued: hasSave ? Boolean(loaded) : 'not present'};
    return {samples, screenshots, errors, checks};
  } finally {
    await cdp.detach();
    await context.close();
    await page.bringToFront();
  }
}
