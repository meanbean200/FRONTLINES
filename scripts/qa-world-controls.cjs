async(page)=>{
 const prefix='output/playwright/world-rebase/controls-r4',errors=[],modes=[];
 await page.reload();await page.bringToFront();await page.setViewportSize({width:1920,height:1080});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const saved=await page.evaluate(()=>JSON.stringify(localStorage));
 if(saved!=='{}')throw Error('Use a fresh isolated test session; do not touch player saves.');
 await page.screenshot({path:prefix+'-menu.png'});
 for(const mode of ['advance','defense','sandbox','campaign']){
  if(await page.locator('.operation-menu').isHidden()){await page.locator('.operation-menu-button').click();await page.locator('#choose-operation').click();}
  await page.locator(`[data-mode-choice="${mode}"]`).click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();await page.waitForTimeout(1300);
  await page.waitForFunction(()=>{const a=window.__FRONTLINES__,s=a.getState(),p=s.operation?.mode==='campaign'?s.operation.objectives[0]:s.soldiers.find(p=>s.squads.find(q=>q.id===p.squadId)?.faction!=='enemy'),c=a.getVisualStats().cameraTarget;return Math.hypot(p.x-c.x,p.z-c.z)<3;});
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState());
  modes.push({mode,worldVersion:state.worldVersion,worldSize:state.worldSize,people:state.soldiers.length,objectives:state.operation?.objectives,stats:await page.evaluate(()=>window.__FRONTLINES__.getVisualStats())});
  await page.screenshot({path:prefix+'-'+mode+'.png'});
 }
 await page.locator('#map-expand').click();await page.locator('button[data-scale="theater"]').click();await page.screenshot({path:prefix+'-theater.png'});
 const mapTitle=await page.locator('button[data-scale="theater"]').innerText(),box=await page.locator('.field-map canvas').boundingBox();
 await page.mouse.click(box.x+box.width*.92,box.y+box.height*.12);await page.waitForFunction(()=>{const c=window.__FRONTLINES__.getVisualStats().cameraTarget;return Math.hypot(c.x-1680,c.z+1520)<2;});
 const mapFocus=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats().cameraTarget);
 await page.locator('#map-overview').click();await page.waitForFunction(()=>document.querySelector('#map-scale').textContent==='4 KM · THEATER');const mini=await page.locator('#minimap').boundingBox();await page.mouse.click(mini.x+mini.width*.08,mini.y+mini.height*.92);await page.waitForFunction(()=>{const c=window.__FRONTLINES__.getVisualStats().cameraTarget;return Math.hypot(c.x+1680,c.z-1680)<2;});
 const miniFocus=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats().cameraTarget);await page.screenshot({path:prefix+'-edge.png'});
 await page.keyboard.down('Shift');await page.keyboard.down('a');await page.waitForTimeout(1400);await page.keyboard.up('a');await page.keyboard.up('Shift');await page.waitForTimeout(900);
 const pan=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats().cameraTarget);
 await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await page.locator('#resume-session').click();
 const raw=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
 await page.locator('[data-speed="1"]').click();await page.waitForTimeout(1600);await page.locator('[data-speed="0"]').click();
 await page.locator('.operation-menu-button').click();await page.locator('#continue-save').click();
 const loaded=await page.evaluate(()=>window.__FRONTLINES__.getState());
 const expected=JSON.parse(raw),saveDifferences=[];
 const compare=(a,b,path='')=>{if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],path+'.'+k);}else if(saveDifferences.length<20)saveDifferences.push({path,saved:a,loaded:b});};compare(expected,loaded);
 // A controlled legacy file in THIS disposable profile, not the user's browser.
 const legacy=await(await page.request.get('http://127.0.0.1:4173/output/playwright/world-rebase/before-world.json')).json();
 const legacyRaw=JSON.stringify(legacy.fixture.state);await page.evaluate(raw=>{localStorage.removeItem('frontlines-battlefield-v3-world2-4km');localStorage.setItem('frontlines-battlefield-v3',raw);},legacyRaw);
 await page.locator('.operation-menu-button').click();await page.locator('#continue-save').click();
 const notice=await page.locator('.menu-status').innerText();await page.screenshot({path:prefix+'-legacy-preserved.png'});
 const legacyUnchanged=await page.evaluate(raw=>localStorage.getItem('frontlines-battlefield-v3')===raw,legacyRaw);
 await page.evaluate(()=>localStorage.removeItem('frontlines-battlefield-v3'));await page.locator('#resume-session').click();
 const dimensions=[];
 for(const [width,height] of [[2560,1440],[1000,600]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);dimensions.push(await page.locator('#battlefield').evaluate(e=>({w:e.clientWidth,h:e.clientHeight,expected:[innerWidth,innerHeight]})));await page.screenshot({path:prefix+`-${width}.png`});}
 await page.setViewportSize({width:1600,height:900});
 return {scope:'Actual Edge mode, map, pan, save/load and legacy-load controls; disposable empty browser storage. No player saves.',modes,mapTitle,mapFocus,miniFocus,pan,notice,dimensions,errors,saveDifferences,checks:{modesValid:modes.every(m=>m.worldVersion===2&&m.worldSize===4000&&m.stats.generatedChunks===64),mapFocus:Math.hypot(mapFocus.x-1680,mapFocus.z+1520)<2,miniFocus:Math.hypot(miniFocus.x+1680,miniFocus.z-1680)<2,boundedPan:Math.abs(pan.x)<=1980&&Math.abs(pan.z)<=1980,saveContinues:saveDifferences.length===0,legacyPreserved:legacyUnchanged&&notice.includes('original save is preserved'),fullCanvas:dimensions.every(d=>d.w===d.expected[0]&&d.h===d.expected[1]),noErrors:!errors.length,qaStorageRestored:await page.evaluate(()=>JSON.stringify(localStorage))===saved}};
}
