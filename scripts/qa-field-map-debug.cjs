async(page)=>{
  await page.goto('http://127.0.0.1:4175/');await page.setViewportSize({width:1920,height:1080});
  await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();await page.locator('#map-expand').click();
  const events=[];await page.exposeFunction('logFieldEvent',s=>events.push(s));
  await page.evaluate(()=>{for(const type of ['pointerdown','pointerup','click','close','cancel','keydown'])document.addEventListener(type,e=>window.logFieldEvent({type,target:e.target.tagName,cls:e.target.className,scale:e.target.dataset?.scale,map:document.querySelector('.field-map').open,key:e.key,x:e.clientX,y:e.clientY}),true);});
  const before=await page.locator('.field-map').evaluate(e=>({open:e.open,html:e.outerHTML.slice(0,800),bounds:e.getBoundingClientRect().toJSON()}));
  await page.locator('.field-map button[data-scale="theater"]').click();
  const after=await page.locator('.field-map').evaluate(e=>({open:e.open,scale:e.dataset.scale,bounds:e.getBoundingClientRect().toJSON()}));
  await page.screenshot({path:'output/playwright/field-theater-debug.png'});
  await page.keyboard.press('Escape');
  return {events,before,after,checks:await page.evaluate(()=>({mapClosed:!document.querySelector('.field-map').open,menuClosed:!document.querySelector('.operation-menu').open}))};
}
