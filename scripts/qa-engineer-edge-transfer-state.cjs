async(page)=>{
  await page.bringToFront();
  return {checks:{scope:'Unmodified live UI failure: direct reassignment from occupied old network to completed new T network was rejected'},state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved:await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))};
}
