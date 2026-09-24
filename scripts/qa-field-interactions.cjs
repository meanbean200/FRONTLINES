async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4175/');await page.setViewportSize({width:1920,height:1080});
  await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForTimeout(900);
  await page.getByRole('button',{name:'Your force',exact:true}).click();
  await page.locator('.roster-row.engineer').dblclick();
  await page.getByRole('button',{name:'Your force',exact:true}).click();
  await page.waitForTimeout(500);await page.mouse.move(1100,600);await page.mouse.wheel(0,1400);await page.waitForTimeout(800);
  // Start engineer mode through the keyboard, then actually draw and release.
  await page.keyboard.press('b');
  const points=await page.evaluate(()=>{const q=window.__FRONTLINES__.getState().squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy');return [{x:q.x-100,z:q.z+40},{x:q.x-40,z:q.z+40}].map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3));});
  const count=await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.length);
  const hit=await page.evaluate(p=>({p,target:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,120),mode:document.querySelector('#battlefield').dataset.mode}),points[0]);
  if(points.some(p=>!p.visible))throw Error('QA setup: drawn ground must be in view. '+JSON.stringify(hit));
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:12});await page.mouse.up();
  await page.waitForTimeout(250);
  const trenchIssued=await page.evaluate(n=>window.__FRONTLINES__.getState().trenches.length===n+1,count);
  const trenchStatus=await page.evaluate(()=>({mode:document.querySelector('#battlefield').dataset.mode,toast:document.querySelector('#toast').textContent,selected:window.__FRONTLINES__.getSummary().selected}));
  await page.getByRole('button',{name:'Select Able',exact:true}).click();
  const a=await page.getByRole('button',{name:'Select Able',exact:true}).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+40);await page.mouse.down({button:'right'});await page.mouse.move(a.x+180,a.y+90,{steps:15});await page.mouse.up({button:'right'});await page.waitForTimeout(250);
  const routeIssued=await page.evaluate(()=>window.__FRONTLINES__.getState().squads.find(q=>q.name==='Able').order.drawnPath?.length>1&&document.querySelector('.order-ink path[marker-end]')?.getAttribute('d').length>5);
  await page.screenshot({path:'output/playwright/field-r4-order-route.png'});
  await page.keyboard.press('h');await page.getByRole('button',{name:'Select Able',exact:true}).dblclick();await page.waitForTimeout(700);
  await page.screenshot({path:'output/playwright/field-r4-close-scale.png'});
  await page.mouse.move(1100,650);await page.mouse.wheel(0,2300);await page.waitForTimeout(900);
  const operational=await page.locator('.tactical-overlay').getAttribute('data-scale')==='operational';
  await page.screenshot({path:'output/playwright/field-r4-operational-scale.png'});
  const alignment=await page.evaluate(async()=>{
    const values=[];for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);const q=window.__FRONTLINES__.getState().squads.find(q=>q.name==='Able'),p=window.__FRONTLINES__.projectWorld(q.x,q.z,3),m=document.querySelector('[aria-label="Select Able"]'),xy=/translate\(\s*([-\d.]+)px,\s*([-\d.]+)px\)/.exec(m.style.transform);if(xy)values.push(Math.hypot(Number(xy[1])-p.x,Number(xy[2])-(p.y-18)));}return {samples:values.length,max:values.length?Math.max(...values):null};});
  // Map supplies the camera repositioning. No simulation state injection.
  await page.keyboard.press('g');await page.locator('.field-map [data-scale="theater"]').click();
  const river=-720+Math.sin(600/760)*310;
  const span=await page.evaluate(()=>window.__FRONTLINES__.getState().worldSize),map=await page.locator('.field-map canvas').boundingBox();await page.mouse.click(map.x+map.width*.5,map.y+map.height*(river/span+.5));
  await page.mouse.move(1050,600);await page.mouse.wheel(0,-1600);await page.waitForTimeout(800);await page.keyboard.press('b');
  const water=await page.evaluate(z=>[{x:0,z:z-40},{x:0,z:z+40}].map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3)),river);
  await page.mouse.move(water[0].x,water[0].y);await page.mouse.down();await page.mouse.move(water[1].x,water[1].y,{steps:12});
  const invalid=await page.locator('.draft-readout').getAttribute('data-invalid')==='true';await page.screenshot({path:'output/playwright/field-r4-obstructed-trench.png'});await page.keyboard.press('Escape');await page.mouse.up();
  const modes=[];
  await page.keyboard.press('Escape');await page.locator('#choose-operation').click();
  for(const mode of ['advance','defense','sandbox']){
    await page.locator(`[data-mode-choice="${mode}"]`).click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
    await page.waitForFunction(mode=>document.documentElement.dataset.gameMode===mode,mode);await page.waitForTimeout(350);
    modes.push({mode,actual:await page.evaluate(()=>document.documentElement.dataset.gameMode)});
    await page.screenshot({path:`output/playwright/field-r4-mode-${mode}.png`});await page.locator('.operation-menu-button').click();await page.locator('#choose-operation').click();
  }
  return {scope:'Production UI orders, map, zoom and mode smoke test',modes,alignment,hit,trenchStatus,errors,checks:{trenchIssued,routeIssued,operational,labelsAligned:alignment.samples===12&&Number.isFinite(alignment.max)&&alignment.max<.2,invalidPlotMarked:invalid,allModes:modes.every(m=>m.actual===m.mode),noPageErrors:!errors.length}};
}
