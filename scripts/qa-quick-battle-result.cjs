async(page)=>{
  const response=await page.request.get('http://127.0.0.1:4173/output/playwright/quick-battle/defense-result-r1.json');
  if(!response.ok())throw Error('Run the local defense fixture generator and Vite dev server first.');
  const fixture=await response.json();
  const out=`output/playwright/quick-battle/result-${Date.now()}-`,errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.reload();await page.locator('#choose-operation').waitFor();
  // The isolated QA profile loads a real headless-completed battle through the
  // normal Load control. This is after-action UI evidence, not a browser-played win.
  const previous=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
  await page.evaluate(s=>localStorage.setItem('frontlines-battlefield-v3-world2-4km',JSON.stringify(s)),fixture.state);
  await page.reload();await page.locator('#main-continue').click();await page.getByRole('heading',{name:'Sector secured'}).waitFor();
  await page.screenshot({path:out+'after-action.png'});
  const result=await page.locator('.operation-menu').innerText();
  await page.locator('#change-settings').click();const size=await page.locator('#battle-size').inputValue(),seed=await page.locator('#sector-seed').inputValue();
  await page.locator('#menu-back').click();await page.locator('#main-continue').click();await page.locator('.operation-menu-button').click();
  await page.locator('#rematch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  const rematch=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return {setup:s.operation.setup,status:s.operation.status,elapsed:s.elapsed,personnel:s.soldiers.length};});
  await page.locator('.operation-menu-button').click();await page.locator('#return-main').click();await page.locator('#choose-operation').click();
  const fresh=await page.locator('#battle-map').inputValue();
  await page.locator('.advanced-setup>summary').click();await page.locator('#preset-name').fill(`Keyboard preset ${Date.now()}`);await page.locator('#preset-name').press('Enter');
  const enterSaved=await page.locator('.menu-status').innerText(),stillSetup=await page.locator('#launch-operation').isVisible();
  if(previous!==null)await page.evaluate(raw=>localStorage.setItem('frontlines-battlefield-v3-world2-4km',raw),previous);
  return {scope:'Normal controls from an actual simulation-completed fixture, not a manually played victory',screenshots:out,bundle:await page.locator('script[type="module"]').getAttribute('src'),simulation:fixture.summary,result,size,seed,rematch,fresh,enterSaved,errors,checks:{afterAction:result.includes('Sector secured')&&result.includes('Restart battle')&&result.includes('Return to main menu'),changeSettings:size==='small'&&seed==='1944',rematch:JSON.stringify(rematch.setup)===JSON.stringify(fixture.summary.setup)&&rematch.status==='active'&&rematch.elapsed<2,newBattle:fresh==='random',enterSavesPreset:enterSaved.includes('Saved local setup')&&stillSetup,noPageErrors:errors.length===0}};
}
