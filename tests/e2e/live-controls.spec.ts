import {test,expect} from '@playwright/test';

test('advanced changes preserve native fields and launch with the chosen rules',async({page})=>{
  await page.goto('/');await page.locator('#choose-operation').click();
  await page.locator('.advanced-setup>summary').click();
  const time=await page.locator('#setup-time').elementHandle();
  await page.locator('#setup-time').selectOption('night');
  expect(await time!.evaluate(el=>el.isConnected)).toBe(true);
  await page.locator('#setup-supply').selectOption('low');
  await page.locator('#setup-engineers').selectOption('2');
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.setup?.advanced)).toMatchObject({time:'night',supply:'low',engineers:2});
});

test('live trench updates keep an open native select and apply its keyboard choice',async({page})=>{
  await page.goto('/');await page.locator('#sandbox-session').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
  await page.locator('#garrison-readiness').selectOption('stand-to');await page.locator('[data-speed="5"]').click();
  const field=await page.locator('#garrison-front').elementHandle();
  await page.locator('#garrison-front').click();await page.waitForTimeout(3500);
  expect(await field!.evaluate(el=>el.isConnected)).toBe(true);
  await expect(page.locator('#garrison-front')).toBeFocused();
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  const value=await page.locator('#garrison-front').inputValue();
  await page.locator('[data-speed="0"]').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().living!.garrisons[0].front)).toBe(Number(value));
});
