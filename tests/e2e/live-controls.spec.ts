import {test,expect,type Page} from '@playwright/test';

test('advanced changes preserve native fields and launch with the chosen rules',async({page})=>{
  await page.goto('/');await page.locator('#choose-operation').click();
  await page.locator('.advanced-setup>summary').click();
  const time=await page.locator('#setup-time').elementHandle();
  await page.locator('#setup-time').selectOption('night');
  expect(await time!.evaluate(el=>el.isConnected)).toBe(true);
  await page.locator('#setup-supply').selectOption('low');
  await page.locator('#endless-calendar').selectOption('20');
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.setup?.advanced)).toMatchObject({time:'night',supply:'low'});
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.setup?.calendarDayMinutes)).toBe(20);
});

test('live trench updates keep the readiness select and apply its keyboard choice',async({page})=>{
  await page.goto('/');await page.locator('#sandbox-session').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
  await page.locator('#garrison-readiness').selectOption('stand-to');await page.locator('[data-speed="5"]').click();
  const field=await page.locator('#garrison-readiness').elementHandle();
  await page.locator('#garrison-readiness').click();await page.waitForTimeout(3500);
  expect(await field!.evaluate(el=>el.isConnected)).toBe(true);
  await expect(page.locator('#garrison-readiness')).toBeFocused();
  await page.keyboard.press('Home');await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  await expect(page.locator('#garrison-readiness')).toHaveValue('routine');
  await page.locator('[data-speed="0"]').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().living!.garrisons[0].readiness)).toBe('routine');
});

const openFrontPanel=async(page:Page)=>{
  // Prepared-position controls remain covered in the separate Endless mode;
  // normal Open Front correctly has no initial trenches to inspect.
  await page.goto('/');await page.locator('#endless-menu').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
};

for(const speed of [0,5])test(`direct front buttons apply every direction at ${speed}x without changing other positions`,async({page})=>{
  await openFrontPanel(page);
  const group=page.getByRole('group',{name:'Front direction',exact:true}),id=Number(await group.locator('button').first().getAttribute('data-network'));
  const others=await page.evaluate(id=>window.__FRONTLINES__.getState().living!.garrisons.filter(g=>g.id!==id).map(g=>({id:g.id,front:g.front})),id);
  await page.locator(`[data-speed="${speed}"]`).click();
  for(const [name,angle]of [['North',Math.PI],['East',Math.PI/2],['South',0],['West',-Math.PI/2]] as const){
    const button=group.getByRole('button',{name:'Face '+name,exact:true}),node=await button.elementHandle();
    await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('#garrison-front-current')).toHaveText(name);
    await expect.poll(()=>page.evaluate(id=>window.__FRONTLINES__.getState().living!.garrisons.find(g=>g.id===id)!.front,id)).toBe(angle);
    await page.waitForTimeout(800);
    expect(await node!.evaluate(el=>el.isConnected)).toBe(true);
    await expect(button).toHaveAttribute('aria-pressed','true');
  }
  expect(await page.evaluate(id=>window.__FRONTLINES__.getState().living!.garrisons.filter(g=>g.id!==id).map(g=>({id:g.id,front:g.front})),id)).toEqual(others);
  await page.locator('[data-speed="0"]').click();
  await group.getByRole('button',{name:'Face North',exact:true}).press('Enter');
  await expect(page.locator('#garrison-front-current')).toHaveText('North');
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().simSpeed)).toBe(0);
  await page.getByRole('button',{name:'Close position management',exact:true}).click();
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await page.locator('#continue-save').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
  await expect(page.locator('#garrison-front-current')).toHaveText('North');
  expect(await page.evaluate(id=>window.__FRONTLINES__.getState().living!.garrisons.find(g=>g.id===id)!.front,id)).toBe(Math.PI);
  await page.screenshot({path:`output/playwright/front-buttons-${speed}x.png`});
});

test.describe('touch front controls',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true});
  test('a direct tap changes facing after scrolling, without issuing a battlefield order',async({page})=>{
    await openFrontPanel(page);
    const button=page.getByRole('button',{name:'Face West',exact:true});
    const orders=await page.evaluate(()=>window.__FRONTLINES__.getState().squads.map(q=>({id:q.id,order:q.order})));
    await button.scrollIntoViewIfNeeded();await button.tap();
    await expect(button).toHaveAttribute('aria-pressed','true');await expect(page.locator('#garrison-front-current')).toHaveText('West');
    const bounds=await button.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>window.__FRONTLINES__.getState().living!.garrisons[0].front)).toBe(-Math.PI/2);
    expect(await page.evaluate(()=>window.__FRONTLINES__.getState().squads.map(q=>({id:q.id,order:q.order})))).toEqual(orders);
    expect(await page.locator('#trench-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:'output/playwright/front-buttons-touch.png'});
  });
});
