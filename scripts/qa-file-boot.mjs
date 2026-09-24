// The browser CLI rejects file:// navigation. Use an isolated Edge context for
// actual disk launches; never attach to or reload the player's browser/profile.
import {chromium} from 'playwright';
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';

const [entry = 'index.html', name = 'file-boot', mode = 'play'] = process.argv.slice(2);
const folder = resolve('output/playwright', `${name}-${Date.now()}`);
await mkdir(folder, {recursive: true});
// One copied HTML, no other game files nearby. Prove this is truly portable.
const target = mode === 'isolated' ? join(folder, 'FRONTLINES.html') : resolve(entry);
if (mode === 'isolated') await copyFile(resolve(entry), target);
const browser = await chromium.launch({channel: 'msedge', headless: true});
const context = await browser.newContext({viewport: mode === 'native' ? null : {width: 1600, height: 900}, offline: true});
const page = await context.newPage();
const evidence = {entry: target, mode, errors: [], requests: [], workers: [], ready: false, checks: {}};
await page.addInitScript(() => {
  // Passive measurement only; all game orders below use visible controls.
  window.__launchWorkers = [];
  const OriginalWorker = window.Worker;
  window.Worker = class extends OriginalWorker {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', ({data}) => window.__launchWorkers.push(
        data.route ? {kind: 'navigation', points: data.route.length} : {kind: 'terrain'}));
    }
  };
});
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') evidence.errors.push(message.text());});
page.on('request', request => evidence.requests.push(request.url()));
page.on('worker', worker => evidence.workers.push(worker.url()));
try {
  await page.goto(pathToFileURL(target).href);
  try {await page.locator('#choose-operation').waitFor({timeout: 12000}); evidence.ready = true;}
  catch (error) {evidence.bootFailure = error.message;}
  evidence.url = page.url();
  evidence.title = await page.title();
  evidence.body = (await page.locator('body').innerText()).slice(0, 6000);
  if (evidence.ready) await page.waitForFunction(() => window.__FRONTLINES__.getVisualStats().workerJobs >= 3);
  await page.screenshot({path: join(folder, 'boot.png')});
  if (evidence.ready && mode === 'native') {
    assert.equal(page.viewportSize(), null);
    const cdp = await context.newCDPSession(page);
    const {windowId} = await cdp.send('Browser.getWindowForTarget');
    evidence.nativeSizes = [];
    for (const [width, height] of [[1400, 900], [1920, 1080]]) {
      await cdp.send('Browser.setWindowBounds', {windowId, bounds: {width, height}});
      await page.waitForFunction(() => document.querySelector('#battlefield').clientWidth === innerWidth);
      const initial = await page.evaluate(() => [innerWidth, innerHeight]);
      for (let reload = 0; reload < 2; reload++) {
        await cdp.send('Network.setCacheDisabled', {cacheDisabled: reload === 1});
        await page.reload();
        await page.locator('#choose-operation').waitFor();
        const size = await page.evaluate(() => ({
          inner: [innerWidth, innerHeight],
          canvas: [document.querySelector('#battlefield').clientWidth, document.querySelector('#battlefield').clientHeight],
          menu: [document.querySelector('.operation-menu').clientWidth, document.querySelector('.operation-menu').clientHeight],
        }));
        assert.deepEqual(size.inner, initial);
        assert.deepEqual(size.canvas, initial);
        assert.deepEqual(size.menu, initial);
        evidence.nativeSizes.push({width, height, reload, ...size});
      }
    }
    await page.screenshot({path: join(folder, 'native-refresh.png')});
    await cdp.detach();
    evidence.checks.nativeRefreshSizing = true;
  }
  if (evidence.ready && !['boot', 'native'].includes(mode)) {
    await page.locator('#choose-operation').click();
    await page.locator('[data-mode-choice="meeting"]').click();
    await page.locator('#battle-size').selectOption('small');
    await page.locator('#battle-map').selectOption('seed');
    await page.locator('#sector-seed').fill('1944');
    await page.locator('#launch-operation').click();
    await page.locator('#begin-operation').waitFor();
    await page.screenshot({path: join(folder, 'briefing.png')});
    await page.locator('#begin-operation').click();
    await page.locator('[data-speed="0"]').click();
    await page.locator('.hud-tools summary').click();
    await page.locator('#roster-toggle').click();
    await page.locator('.roster-row').filter({hasText: 'Able'}).click();
    await page.locator('[aria-label="Close forces"]').click();
    await page.keyboard.press('f');
    const q = await page.evaluate(() => window.__FRONTLINES__.getState().squads.find(q => q.name === 'Able'));
    await page.waitForFunction(q => {
      const p = window.__FRONTLINES__.projectWorld(q.x + 35, q.z, .1);
      return p.visible && p.x > 200 && p.x < innerWidth - 200 && p.y > 150 && p.y < innerHeight - 200;
    }, q);
    const destination = await page.evaluate(q => window.__FRONTLINES__.projectWorld(q.x + 35, q.z, .1), q);
    await page.mouse.click(destination.x, destination.y, {button: 'right'});
    await page.waitForFunction(() => window.__launchWorkers.some(r => r.kind === 'navigation' && r.points > 0));
    await page.locator('[data-speed="1"]').click();
    await page.waitForFunction(q => {
      const current = window.__FRONTLINES__.getState().squads.find(s => s.id === q.id);
      return Math.hypot(current.x - q.x, current.z - q.z) > 3;
    }, q, {timeout: 20000});
    await page.locator('[data-speed="0"]').click();
    evidence.checks.movement = true;
    evidence.workerResults = await page.evaluate(() => window.__launchWorkers);
    evidence.visuals = await page.evaluate(() => window.__FRONTLINES__.getVisualStats());
    await page.screenshot({path: join(folder, 'gameplay.png')});
    const readState = () => page.evaluate(() => {
      const state = window.__FRONTLINES__.getState();
      // Save metadata is not part of the simulation; compare all game state.
      delete state.policySchema;
      return JSON.stringify(state);
    });
    const before = await readState();
    await page.locator('.operation-menu-button').click();
    await page.locator('#save-session').click();
    assert.match(await page.locator('.menu-status').innerText(), /Session saved/);
    await page.reload();
    await page.locator('#main-continue').click();
    const after = await readState();
    evidence.checks.saveContinued = before === after;
    evidence.stateHashes = [before, after].map(text => createHash('sha256').update(text).digest('hex'));
    assert.equal(after, before, 'Offline saved game must resume exactly while paused.');
    await page.locator('.operation-menu-button').click();
    await page.locator('#return-main').click();
    evidence.sizes = [];
    for (const [width, height] of [[1280, 720], [1920, 1080]]) {
      await page.setViewportSize({width, height});
      await page.reload();
      await page.locator('#choose-operation').waitFor();
      await page.waitForFunction(() => document.querySelector('#battlefield').clientWidth === innerWidth);
      const size = await page.evaluate(() => ({
        inner: [innerWidth, innerHeight],
        canvas: [document.querySelector('#battlefield').clientWidth, document.querySelector('#battlefield').clientHeight],
        menu: [document.querySelector('.operation-menu').clientWidth, document.querySelector('.operation-menu').clientHeight],
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.deepEqual(size.canvas, size.inner);
      assert.deepEqual(size.menu, size.inner);
      assert.equal(size.overflow, false);
      evidence.sizes.push(size);
    }
    evidence.checks.refreshSizing = true;
  }
  evidence.checks.noNetworkDependencies = evidence.requests.every(url => !/^https?:/.test(url));
  assert.ok(evidence.checks.noNetworkDependencies);
} catch (error) {
  evidence.failure = {message: error.message.slice(0, 3000), stack: error.stack?.slice(0, 4000)};
  await page.screenshot({path: join(folder, 'failure.png')}).catch(() => {});
} finally {
  await browser.close();
  await writeFile(join(folder, 'result.json'), JSON.stringify(evidence, null, 2), {flag: 'wx'});
  console.log(JSON.stringify({folder, ...evidence}));
}
if (!evidence.ready || evidence.errors.length || evidence.failure) process.exitCode = 1;
