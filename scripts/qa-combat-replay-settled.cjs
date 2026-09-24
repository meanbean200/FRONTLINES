async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('[data-speed="0"]').click();
  const before = await page.evaluate(() => window.__FRONTLINES__.getState());
  const stored = await page.evaluate(() => localStorage.getItem('frontlines-battlefield-v3'));
  if (!await page.getByRole('button', {name: 'Review matched replays', exact: true}).isVisible()) await page.locator('.debug-toggle').click();
  await page.getByRole('button', {name: 'Review matched replays', exact: true}).click();
  await page.locator('.replay-review input[type="file"]').setInputFiles([
    'C:/Users/Will/OneDrive/Documents/ChatGPT/FRONTLINES/output/combat-advance-v3-r2-exposed.json',
    'C:/Users/Will/OneDrive/Documents/ChatGPT/FRONTLINES/output/combat-advance-v3-r2-supported.json',
  ]);
  await page.waitForFunction(() => document.querySelector('.replay-time')?.textContent?.startsWith('Frame'));
  await page.getByRole('slider', {name: 'Replay time', exact: true}).press('End');
  await page.waitForTimeout(3500);
  const inspect = () => {
    const api = window.__FRONTLINES__;
    const state = api.getState();
    const q = state.squads.find(q => q.faction !== 'enemy');
    return {perf: api.getPerf(), squad: q, projection: api.projectWorld(q.x, q.z, 0), ground: api.terrainProbe(q.x, q.z)};
  };
  const exposed = await page.evaluate(inspect);
  await page.screenshot({path: 'output/playwright/combat-v3-replay-exposed-settled.png'});
  await page.getByRole('combobox', {name: 'Replay candidate', exact: true}).selectOption('1');
  await page.waitForTimeout(3500);
  const supported = await page.evaluate(inspect);
  await page.screenshot({path: 'output/playwright/combat-v3-replay-supported-settled.png'});
  await page.getByRole('button', {name: 'Return to campaign', exact: true}).click();
  const after = await page.evaluate(() => window.__FRONTLINES__.getState());
  return {scope: 'Settled replay visibility and campaign preservation', errors, exposed, supported, checks: {
    campaignPreserved: JSON.stringify(before) === JSON.stringify(after),
    savePreserved: stored === await page.evaluate(() => localStorage.getItem('frontlines-battlefield-v3')),
    noPageErrors: !errors.length,
    exposedInFrame: exposed.projection.visible,
    supportedInFrame: supported.projection.visible,
  }};
}
