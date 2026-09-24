async(page)=>{
  if(!await page.locator('#main-continue').isVisible()){await page.locator('[data-speed="0"]').click();await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();}
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')));
  await page.reload();await page.locator('#main-continue').click();
  const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());if(JSON.stringify(saved)!==JSON.stringify(loaded))throw Error('Save continuation changed on reload');
  await page.evaluate(()=>{window.autonomySamples=[];window.autonomyTimer=setInterval(()=>{const a=window.__FRONTLINES__,s=a.getState();window.autonomySamples.push({at:s.elapsed,shots:s.operation?.shots,hits:s.operation?.hits,soldiers:a.getCombatDiagnostics().soldiers.filter(p=>p.owner==='reaction'),support:a.getCombatDiagnostics().support});},1000);});
  await page.locator('[data-speed="5"]').click();return {savedElapsed:saved.elapsed,loadedElapsed:loaded.elapsed,exact:true,bundle:await page.locator('script[type="module"]').getAttribute('src')};
}
