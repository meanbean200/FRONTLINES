async(page)=>{
  const out='output/playwright/cinematic-ui/build-'+Date.now()+'-',errors=[],checks={};
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>window.__FRONTLINES__.getState());
  const project=p=>page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3),p);
  const screenClear=p=>p.visible&&p.x>440&&p.x<1450&&p.y>200&&p.y<790;
  const draw=async(a,b,shot)=>{const p=await project(a),q=await project(b);if(!screenClear(p)||!screenClear(q))return false;await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:16});if(shot)await page.screenshot({path:out+shot+'.png'});await page.mouse.up();return true;};
  await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:4175/');
  await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="line-defense"]').click();
  await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForTimeout(650);
  // Build is reachable even with no current formation selected.
  await page.locator('.hud-tools>summary').click();await page.locator('#open-build').click();
  checks.unselectedBuild=await page.locator('#trench-command').isVisible();
  await page.locator('[data-build-close]').click();
  const before=await state(),engineer=before.squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy');
  await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
  await page.locator('[data-squad="'+engineer.id+'"]').dblclick();await page.locator('[aria-label="Close forces"]').click();
  await page.mouse.move(960,450);await page.mouse.wheel(0,350);await page.waitForTimeout(700);
  const g=before.living.garrisons.find(g=>g.squadIds.includes(engineer.id)),trench=before.trenches.find(t=>t.id===g.trenchId);
  await page.locator('#build-command').click();await page.locator('[data-build-category="support"]').click();await page.locator('#build-network').selectOption(String(g.id));
  if(await page.locator('#assign-builders').isVisible())await page.locator('#assign-builders').click();
  await page.locator('[data-build-kind="meal"]').click();
  let site;
  for(const p of trench.points.flatMap(p=>[14,24,32].map(d=>({x:p.x-Math.sin(g.front)*d,z:p.z-Math.cos(g.front)*d})))){
    const s=await project(p);if(!screenClear(s))continue;
    await page.mouse.move(s.x,s.y);await page.waitForTimeout(60);
    if(await page.locator('.draft-readout').getAttribute('data-invalid')==='false'){site={...p,screen:s};break;}
  }
  if(!site)throw Error('No clear reachable support site in the current camera');
  await page.screenshot({path:out+'support-site.png'});await page.mouse.click(site.screen.x,site.screen.y);
  checks.facilityQueued=(await state()).living.facilities.some(f=>!before.living.facilities.some(old=>old.id===f.id)&&f.kind==='meal');
  await page.locator('#build-command').click();await page.locator('#trench-command').click();
  checks.directTrench=(await page.locator('#battlefield').getAttribute('data-mode'))==='trench'&&await page.locator('#build-panel').isHidden();
  const origin={x:engineer.x+28,z:engineer.z+28};
  if(!await draw(origin,{x:origin.x+5,z:origin.z}))throw Error('Short-draw camera unavailable');
  const shortToast=await page.locator('#toast').innerText();checks.shortExplained=shortToast.includes('too short')&&await page.locator('#battlefield').getAttribute('data-mode')==='trench';
  const count=(await state()).trenches.length;
  await draw(origin,{x:origin.x+15,z:origin.z},'trench-drawing');
  const after=await state();checks.fifteenMetresAccepted=after.trenches.length===count+1;
  await page.locator('#build-command').click();await page.locator('[data-build-category="support"]').click();
  const noCrew=await page.locator('.build-workforce').innerText();checks.reassignmentExplained=noCrew.includes('No engineers');
  await page.locator('#assign-builders').click();await page.waitForFunction(()=>document.querySelector('#assign-builders').hidden);
  checks.reassignAvailable=await page.locator('[data-build-kind="meal"]').isEnabled();
  await page.screenshot({path:out+'reassigned.png'});checks.noErrors=errors.length===0;
  return {scope:'Actual controls, generated Defend the Line, unmodified inventory, no save writes',checks,shortToast,noCrew,site,errors,screenshots:out};
}
