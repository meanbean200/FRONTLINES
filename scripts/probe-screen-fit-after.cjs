async(page)=>{
  await page.bringToFront();await page.reload();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const build=await page.locator('script[type="module"]').getAttribute('src'),tag=build.split('/').at(-1).replace('.js','');
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  if(await page.locator('#roster-toggle').isVisible())await page.locator('#roster-toggle').click();
  await page.getByRole('button',{name:'INFANTRY SELECT ALL ↗'}).click();
  if(await page.locator('#roster-toggle').isVisible())await page.locator('#roster-toggle').click();
  const samples=[];
  for(const [width,height] of [[1920,1080],[1440,960],[1366,768],[1151,721],[1150,721],[1280,600],[1024,600],[900,650],[800,600],[700,600],[601,600],[600,400],[844,390],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(300);
    const data=await page.evaluate(()=>{const selectors=['.brand','.session-controls','.operation-hud','.force-roster','.garrison-panel','.selection-card','.command-dock','.map-panel','.mode-label','.operation-menu-button','.hud-tools'];const boxes=selectors.flatMap(selector=>{const e=document.querySelector(selector);if(!e||getComputedStyle(e).display==='none')return [];const r=e.getBoundingClientRect();return [{selector,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}];});const overlaps=boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5).map(b=>[a.selector,b.selector]));const overflow=boxes.filter(b=>b.x<-.5||b.y<-.5||b.right>innerWidth+.5||b.bottom>innerHeight+.5);const c=document.querySelector('#battlefield');return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boxes,overlaps,overflow,canvas:{...c.getBoundingClientRect().toJSON(),bufferWidth:c.width,bufferHeight:c.height,ratio:devicePixelRatio}};});
    await page.screenshot({path:`output/playwright/screen-fit-after-${tag}-${width}x${height}-2026-09-23.png`});samples.push(data);
  }
  return {checks:{noOverlaps:samples.every(s=>!s.overlaps.length),inBounds:samples.every(s=>!s.overflow.length&&s.scrollWidth===s.width),canvasFits:samples.every(s=>s.canvas.width===s.width&&s.canvas.height===s.height)},samples,unchanged:JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>window.__FRONTLINES__.getState())),build:await page.locator('script[type="module"]').getAttribute('src')};
}
