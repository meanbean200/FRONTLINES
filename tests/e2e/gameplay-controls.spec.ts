import {test,expect,type Page} from '@playwright/test';
import {buildingsForSeed} from '../../src/terrain/WorldFeatures';

async function meeting(page:Page){
  await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="meeting"]').click();await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
}
async function select(page:Page,name:string,add=false){
  if(!await page.locator('.hud-tools').evaluate((el:HTMLDetailsElement)=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();
  await page.locator('.roster-row').filter({hasText:name}).click({modifiers:add?['Shift']:[]});await page.locator('[aria-label="Close forces"]').click();
}
test('Add troops is a normal sandbox action with repeatable batch placement',async({page})=>{
  await page.goto('/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();const before=await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length);
  await page.getByRole('button',{name:'Add troops',exact:true}).click();await page.getByLabel('Squads per placement',{exact:true}).selectOption('3');await page.locator('[data-deploy="rifle"]').click();
  await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','deploy');
  let placed=false;for(const [x,y] of [[740,540],[900,500],[740,390],[600,480]]){
    await page.mouse.move(x,y);await expect(page.locator('.draft-readout')).toBeVisible();
    await expect.poll(()=>page.locator('.draft-readout').getAttribute('data-valid')).not.toBeNull();
    if(await page.locator('.draft-readout').getAttribute('data-valid')==='true'){await page.mouse.click(x,y);placed=true;break;}
  }
  expect(placed).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before+24);
  await page.keyboard.press('Escape');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');await expect(page.locator('#selection-summary')).toContainText('3 squads');
  await page.locator('#deployment-command').click();await page.locator('.hud-tools summary').click();await page.locator('#open-build').click();await expect(page.locator('#deployment-panel')).toBeHidden();
});
test('finite operations explain reserves without offering sandbox spawning',async({page})=>{
  await meeting(page);const before=await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length);await page.getByRole('button',{name:'Reserves',exact:true}).click();
  await expect(page.locator('.operation-topline')).toContainText('Meeting Engagement');await expect(page.locator('.operation-topline')).toContainText('NO TIME LIMIT');
  await expect(page.locator('.deployment-status')).toContainText('finite-force');await expect(page.locator('[data-deploy="rifle"]')).toBeHidden();
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before);
});
test('support identifies an eligible team within a mixed selection',async({page})=>{
  await meeting(page);await select(page,'Able');await page.locator('#support-command').click();await expect(page.locator('[data-support="mortarHE"]')).toBeDisabled();await expect(page.locator('.support-status')).toContainText('mortar equipment');
  await select(page,'Fox',true);await expect(page.locator('[data-support="mortarHE"]')).toBeEnabled();await expect(page.locator('[data-support="mortarHE"]')).toContainText('12');
});
test('machine-gun inspection separates crew readiness from urgent warnings',async({page})=>{
  await meeting(page);await select(page,'Easy');await expect(page.locator('.crew-readiness')).toBeVisible();await expect(page.locator('#battle-alerts')).not.toContainText('Setting up');
  await page.locator('[data-speed="1"]').click();await expect(page.locator('.crew-readiness')).toContainText('watching sector',{timeout:12000});await page.locator('[data-speed="0"]').click();
});

// Synthetic saved-world fixtures isolate readiness, not building navigation.
// They use real generated roof geometry and the normal validated restore path.
async function placeMortar(page:Page,underRoof:boolean,moving=false){
  const building=buildingsForSeed(1944)[0];
  return page.evaluate(({building,underRoof,moving})=>{
    const state=window.__FRONTLINES__.getState(),operator=state.soldiers.find(s=>s.equipment?.mortar&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
    const q=state.squads.find(q=>q.id===operator.squadId)!,crew=state.soldiers.filter(s=>s.squadId===q.id);
    q.x=building.x;q.z=building.z+(underRoof?0:building.depth/2+6);
    q.order=moving?{type:'move',issuedAt:state.elapsed,target:{x:q.x+20,z:q.z}}:{type:'hold',issuedAt:state.elapsed};
    q.route=[];q.routeIndex=0;
    crew.forEach((s,i)=>{s.x=q.x+(i%4)*.3;s.z=q.z+Math.floor(i/4)*.3;s.action='holding';s.suppression=0;delete s.building;delete s.duty;delete s.garrisonId;});
    window.__FRONTLINES__.restoreState(state);
    return {name:q.name,id:q.id,target:{x:q.x+70,z:q.z}};
  },{building,underRoof,moving});
}

test('mortar buttons and status reject roofs, then permit a real outdoor mission',async({page},testInfo)=>{
  await meeting(page);const roof=await placeMortar(page,true);await select(page,roof.name);
  await page.locator('#support-command').click();
  for(const kind of ['mortarHE','mortarSmoke']){
    await expect(page.locator(`[data-support="${kind}"]`)).toBeDisabled();
    await expect(page.locator(`[data-support="${kind}"]`)).toHaveAttribute('title',/open-air.*roofs/);
  }
  await expect(page.locator('.support-status')).toContainText('open-air');
  await expect(page.locator('.support-readiness')).toContainText('roofs');
  await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');
  await page.screenshot({path:testInfo.outputPath('mortar-under-roof.png')});
  const outside=await placeMortar(page,false);await select(page,outside.name);await page.keyboard.press('f');
  await page.mouse.move(720,350);await page.mouse.wheel(0,650);
  await page.locator('#support-command').click();
  await expect(page.locator('[data-support="mortarHE"]')).toBeEnabled();
  await expect(page.locator('[data-support="mortarSmoke"]')).toBeEnabled();
  await expect(page.locator('.support-status')).not.toContainText('roofs');
  await page.screenshot({path:testInfo.outputPath('mortar-outdoors.png')});
  await page.locator('[data-support="mortarHE"]').click();
  await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','mortarHE');
  await expect.poll(()=>page.evaluate(target=>{const p=window.__FRONTLINES__.projectWorld(target.x,target.z,.1);return p.visible&&p.x>200&&p.x<innerWidth-100&&p.y>180&&p.y<innerHeight-200;},outside.target)).toBe(true);
  const target=await page.evaluate(target=>window.__FRONTLINES__.projectWorld(target.x,target.z,.1),outside.target);
  await page.mouse.click(target.x,target.y);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportRequests?.at(-1)?.accepted)).toBe(true);
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1))).toMatchObject({squadId:outside.id,kind:'mortarHE',stage:'preparing',source:'PLAYER'});
});

test('paused Hold updates support status as well as button readiness',async({page})=>{
  await meeting(page);const outside=await placeMortar(page,false,true);await select(page,outside.name);
  await page.locator('#support-command').click();await expect(page.locator('.support-status')).toContainText('Team moving');
  await expect(page.locator('[data-support="mortarHE"]')).toBeDisabled();
  await page.keyboard.press('h');
  await expect(page.locator('[data-support="mortarHE"]')).toBeEnabled();
  await expect(page.locator('.support-status')).not.toContainText('Team moving');
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().simSpeed)).toBe(0);
});
