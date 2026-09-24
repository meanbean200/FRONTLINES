async(page)=>{
  await page.bringToFront();await page.getByRole('button',{name:'OPEN-ENDED CAMPAIGN SAVE & RESUME Trench war'}).click();await page.getByRole('button',{name:'Begin operation'}).click();
  await page.locator('[data-speed="0"]').click();await page.getByRole('button',{name:'INFANTRY SELECT ALL ↗'}).click();
  const samples=[];
  for(const [width,height] of [[1440,960],[1024,600],[800,600],[600,400],[390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    const data=await page.evaluate(()=>{const selectors=['.brand','.session-controls','.operation-hud','.force-roster','.garrison-panel','.selection-card','.command-dock','.map-panel','.mode-label','.operation-menu-button'];const boxes=selectors.flatMap(selector=>{const e=document.querySelector(selector);if(!e||getComputedStyle(e).display==='none')return [];const r=e.getBoundingClientRect();return [{selector,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}];});const overlaps=boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y).map(b=>[a.selector,b.selector]));return {width:innerWidth,height:innerHeight,boxes,overlaps,canvas:document.querySelector('#battlefield').getBoundingClientRect().toJSON()};});
    await page.screenshot({path:`output/playwright/screen-fit-before-${width}x${height}-2026-09-23.png`});samples.push(data);
  }
  await page.getByRole('button',{name:'Save',exact:true}).click();
  return {samples,state:await page.evaluate(()=>window.__FRONTLINES__.getState()),saved:await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'))};
}
