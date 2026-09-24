async(page)=>{
  await page.locator('[data-speed="0"]').click();
  return {state:await page.evaluate(()=>window.__FRONTLINES__.getState()),diagnostics:await page.evaluate(()=>window.__FRONTLINES__.getCombatDiagnostics()),samples:await page.evaluate(()=>window.autonomySamples??[]),screenshot:(await page.screenshot()).toString('base64')};
}
