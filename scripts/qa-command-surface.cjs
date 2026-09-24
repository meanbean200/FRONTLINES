async (page) => {
  const checks={},errors=[],out='output/playwright/cinematic-ui/commands-'+Date.now()+'-';
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>window.__FRONTLINES__.getState());
  const selected=()=>page.evaluate(()=>window.__FRONTLINES__.getSummary().selected);
  const project=point=>page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.2),point);
  const clickPoint=async point=>{const p=await project(point);if(!p.visible||p.x<430||p.x>1850||p.y<200||p.y>800)throw Error('Target not clear of HUD '+JSON.stringify(p));await page.mouse.click(p.x,p.y);};
  const draw=async(a,b,button='left')=>{const p=await project(a),q=await project(b);await page.mouse.move(p.x,p.y);await page.mouse.down({button});await page.mouse.move(q.x,q.y,{steps:12});await page.mouse.up({button});};
  await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:4175/');
  await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="line-defense"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForTimeout(650);
  const before=await state(),rifle=before.squads.find(q=>q.faction!=='enemy'&&q.kind==='rifle');
  await page.locator('.squad-marker[aria-label="Select '+rifle.name+'"]').click();
  checks.selection=(await selected()).includes(rifle.id);
  const target={x:rifle.x+20,z:rifle.z+25};
  await draw({x:rifle.x,z:rifle.z},target,'right');
  const moved=(await state()).squads.find(q=>q.id===rifle.id);
  checks.drawnMove=moved.order.type==='move'&&moved.order.drawnPath?.length>1;
  const elapsed=(await state()).elapsed;
  await page.locator('[data-speed="1"]').click();await page.waitForTimeout(1700);await page.locator('[data-speed="0"]').click();
  checks.speed=(await state()).elapsed>elapsed+1;
  await page.keyboard.press('h');
  checks.hold=(await state()).squads.find(q=>q.id===rifle.id).order.type==='hold';
  for(const intent of ['observe','suppress','assault','fall-back']){
    await page.locator('[data-tactical="'+intent+'"]').click();await clickPoint({x:rifle.x+35,z:rifle.z+30});
    checks[intent]=(await state()).squads.find(q=>q.id===rifle.id).order.intent===intent;
  }
  await page.keyboard.press('h');
  const trench=before.trenches.find(t=>t.id===rifle.order.trenchId),points=trench.points;
  await page.locator('#occupy-command').click();await draw(points[Math.floor(points.length/2)-1],points[Math.floor(points.length/2)+1]);
  checks.defend=(await state()).squads.find(q=>q.id===rifle.id).order.type==='occupy-trench';
  await page.keyboard.press('Escape');
  checks.drawerEscape=await page.locator('.garrison-panel').isHidden()&&await page.locator('.operation-menu').isHidden();
  // Actual box gesture around the visible formation centers.
  await page.mouse.move(620,430);await page.mouse.down();await page.mouse.move(1120,610,{steps:8});await page.mouse.up();
  checks.boxSelection=(await selected()).length>1;
  await page.locator('#map-expand').click();
  const map=page.locator('.field-map canvas'),box=await map.boundingBox();
  const mapTarget={x:rifle.x+60,z:rifle.z+80};
  await page.mouse.click(box.x+(mapTarget.x/4000+.5)*box.width,box.y+(mapTarget.z/4000+.5)*box.height,{button:'right'});
  checks.mapOrder=(await state()).squads.filter(q=>q.order.type==='move'&&q.faction!=='enemy').length>1;
  await page.keyboard.press('m');
  await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
  const mortar=before.squads.find(q=>q.faction!=='enemy'&&q.kind==='mortar');
  await page.locator('[data-squad="'+mortar.id+'"]').dblclick();await page.locator('[aria-label="Close forces"]').click();
  await page.waitForTimeout(650);
  await page.locator('#support-command').click();await page.locator('[data-support="mortarSmoke"]').click();
  // Zoom out with the real wheel to include a safe target 80 m away.
  await page.mouse.move(960,450);await page.mouse.wheel(0,400);await page.waitForTimeout(600);
  await clickPoint({x:mortar.x+80,z:mortar.z});
  checks.support=(await state()).operation.supportMissions.some(m=>m.kind==='mortarSmoke'&&m.squadId===mortar.id);
  await page.screenshot({path:out+'support.png'});
  // A paused live session survives preview cancellation and a save/load cycle.
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
  const snapshot=await state();
  await page.locator('#change-settings').click();await page.locator('[data-mode-choice="meeting"]').click();
  await page.locator('#launch-operation').click();await page.locator('#back-to-setup').click();
  checks.activePreviewRollback=JSON.stringify(snapshot)===JSON.stringify(await state());
  checks.previewDoesNotSave=saved===await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v3-world2-4km'));
  await page.keyboard.press('Escape');await page.locator('#main-continue').click();await page.locator('.operation-menu-button').click();await page.locator('#continue-save').click();
  const loaded=await state();checks.loadExact=JSON.stringify(JSON.parse(saved))===JSON.stringify(loaded);
  checks.noPageErrors=errors.length===0;
  return {checks,errors,screenshots:out};
}
