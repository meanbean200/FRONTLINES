import {test,expect,type Page} from '@playwright/test';
import {stepReplacements} from '../../src/operations/Replacements';

async function support(page:Page){
  if(await page.locator('#deployment-command').getAttribute('aria-expanded')!=='true')await page.locator('#deployment-command').click();
}

for(const reserves of [0,24,48] as const)test(`Open Front shows the configured ${reserves}-person reserve`,async({page},testInfo)=>{
  await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="open-front"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('.advanced-setup summary').click();await page.locator('#setup-reserves').selectOption(String(reserves));
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await support(page);await expect(page.locator('.reinforcement-totals>span').first()).toHaveText(`${reserves}RESERVE`);
  await page.screenshot({path:testInfo.outputPath(`reserve-${reserves}.png`)});
  if(reserves!==24)return;
  // Eight synthetic losses; release uses the actual deterministic replacement
  // function. No long clock soak and no fake reserve-counter edit in the UI.
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const losses=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player').slice(-8);
  for(const s of losses){s.health=0;s.needs!.life='dead';}
  state.living!.campaignHours=state.operation!.campaign!.replacements!.nextAt.player;
  stepReplacements(state,.05);
  expect(state.operation!.campaign!.replacements!.reserve.player).toBe(16);
  await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  await support(page);await expect(page.locator('.reinforcement-totals>span').first()).toHaveText('16RESERVE');
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  await expect(page.locator('.menu-status')).toContainText('Session saved.');
  await page.reload();await page.locator('#main-continue').click();await support(page);
  await expect(page.locator('.reinforcement-totals>span').first()).toHaveText('16RESERVE');
  // Wait for the restored view to settle before capturing the HUD evidence.
  await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getVisualStats().zoomDistance)).toBeCloseTo(300,0);
  await page.screenshot({path:testInfo.outputPath('reserve-16-of-24-reloaded.png')});
});
