async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=label=>page.screenshot({path:`output/playwright/field-production-r3-${label}.png`});
  await page.goto('http://127.0.0.1:4175/');
  await page.waitForFunction(()=>window.__FRONTLINES__?.ready);
  const storage=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  const menus=[],hud=[];
  for(const [width,height] of [[1920,1080],[2560,1440],[1366,768],[1024,768],[800,600],[560,760],[1024,520]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    await page.locator('.operation-menu').evaluate(e=>e.scrollTop=0);
    menus.push(await page.evaluate(()=>{
      const menu=document.querySelector('.operation-menu'),r=menu.getBoundingClientRect();
      return {size:[innerWidth,innerHeight],centered:Math.abs(r.x+r.width/2-innerWidth/2)<1,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,noOverflow:menu.scrollWidth<=r.width,oneChoice:document.querySelectorAll('.mode-card[aria-pressed=true]').length===1};
    }));
    await page.locator('#menu-quality').scrollIntoViewIfNeeded();
    if(width===1920||width===560)await shot(`menu-${width}`);
  }
  await page.setViewportSize({width:1920,height:1080});
  const choices=[];
  for(const mode of ['campaign','advance','defense','sandbox']){await page.locator(`[data-mode-choice="${mode}"]`).click();choices.push({mode,pressed:await page.locator(`[data-mode-choice="${mode}"]`).getAttribute('aria-pressed')==='true'});}
  await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForTimeout(250);
  for(const [width,height] of [[1920,1080],[2560,1440],[1366,768],[1024,768],[800,600],[560,760],[1024,520]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(180);
    hud.push(await page.evaluate(()=>{
      const selectors=['.brand','.session-controls','.operation-menu-button','.operation-hud','.command-dock','.hud-tools','.selection-docket','.map-panel','.garrison-panel','.support-controls'];
      const panels=selectors.map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {selector,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'};}).filter(p=>p.visible);
      const overlaps=[];for(let a=0;a<panels.length;a++)for(let b=a+1;b<panels.length;b++){const p=panels[a],q=panels[b];if(Math.min(p.right,q.right)-Math.max(p.x,q.x)>2&&Math.min(p.bottom,q.bottom)-Math.max(p.y,q.y)>2)overlaps.push([p.selector,q.selector]);}
      const canvas=document.querySelector('#battlefield').getBoundingClientRect();
      return {size:[innerWidth,innerHeight],panels,overlaps,inside:panels.every(p=>p.x>=0&&p.y>=0&&p.right<=innerWidth+1&&p.bottom<=innerHeight+1),fills:canvas.width===innerWidth&&canvas.height===innerHeight};
    }));
    await shot(`hud-${width}x${height}`);
  }
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(150);
  await page.locator('#selection-docket').click();await shot('report');
  const report=await page.locator('#selection-detail').innerText();
  await page.getByRole('button',{name:'Selected squad details',exact:true}).click();
  await page.locator('#map-expand').click();
  const pausedAt=await page.evaluate(()=>window.__FRONTLINES__.getState().elapsed);
  await page.keyboard.press('h');await page.keyboard.press('b');await page.waitForTimeout(300);
  const mapPaused=await page.evaluate(t=>window.__FRONTLINES__.getState().elapsed===t&&document.querySelector('#battlefield').dataset.mode==='select',pausedAt);
  await shot('map-sector');
  await page.locator('.field-map button[data-scale="theater"]').click();await shot('map-theater');
  await page.keyboard.press('Escape');
  const mapClosed=await page.locator('.field-map').evaluate(e=>!e.open)&&!(await page.locator('.operation-menu').evaluate(e=>e.open));
  await page.keyboard.press('b');
  const points=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState(),q=s.squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy');return [{x:q.x-100,z:q.z+40},{x:q.x-40,z:q.z+40}].map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3));});
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:15});
  const draft=await page.locator('.draft-readout').innerText();
  await shot('trench-draft');
  const trenches=await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.length);await page.keyboard.press('Escape');await page.mouse.up();
  const canceled=await page.evaluate(n=>window.__FRONTLINES__.getState().trenches.length===n&&document.querySelector('.draft-readout').hidden,trenches);
  const finalStorage=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  return {scope:'Field-command UI with actual Edge controls; disposable QA session',menus,hud,choices,report,draft,errors,checks:{menusFit:menus.every(m=>m.inside&&m.noOverflow&&m.centered&&m.oneChoice),hudFits:hud.every(m=>m.inside&&m.fills),noHudOverlap:hud.every(m=>!m.overlaps.length),allModeChoices:choices.every(c=>c.pressed),mapPaused,mapClosed,draftReadout:draft.includes('METRES'),cancelPreservesWorks:canceled,savesUntouched:storage===finalStorage,noPageErrors:!errors.length}};
}
