import {test,expect} from '@playwright/test';

for(const [width,height]of [[1654,910],[390,844],[844,390]])test(`position commands remain visible at ${width}×${height}`,async({page})=>{
  await page.setViewportSize({width,height});await page.goto('/');
  await page.locator('#endless-menu').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
  const panel=page.locator('#trench-panel'),primary=panel.locator(':scope > .command-primary');
  await expect(primary.getByRole('button',{name:'Build MG',exact:true})).toBeInViewport();
  await expect(primary.getByRole('button',{name:'Build field gun',exact:true})).toBeInViewport();
  const bounds=await panel.boundingBox();expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);
  expect((await panel.locator('.position-content').boundingBox())!.height).toBeGreaterThanOrEqual(55);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await primary.locator('button').all()){const r=await button.boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);}
  await panel.getByRole('button',{name:'People',exact:true}).click();await panel.locator('.position-content').hover();await page.mouse.wheel(0,1500);
  await expect(primary.getByRole('button',{name:/Select available/})).toBeInViewport();await expect(panel.getByRole('button',{name:'Overview',exact:true})).toBeInViewport();
  await page.screenshot({path:`output/playwright/delta/commands-${width}x${height}.png`});
});

test('town commands are reachable from both the map index and battlefield label',async({page})=>{
  await page.goto('/');await page.locator('#choose-operation').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.getByRole('button',{name:'Map',exact:true}).click();const map=page.getByRole('dialog',{name:'Operational map'});
  await map.getByRole('button',{name:'SAINT-MARTIN',exact:true}).click();await map.getByRole('button',{name:'Manage',exact:true}).click();
  const panel=page.getByRole('region',{name:'Position management'});await expect(panel.getByRole('heading',{name:'SAINT-MARTIN',exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Set as supply point',exact:true})).toBeDisabled();
  await panel.getByRole('button',{name:'Locate town',exact:true}).click();await panel.getByRole('button',{name:'Close position management',exact:true}).click();
  await page.getByRole('button',{name:'Inspect SAINT-MARTIN',exact:true}).click();
  await expect(panel.getByRole('heading',{name:'SAINT-MARTIN',exact:true})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Recover supplies',exact:true})).toBeDisabled();
});

test('normal map Locate keeps a finite battlefield camera while settling at a terrain seam',async({page})=>{
  await page.goto('/');await page.locator('#endless-menu').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  for(const name of ['FRIENDLY SECTOR 3','SAINT-MARTIN']){
    await page.getByRole('button',{name:'Map',exact:true}).click();const map=page.getByRole('dialog',{name:'Operational map'});
    await map.getByRole('button',{name,exact:true}).click();await map.getByRole('button',{name:'Locate',exact:true}).click();
  }
  // Read-only current-frame projection. No camera setter or world injection.
  const result=await page.evaluate(()=>new Promise<{bad:number;visible:number}>(resolve=>{
    let frames=0,bad=0,visible=0;
    const sample=()=>{const p=window.__FRONTLINES__.projectWorld(0,-80);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))bad++;if(p.visible)visible++;if(++frames===900)resolve({bad,visible});else requestAnimationFrame(sample);};requestAnimationFrame(sample);
  }));
  expect(result.bad).toBe(0);expect(result.visible).toBeGreaterThan(600);
  await page.screenshot({path:'output/playwright/delta/terrain-seam-browser.png'});
});
