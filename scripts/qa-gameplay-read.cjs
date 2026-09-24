async(page) => ({
  audit:await page.evaluate(()=>{const a=window.__FRONTLINES_AUDIT;return a?{setup:a.setup,first:a.first,events:a.events,samples:a.samples}:null;}),
  state:await page.evaluate(()=>window.__FRONTLINES__.getState()),
  hud:await page.locator('#ui-root').innerText(),
})
