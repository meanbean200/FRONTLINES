import {test,expect,type Page} from '@playwright/test';

const quick=async(page:Page)=>{
  await page.goto('/');await page.getByRole('button',{name:'Quick Battle',exact:true}).click();
  await page.locator('[data-mode-choice="line-defense"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
};
const begin=async(page:Page)=>{
  await quick(page);await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
};
test('main menu separates setup, settings and operations',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'FRONTLINES',exact:true})).toBeVisible();
  await expect(page.locator('#quick-battle-form')).toHaveCount(0);
  await page.locator('#operations-menu').click();await expect(page.locator('[data-operation]')).toHaveCount(4);
  await page.locator('[data-operation="meeting"]').click();await expect(page.locator('[data-mode-choice="meeting"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#menu-back').click();await page.locator('[data-settings]').click();
  await page.locator('[data-setting-tab="controls"]').click();await expect(page.locator('.controls-list')).toContainText('M (G also works)');
});
test('briefing previews the generated world, then rolls back without a save write',async({page})=>{
  await quick(page);
  const before=await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState()));
  const storage=await page.evaluate(()=>JSON.stringify(localStorage));
  await page.locator('#launch-operation').click();
  await expect(page.locator('.operation-menu')).toHaveAttribute('data-screen','briefing');
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.mode)).toBe('line-defense');
  await page.locator('#back-to-setup').click();
  expect(await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState()))).toBe(before);
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(storage);
});
test('contextual commands, drawer escape and direct trench entry remain accessible',async({page})=>{
  await begin(page);await expect(page.locator('#selection-docket')).toBeHidden();await expect(page.locator('.command-dock')).toBeHidden();
  await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
  await page.locator('.roster-row').first().click();await page.locator('[aria-label="Close forces"]').click();
  await expect(page.locator('.command-dock')).toBeVisible();await expect(page.locator('.command-dock button')).toHaveCount(8);
  await page.locator('#selection-docket [data-hud-panel]').click();await expect(page.locator('#selection-card')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#selection-card')).toBeHidden();await expect(page.locator('.operation-menu')).toBeHidden();
  await page.locator('#build-command').click();await page.locator('#trench-command').click();
  await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','trench');await expect(page.locator('#build-panel')).toBeHidden();
  await page.keyboard.press('Escape');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');
  await page.keyboard.press('m');await expect(page.locator('.field-map')).toBeVisible();await page.keyboard.press('m');await expect(page.locator('.field-map')).toBeHidden();
  await page.keyboard.press('v');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','move');
});
test('pause save/load keeps exact campaign state and manual pause',async({page})=>{
  await begin(page);await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  // Compare with the canonical save, which adds the policy/rules identity even
  // before the first simulation tick. Saving does not mutate the live world.
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')!));
  await page.locator('#continue-save').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState())).toEqual(saved);
  await expect(page.locator('[data-speed="0"]')).toHaveClass('active');
});
for(const [width,height] of [[1920,1080],[2560,1440],[1654,910],[1366,768],[1280,720],[1024,768],[2560,1080],[1280,540]]){
  test('full canvas and usable menus at '+width+'×'+height,async({page})=>{
    await page.setViewportSize({width,height});await quick(page);
    expect(await page.locator('#battlefield').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}))).toEqual({width,height});
    expect(await page.locator('.operation-menu').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.locator('#launch-operation').click();await page.locator('#begin-operation').scrollIntoViewIfNeeded();await expect(page.locator('#begin-operation')).toBeVisible();
    await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
    await page.locator('.hud-tools>summary').click();await page.locator('#open-build').click();
    await expect(page.locator('#trench-command')).toBeInViewport();
    await page.locator('[data-build-category="support"]').click();
    await page.locator('[data-build-kind="emplacement"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-build-kind="emplacement"]')).toBeInViewport();
    await page.locator('[data-build-close]').click();
    await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
    await page.locator('.roster-row').first().click();await page.locator('[aria-label="Close forces"]').click();
    await expect(page.locator('#selection-docket [data-hud-panel]')).toBeInViewport();
    await page.locator('#selection-docket [data-hud-panel]').click();await expect(page.locator('#selection-card')).toBeVisible();
  });
}
