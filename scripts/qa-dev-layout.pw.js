// Responsive authoring checks through controls. No runtime manipulation.
async page=>{
 const result=[];
 if(await page.locator('#deselect').count())await page.locator('#deselect').click();
 await page.locator('[data-tool=formation]').click();
 for(const [width,height] of [[1920,1080],[1366,768],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  await page.locator('#placement-side').selectOption('enemy');await page.locator('#placement-kind').selectOption('engineer');
  const d=await page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {inner:[innerWidth,innerHeight],app:b('#app'),canvas:b('#battlefield'),header:b('header'),inspector:b('.inspector'),rail:b('.tool-rail'),save:b('#save'),overflow:document.documentElement.scrollWidth>innerWidth,selection:document.querySelector('#placement-kind').value};});
  if(d.app.width!==width||d.canvas.height!==height||d.overflow||d.save.height<44||d.header.width>width||d.inspector.x<0||d.inspector.x+d.inspector.width>width)throw Error(JSON.stringify(d));
  result.push({width,height,...d});await page.screenshot({path:`output/playwright/dev-responsive-${width}.png`});
 }
 await page.setViewportSize({width:1600,height:900});await page.locator('[data-tool=select]').first().click();
 await page.evaluate(r=>window.__DEV_LAYOUT_QA__=r,result);
}
