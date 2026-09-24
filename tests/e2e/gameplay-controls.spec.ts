import {test,expect,type Page} from '@playwright/test';

async function meeting(page:Page){
  await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="meeting"]').click();await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
}
async function select(page:Page,name:string,add=false){
  if(!await page.locator('.hud-tools').evaluate((el:HTMLDetailsElement)=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();
  await page.locator('.roster-row').filter({hasText:name}).click({modifiers:add?['Shift']:[]});await page.locator('[aria-label="Close forces"]').click();
}
test('Add troops is a normal sandbox action with repeatable batch placement',async({page})=>{
  await page.goto('/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();const before=await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length);
  await page.getByRole('button',{name:'Add troops',exact:true}).click();await page.getByLabel('Squads per placement',{exact:true}).selectOption('3');await page.locator('[data-deploy="rifle"]').click();
  await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','deploy');
  let placed=false;for(const [x,y] of [[740,540],[900,500],[740,390],[600,480]]){
    await page.mouse.move(x,y);await expect(page.locator('.draft-readout')).toBeVisible();
    await expect.poll(()=>page.locator('.draft-readout').getAttribute('data-valid')).not.toBeNull();
    if(await page.locator('.draft-readout').getAttribute('data-valid')==='true'){await page.mouse.click(x,y);placed=true;break;}
  }
  expect(placed).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before+24);
  await page.keyboard.press('Escape');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');await expect(page.locator('#selection-summary')).toContainText('3 squads');
  await page.locator('#deployment-command').click();await page.locator('.hud-tools summary').click();await page.locator('#open-build').click();await expect(page.locator('#deployment-panel')).toBeHidden();
});
test('finite operations explain reserves without offering sandbox spawning',async({page})=>{
  await meeting(page);const before=await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length);await page.getByRole('button',{name:'Reserves',exact:true}).click();
  await expect(page.locator('.operation-topline')).toContainText('Meeting Engagement');await expect(page.locator('.operation-topline')).toContainText('NO TIME LIMIT');
  await expect(page.locator('.deployment-status')).toContainText('finite-force');await expect(page.locator('[data-deploy="rifle"]')).toBeHidden();
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before);
});
test('support identifies an eligible team within a mixed selection',async({page})=>{
  await meeting(page);await select(page,'Able');await page.locator('#support-command').click();await expect(page.locator('[data-support="mortarHE"]')).toBeDisabled();await expect(page.locator('.support-status')).toContainText('Select your mortar team');
  await select(page,'Mortar team',true);await page.locator('#support-command').click();await expect(page.locator('[data-support="mortarHE"]')).toBeEnabled();await expect(page.locator('[data-support="mortarHE"]')).toContainText('12');
});
test('machine-gun inspection separates crew readiness from urgent warnings',async({page})=>{
  await meeting(page);await select(page,'Machine-gun team');await expect(page.locator('.crew-readiness')).toBeVisible();await expect(page.locator('#battle-alerts')).not.toContainText('Setting up');
  await page.locator('[data-speed="1"]').click();await expect(page.locator('.crew-readiness')).toContainText('watching sector',{timeout:12000});await page.locator('[data-speed="0"]').click();
});
