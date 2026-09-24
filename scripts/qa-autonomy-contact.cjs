async(page)=>{
  await page.mouse.click(800,445,{button:'right'});
  await page.mouse.click(800,445);
  await page.evaluate(()=>{
    window.autonomySamples=[];
    window.autonomyTimer=setInterval(()=>{const a=window.__FRONTLINES__,s=a.getState();window.autonomySamples.push({at:s.elapsed,shots:s.operation?.shots,hits:s.operation?.hits,soldiers:a.getCombatDiagnostics().soldiers.filter(p=>p.owner==='reaction'),support:a.getCombatDiagnostics().support});},1000);
  });
  await page.locator('[data-speed="5"]').click();
  return {selected:await page.evaluate(()=>window.__FRONTLINES__.getSummary().selected)};
}
