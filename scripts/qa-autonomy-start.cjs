async(page)=>{
  await page.locator('#begin-operation').click();
  await page.locator('[data-speed="0"]').click();
  await page.locator('.hud-tools summary').click();
  await page.locator('#roster-toggle').click();
  await page.locator('.roster-row').filter({hasText:'Able'}).click();
  await page.locator('.roster-row').filter({hasText:'Baker'}).click({modifiers:['Shift']});
  await page.locator('[aria-label="Close forces"]').click();
  await page.locator('#map-expand').click();
  return {map:await page.locator('.field-map').innerText(),state:await page.evaluate(()=>window.__FRONTLINES__.getSummary())};
}
