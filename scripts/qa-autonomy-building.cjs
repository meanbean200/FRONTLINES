async(page)=>{
  if(await page.locator('.field-map').isVisible())await page.locator('.field-map [data-close]').click();
  await page.locator('[data-speed="0"]').click();
  const select=async(name)=>{if(!await page.locator('.hud-tools').evaluate(el=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();await page.locator('.roster-row').filter({hasText:name}).dblclick();await page.getByRole('button',{name:'Close forces',exact:true}).click();};
  const mapOrder=async(x,z)=>{await page.locator('#map-expand').click();await page.locator('button[data-scale="theater"]').click();const r=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(r.x+(x+2000)/4000*r.width,r.y+(z+2000)/4000*r.height,{button:'right'});await page.locator('.field-map [data-close]').click();};
  await select('Able');await mapOrder(-38.77401824860694,-120.90960581982732);
  await select('Fox');await mapOrder(120,-620);
  await select('Able');await page.waitForTimeout(800);await page.locator('[data-speed="5"]').click();
  return {orders:await page.evaluate(()=>window.__FRONTLINES__.getState().squads.filter(q=>q.faction==='player').map(q=>({name:q.name,order:q.order}))),nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
