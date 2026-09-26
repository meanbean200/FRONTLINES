async page => {
 const cdp=await page.context().newCDPSession(page);
 const listeners=async()=>{const r=await cdp.send('Runtime.evaluate',{expression:'JSON.stringify(Object.fromEntries(Object.entries(getEventListeners(window)).map(([k,v])=>[k,v.length])))',includeCommandLineAPI:true,returnByValue:true});return JSON.parse(r.result.value);};
 const beforeListeners=await listeners(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.locator('#sandbox-session').click();await page.keyboard.press('Space');await page.keyboard.press('Escape');
 await page.locator('#return-main').click();await page.locator('#cancel-return').click();
 if(!(await page.locator('#resume-session').isVisible()))throw new Error('Cancel did not retain paused battle');
 await page.locator('#return-main').click();await page.locator('#save-return').click();
 const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v4'));
 if(!saved)throw new Error('Save and return failed');
 const rows=[];
 for(let i=0;i<30;i++){
  await page.locator('#main-continue').click();
  const player=await page.evaluate(()=>window.__FRONTLINES__.getSessionStats());
  if(player.kind!=='player'||player.active!==1||player.planners!==1)throw new Error('Invalid player ownership '+JSON.stringify(player));
  await page.keyboard.press('Escape');await page.locator('#return-main').click();await page.locator('#discard-return').click();
  const home=await page.evaluate(()=>window.__FRONTLINES__.getSessionStats());
  if(home.kind!=='attract'||home.entities!==64||home.active!==1||home.planners!==1)throw new Error('Invalid attract ownership '+JSON.stringify(home));
  if(await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v4'))!==saved)throw new Error('Attract changed campaign save');
  rows.push({cycle:i+1,playerGeneration:player.generation,homeGeneration:home.generation,geometries:home.gpu.geometries,textures:home.gpu.textures,active:home.active,planners:home.planners});
 }
 const afterListeners=await listeners();await cdp.detach();
 if(Object.entries(afterListeners).some(([k,n])=>n>(beforeListeners[k]??0)))throw new Error('Window listeners grew: '+JSON.stringify({beforeListeners,afterListeners}));
 await page.screenshot({path:'output/playwright/dev-menu-20260926/05-home-after-30-transitions.png'});
 return {transitions:rows,saveBytes:saved.length,saveUnchanged:true,beforeListeners,afterListeners,errors};
}
