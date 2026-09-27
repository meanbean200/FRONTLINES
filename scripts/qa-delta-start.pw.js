async page => {
  await page.locator('[data-battle-mode="endless"]').click();
  await page.locator('#endless-pressure').selectOption('low');
  await page.locator('#battle-map').selectOption('seed');
  await page.locator('#sector-seed').fill('1944');
  await page.locator('.advanced-setup summary').click();
  await page.locator('#setup-direction').selectOption('east');
  await page.locator('#setup-approach').selectOption('close');
  await page.getByRole('button',{name:'Prepare battle'}).click();
  await page.getByRole('button',{name:'Begin endless battle'}).click();
  await page.keyboard.press('Space');
  await page.screenshot({path:'output/playwright/delta/endless-start.png'});
  return await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {elapsed:s.elapsed,speed:s.simSpeed,objectives:s.operation.objectives,squads:s.squads.filter(q=>q.faction!=='enemy').map(q=>({id:q.id,name:q.name,x:q.x,z:q.z})),camera:window.__FRONTLINES__.getVisualStats()};});
}
