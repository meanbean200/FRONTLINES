async(page)=>{
  await page.locator('[data-speed="0"]').click();
  if(!await page.locator('.hud-tools').evaluate(el=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();await page.locator('.roster-row').filter({hasText:'Able'}).dblclick();await page.getByRole('button',{name:'Close forces',exact:true}).click();
  await page.waitForTimeout(900);await page.mouse.move(850,410);await page.mouse.wheel(0,-750);await page.waitForTimeout(1000);
  return {visual:await page.evaluate(()=>window.__FRONTLINES__.getVisualStats()),people:await page.evaluate(()=>{const s=window.__FRONTLINES__.getState(),q=s.squads.find(q=>q.name==='Able');return s.soldiers.filter(p=>p.squadId===q.id);}),nativeScreenshot:{data:(await page.screenshot()).toString('base64')}};
}
