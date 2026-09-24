async(page)=>{
  const mode=await page.evaluate(()=>new URL(location.href).searchParams.get('audit')??'line-defense');
  await page.locator('#choose-operation').click();
  await page.locator('[data-mode-choice="'+mode+'"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();
  return {mode,briefing:await page.locator('.battle-briefing').innerText()};
}
