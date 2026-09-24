async(page)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('[data-speed="0"]').click();const before=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const legacy=await page.evaluate(()=>['frontlines-battlefield-v1','frontlines-battlefield-v2'].map(k=>localStorage.getItem(k)));
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Load saved campaign',exact:true}).click();await page.waitForFunction(()=>window.__FRONTLINES__.getPerf().drawCalls>20);await page.waitForTimeout(2000);
  const after=await page.evaluate(()=>window.__FRONTLINES__.getState());
  const continuation={sameElapsed:before.elapsed===after.elapsed,samePeople:JSON.stringify(before.soldiers)===JSON.stringify(after.soldiers),sameInventories:JSON.stringify(before.living)===JSON.stringify(after.living),legacyPreserved:JSON.stringify(legacy)===JSON.stringify(await page.evaluate(()=>['frontlines-battlefield-v1','frontlines-battlefield-v2'].map(k=>localStorage.getItem(k))))};
  await page.locator('.roster-row').filter({hasText:'Able'}).dblclick();const sizes=[];
  for(const [width,height] of [[640,480],[390,700],[1280,800]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(1500);if(width<1000){const toggle=page.getByRole('button',{name:'Selected squad details',exact:true});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}await page.waitForTimeout(250);
    const bounds=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,commands:[...document.querySelectorAll('.command-dock button')].map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));
    await page.screenshot({path:`output/playwright/combat-v3-layout-r4-${width}x${height}.png`});sizes.push(bounds);
  }
  await page.locator('#battlefield').click({position:{x:700,y:600}});await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
  const alignment=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return [...document.querySelectorAll('.squad-marker:not(.enemy)')].filter(m=>getComputedStyle(m).display!=='none').map(m=>{const name=m.getAttribute('aria-label').replace('Select ','');const q=s.squads.find(q=>q.name===name),p=window.__FRONTLINES__.projectWorld(q.x,q.z,3),r=m.getBoundingClientRect();return {name,errorX:Math.abs(r.x+r.width/2-p.x),errorY:Math.abs(r.bottom-(p.y-18)),opacity:getComputedStyle(m).opacity};});});
  await page.screenshot({path:'output/playwright/combat-v3-labels-after-pan-r4.png'});
  return {scope:'Actual Edge Save, reload, Load saved campaign, responsive drawers and camera pan',continuation,sizes,alignment,errors,checks:{continuation:Object.values(continuation).every(Boolean),aligned:alignment.every(p=>p.errorX<1&&p.errorY<1),noHorizontalOverflow:sizes.every(s=>s.scrollWidth===s.width),commandsOnscreen:sizes.every(s=>s.commands.every(b=>b.x>=0&&b.y>=0&&b.right<=s.width&&b.bottom<=s.height)),noPageErrors:!errors.length}};
}
