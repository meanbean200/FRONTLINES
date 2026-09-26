import {test,expect} from '@playwright/test';
import {occupiedTrafficFixture} from '../../scripts/qa-occupied-traffic';
import {writeFile} from 'node:fs/promises';

test('Edge advances real occupied trench counterflow using the speed controls',async({page},info)=>{
  await page.goto('/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  // Declared synthetic initial fixture, passed through the production validator.
  // No stepping or movement injection in the browser; controls advance the world.
  const f=occupiedTrafficFixture(false),initial=f.sim.state;initial.simSpeed=0;
  const targets=[...f.targets].map(([id,p])=>({id,...p}));await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),initial);
  await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();await page.locator('.roster-row').filter({hasText:'Traffic 1'}).first().click();await page.locator('[aria-label="Close forces"]').click();await page.keyboard.press('f');
  await page.mouse.move(900,450);await page.mouse.wheel(0,550);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const started=Date.now();await page.locator('[data-speed="5"]').click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getState().elapsed>=25);await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('f');
  await page.waitForFunction(()=>{const v=window.__FRONTLINES__.getVisualStats(),q=window.__FRONTLINES__.getState().squads.find(q=>q.name==='Traffic 1')!;return Math.hypot(v.cameraTarget.x-q.x,v.cameraTarget.z-q.z)<2&&v.zoomDistance<140;});
  await page.screenshot({path:info.outputPath('occupied-counterflow.png')});
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await expect(page.locator('.menu-status')).toContainText('Session saved.');await page.reload();await page.locator('#main-continue').click();
  await page.locator('[data-speed="5"]').click();await page.waitForFunction(targets=>{
    const s=window.__FRONTLINES__.getState();return targets.every(t=>{const p=s.soldiers.find(p=>p.id===t.id)!;return p.duty?.arrivedAt!==undefined&&Math.hypot(p.x-t.x,p.z-t.z)<.5;});
  },targets,{timeout:30000});await page.locator('[data-speed="0"]').click();await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  const final=await page.evaluate(()=>window.__FRONTLINES__.getState());expect(final.simSpeed).toBe(0);expect(final.soldiers).toHaveLength(96);expect(final.soldiers.every(s=>s.needs?.life==='active')).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('occupied-counterflow-complete.png')});
  await writeFile(info.outputPath('timing.json'),JSON.stringify({elapsed:final.elapsed,wallSecondsIncludingPauseAndReload:(Date.now()-started)/1000,errors},null,2));
});
