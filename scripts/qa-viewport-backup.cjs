async (page) => ({
  scope: 'Preserve the active world and browser storage before viewport recovery',
  url: page.url(),
  viewport: page.viewportSize(),
  snapshot: await page.evaluate(() => ({
    state: window.__FRONTLINES__.getState(),
    storage: Object.fromEntries(Object.entries(localStorage)),
    summary: window.__FRONTLINES__.getSummary(),
    visual: window.__FRONTLINES__.getVisualStats(),
    size: {inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight]},
  })),
})
