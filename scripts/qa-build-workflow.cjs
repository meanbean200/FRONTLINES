async(page)=>{
  const suffix=page.url().split('#')[1]||'r4';if(!/^[a-z0-9-]+$/.test(suffix))throw Error('Use a simple unused screenshot suffix.');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.bringToFront();await page.goto('http://127.0.0.1:4175/');await page.setViewportSize({width:1600,height:900});
  await page.locator('[data-mode-choice="campaign"]').click();await page.locator('#launch-operation').click();await page.locator('[data-speed="0"]').click();
  await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().chunks>=8&&document.querySelectorAll('.squad-marker').length>=8);
  await page.evaluate(()=>new Promise(resolve=>{let last,stable=0;const tick=()=>{const p=window.__FRONTLINES__.projectWorld(-1480,-1500,.3);if(p.visible&&p.x>380&&p.x<1250&&p.y>160&&p.y<750&&last&&Math.hypot(p.x-last.x,p.y-last.y)<.1)stable++;else stable=0;last=p;if(stable>=12)resolve(true);else requestAnimationFrame(tick);};tick();}));
  const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.screenshot({path:`output/playwright/build-after-world-${suffix}.png`});
  const visibleFromRifle=await page.locator('#build-command').isVisible();
  await page.locator('#build-command').click();await page.screenshot({path:`output/playwright/build-work-orders-${suffix}.png`});
  const panelText=await page.locator('#build-panel').innerText();await page.locator('[data-build-kind="meal"]').click();
  const g=before.living.garrisons.find(g=>g.faction!=='enemy'),trench=before.trenches.find(t=>t.id===g.trenchId);
  const candidates=trench.points.flatMap(p=>[12,20,30].map(d=>({x:p.x-Math.sin(g.front)*d,z:p.z-Math.cos(g.front)*d})));
  let site,preview;
  for(const p of candidates){const screen=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3),p);if(!screen.visible||screen.x<380||screen.x>1250||screen.y<160||screen.y>750)continue;await page.mouse.move(screen.x,screen.y);await page.waitForTimeout(60);preview=await page.locator('.draft-readout').innerText();if(await page.locator('.draft-readout').getAttribute('data-invalid')==='false'){site={...p,screen};break;}}
  if(!site)throw Error('No visible valid site found: '+preview);
  await page.screenshot({path:`output/playwright/build-site-preview-${suffix}.png`});await page.mouse.click(site.screen.x,site.screen.y);
  const facility=await page.evaluate(ids=>window.__FRONTLINES__.getState().living.facilities.find(f=>!ids.includes(f.id)&&f.kind==='meal'),before.living.facilities.map(f=>f.id));
  await page.locator('#build-command').click();await page.locator('#trench-command').click();
  const q=before.squads.find(q=>q.kind==='engineer'&&q.faction!=='enemy');
  const draw=async(length)=>{const points=await page.evaluate(({q,length})=>[{x:q.x-85,z:q.z+38},{x:q.x-85+length,z:q.z+38}].map(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.3)),{q,length});if(points.some(p=>!p.visible))throw Error('Draw target outside view');await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:15});await page.mouse.up();};
  const n=await page.evaluate(()=>window.__FRONTLINES__.getState().trenches.length);await draw(5);const shortToast=await page.locator('#toast').innerText();const shortMode=await page.locator('#battlefield').getAttribute('data-mode');await draw(15);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  await page.locator('#build-command').click();const noCrew=await page.locator('.build-workforce').innerText();await page.locator('#assign-builders').click();await page.waitForFunction(()=>document.querySelector('#assign-builders').hidden);
  await page.screenshot({path:`output/playwright/build-reassigned-${suffix}.png`});
  return {scope:'Actual controls, unmodified campaign inventory, no save writes',visibleFromRifle,panelText,preview,facility,shortToast,shortMode,noCrew,errors,checks:{visibleFromRifle,facilityQueued:!!facility,shortExplained:shortToast.includes('too short')&&shortMode==='trench',fifteenMetresAccepted:after.trenches.length===n+1,reassignmentExplained:noCrew.includes('No engineers'),noErrors:errors.length===0}};
}
