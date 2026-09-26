// Read-only dimensions, actual menu controls. No scenario state injection.
async page=>{
 const result={sizes:[],transitions:[]},read=()=>page.evaluate(()=>({viewport:window.__FRONTLINES_VIEWPORT__(),session:window.__FRONTLINES__.getSessionStats(),save:JSON.stringify(localStorage)}));
 const save=(await read()).save;
 for(const [width,height] of [[1920,1080],[1600,900],[1536,864],[1366,768],[1280,720],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.reload();await page.locator('#choose-operation').waitFor();await page.waitForTimeout(500);
  const d=await read();result.sizes.push({width,height,...d.viewport});
  if(d.viewport.canvas.width!==width||d.viewport.canvas.height!==height||d.viewport.rendererSize[0]!==width||d.viewport.rendererSize[1]!==height)throw new Error('Host coverage failed');
  await page.screenshot({path:`output/playwright/home-after-${width}x${height}.png`});
 }
 await page.setViewportSize({width:1600,height:900});
 await page.locator('[data-settings]').click();await page.locator('#menu-back').click();result.settingsReturn=await read();
 for(let n=0;n<30;n++){
  await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  await page.keyboard.press('Escape');await page.locator('#return-main').click();await page.locator('#discard-return').click();await page.locator('#choose-operation').waitFor();
  const d=await read();result.transitions.push(d.session);
  if(d.session.active!==1||d.session.planners!==1||d.session.kind!=='attract'||d.session.entities!==64||d.save!==save)throw new Error('Menu isolation failed at transition '+n);
  await page.evaluate(r=>{window.__HOME_LAYOUT_QA__=r;},result);
 }
 result.saveUnchanged=(await read()).save===save;
 await page.screenshot({path:'output/playwright/home-after-30-transitions.png'});await page.evaluate(r=>{window.__HOME_LAYOUT_QA__=r;},result);
}
