async(page)=>{
  await page.bringToFront();
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState()),saved=await page.evaluate(()=>JSON.stringify(localStorage));
  if(before.simSpeed!==0)throw Error('Pause the QA campaign first.');
  if(await page.locator('#build-panel').isHidden())await page.locator('#build-command').click();
  await page.locator('[data-build-kind="rest"]').click();
  const g=before.living.garrisons.find(g=>g.faction!=='enemy'),trench=before.trenches.find(t=>t.id===g.trenchId);
  let site,reason;
  for(const p of trench.points){
    const screen=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3),{x:p.x+Math.sin(g.front)*16,z:p.z+Math.cos(g.front)*16});
    if(!screen.visible||screen.x<380||screen.x>1250||screen.y<160||screen.y>680)continue;
    await page.mouse.move(screen.x,screen.y);await page.waitForTimeout(80);
    reason=await page.locator('.draft-readout').innerText();
    if(reason.includes('rear side')){site=screen;break;}
  }
  if(!site)throw Error('No visible front-side rejection found: '+reason);
  await page.screenshot({path:'output/playwright/build-invalid-site-r1.png'});
  await page.mouse.click(site.x,site.y);
  const rejected=await page.locator('#toast').innerText();
  await page.locator('#move-command').click();await page.waitForTimeout(100);
  const mode=await page.locator('#battlefield').getAttribute('data-mode'),ghostHidden=await page.locator('.route-preview').isHidden(),readoutHidden=await page.locator('.draft-readout').isHidden();
  await page.locator('#build-command').click();await page.keyboard.press('Escape');
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  return {scope:'Actual invalid placement, tool switch and Escape; paused, no save writes',reason,rejected,checks:{invalidExplained:rejected.includes('rear side'),noConstructionCreated:after.living.facilities.length===before.living.facilities.length&&after.trenches.length===before.trenches.length,modeSwitchClearsGhost:mode==='move'&&ghostHidden&&readoutHidden,escapeClosesSheet:await page.locator('#build-panel').isHidden(),noMainMenu:await page.locator('.operation-menu').isHidden(),stateUnchanged:JSON.stringify(before)===JSON.stringify(after),savesUnchanged:saved===await page.evaluate(()=>JSON.stringify(localStorage))}};
}
