async(page)=>{
  await page.bringToFront();await page.goto('http://127.0.0.1:4175/');await page.setViewportSize({width:1920,height:1080});
  await page.screenshot({path:'output/playwright/field-folio-menu.png'});
  await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().chunks>0&&document.querySelectorAll('.squad-marker').length>=8);
  await page.waitForTimeout(500);await page.screenshot({path:'output/playwright/field-folio-battlefield.png'});
  await page.getByRole('button',{name:'Your force',exact:true}).click();await page.locator('.roster-row.engineer').click();await page.getByRole('button',{name:'Your force',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#trench-command').hidden);
  const samples=[];
  for(const [width,height]of [[1920,1080],[1366,768],[560,760]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    samples.push(await page.evaluate(()=>{const dock=document.querySelector('.command-dock').getBoundingClientRect(),time=document.querySelector('#battle-time').getBoundingClientRect(),plot=document.querySelector('#trench-command').getBoundingClientRect();return {width:innerWidth,height:innerHeight,clockVisible:time.width>0,plotVisible:plot.width>0,barFits:dock.left>=0&&dock.right<=innerWidth&&dock.bottom<=innerHeight,plotInside:plot.left>=dock.left&&plot.right<=dock.right};}));
    await page.screenshot({path:`output/playwright/field-folio-engineers-${width}.png`});
  }
  await page.setViewportSize({width:1920,height:1080});
  return {scope:'Settled production screenshots and engineer command / clock layout',samples,checks:{allSizes:samples.every(s=>s.clockVisible&&s.plotVisible&&s.barFits&&s.plotInside)}};
}
