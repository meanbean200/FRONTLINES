// Ordinary player inputs only; developer APIs below are read-only projections/state.
export async function select(page,name){
  if(!await page.locator('.hud-tools').evaluate(e=>e.open))await page.locator('.hud-tools summary').click();
  await page.locator('#roster-toggle').click();await page.locator('.roster-row').filter({hasText:name}).click();await page.locator('[aria-label="Close forces"]').click();
}
export async function ground(page,x,z){return page.evaluate(([x,z])=>window.__FRONTLINES__.projectWorld(x,z,.1),[x,z]);}
export async function settle(page){let previous;for(let i=0;i<40;i++){const now=await page.evaluate(()=>window.__FRONTLINES__.getVisualStats());if(previous&&Math.hypot(now.cameraTarget.x-previous.cameraTarget.x,now.cameraTarget.z-previous.cameraTarget.z,now.zoomDistance-previous.zoomDistance)<.002)return;previous=now;await page.waitForTimeout(80);}throw Error('Camera did not settle');}
export async function save(page){await page.getByRole('button',{name:'Menu',exact:true}).click();await page.locator('#save-session').click();const text=await page.locator('.operation-menu').innerText();if(!text.includes('Session saved.'))throw Error('Save not confirmed: '+text);}
export async function planEight(page){
  await select(page,'Able');await page.keyboard.press('f');await settle(page);
  for(const [x,z] of [[720,-535],[700,-536],[740,-535]]){
    await page.locator('#build-command').click();await page.locator('#trench-command').click();const a=await ground(page,x,z),b=await ground(page,x,z-26);
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
  }
  for(const [kind,x,z] of [['emplacement',752,-536.65],['emplacement',731,-534.25],['mortar',751,-549],['store',693,-550],['rest',675,-550]]){
    await page.locator('#build-command').click();await page.locator(`[data-build-category="${['emplacement','mortar'].includes(kind)?'weapons':'support'}"]`).click();
    const g=await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();return s.living.garrisons.find(g=>g.squadIds.includes(s.squads.find(q=>q.name==='Dog').id)).id;});await page.locator('#build-network').selectOption(String(g));await page.locator(`[data-build-kind="${kind}"]`).click();
    const p=await ground(page,x,z);await page.mouse.move(p.x,p.y);if(await page.locator('.draft-readout').getAttribute('data-valid')==='false')throw Error(await page.locator('.draft-readout').innerText());await page.mouse.click(p.x,p.y);
    if(kind==='emplacement'){const facing=await ground(page,x,z+15);await page.mouse.move(facing.x,facing.y);await page.mouse.click(facing.x,facing.y);}
    await page.keyboard.press('Escape');
  }
  const s=await page.evaluate(()=>window.__FRONTLINES__.getState());if(s.trenches.filter(t=>t.engineerSquadId).length!==3||s.living.facilities.filter(f=>f.workOrder?.explicit).length!==5)throw Error('Eight work items not placed');
}
