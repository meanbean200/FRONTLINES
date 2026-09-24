async(page)=>{
  await page.reload();await page.bringToFront();
  await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();
  const saved=await page.evaluate(()=>localStorage.getItem('frontlines-battlefield-v2'));
  const previous=(await (await page.request.get('http://127.0.0.1:4173/output/playwright/combat-alarm-r1.json')).json()).evidence;
  // Retained pre-pack-tag snapshot exercises the legacy dropped-pack rendering path.
  await page.evaluate(state=>{window.__FRONTLINES__.restoreState(state);window.__FRONTLINES__.focus(-1930,-1990,65);},previous.after.state);
  await page.waitForTimeout(1200);
  await page.screenshot({path:'output/playwright/combat-casualty-packs-r3.png'});
  const state=previous.alarm.state;state.simSpeed=0;
  for(const s of state.soldiers)s.nextShotAt=10000;
  await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  await page.waitForTimeout(1000);
  const visible=await page.locator('.squad-marker.enemy').filter({hasText:'07'}).evaluate(e=>({transform:e.style.transform,text:e.textContent,display:e.style.display}));
  const positions=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.contacts.player.filter(c=>c.squadId===305).map(c=>({id:c.soldierId,x:c.x,z:c.z})));
  await page.evaluate(()=>{
    const s=window.__FRONTLINES__.getState();
    for(const p of s.soldiers)if(p.squadId===305){p.x+=600;p.z+=600;}
    window.__FRONTLINES__.restoreState(s);
  });
  await page.getByRole('button',{name:'1×',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.squad-marker.enemy.last-seen')?.textContent.includes('LAST SEEN'));
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();await page.waitForTimeout(300);
  const hidden=await page.locator('.squad-marker.enemy.last-seen').evaluate(e=>({transform:e.style.transform,text:e.textContent,display:e.style.display}));
  const remembered=await page.evaluate(()=>window.__FRONTLINES__.getState().operation.contacts.player.filter(c=>c.squadId===305).map(c=>({id:c.soldierId,x:c.x,z:c.z})));
  if(JSON.stringify(positions)!==JSON.stringify(remembered))throw Error('Lost contact followed hidden live position');
  await page.screenshot({path:'output/playwright/combat-last-known-r1.png'});
  await page.getByRole('button',{name:'5×',exact:true}).click();
  await page.waitForFunction(()=>!window.__FRONTLINES__.getState().operation.contacts.player.some(c=>c.squadId===305),{}, {timeout:6000});
  await page.getByRole('button',{name:'Ⅱ',exact:true}).click();
  await page.setViewportSize({width:920,height:768});
  await page.locator('.garrison-panel').evaluate(e=>e.open=true);
  await page.waitForTimeout(600);
  const layout=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
    return {hud:rect('.operation-hud'),trench:rect('.garrison-panel'),width:innerWidth};
  });
  if(layout.hud.right>layout.trench.x)throw Error('Objective HUD overlaps trench command');
  await page.screenshot({path:'output/playwright/combat-small-layout-r2.png'});
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await page.waitForTimeout(500);
  const final=await page.evaluate(()=>({state:window.__FRONTLINES__.getState(),saved:localStorage.getItem('frontlines-battlefield-v2')}));
  if(final.saved!==saved||JSON.stringify(final.state)!==saved)throw Error('Final saved campaign changed');
  return {scope:'Synthetic loss-of-sight probe and legacy casualty-pack render; real UI load/speed controls',checks:{lastKnownStationary:true,contactExpired:true,layoutNoOverlap:true,saveExact:true},visible,hidden,positions,remembered,layout};
}
