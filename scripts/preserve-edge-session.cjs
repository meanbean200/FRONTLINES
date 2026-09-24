async (page) => ({
  url:page.url(),
  capturedAt:new Date().toISOString(),
  session:await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),storage:Object.fromEntries(Object.entries(localStorage)),menuOpen:Boolean(document.documentElement.dataset.menu),chosen:document.querySelector('.mode-card.chosen')?.getAttribute('data-mode-choice')})),
})
