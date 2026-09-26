import {test,expect,type Page} from '@playwright/test';
import {buildingsForSeed} from '../../src/terrain/WorldFeatures';
import {preparedPosition} from '../../src/combat/testing/PositionFixture';
import {reconcileSupplyDemands} from '../../src/garrison/SupplyDemand';

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
  await meeting(page);const paused=await page.evaluate(()=>window.__FRONTLINES__.getState()),before=paused.soldiers.length;expect(paused.simSpeed).toBe(0);await page.getByRole('button',{name:'Reinforcements',exact:true}).click();
  // The first real tick may precede the pause click: this mission has no timed
  // preparation and immediately requests building occupation. Display live truth,
  // not the transient blankMission placeholder observed by an unusually fast run.
  await expect(page.locator('.operation-topline')).toContainText('Race for the Hamlet');await expect(page.locator('.operation-topline')).toContainText(paused.operation!.runtime!.mission!.phase.toUpperCase());
  await expect(page.locator('.deployment-status')).toContainText('Finite-force');await expect(page.locator('[data-deploy="rifle"]')).toBeHidden();
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before);
});
test('Support routes players to physical positions rather than abstract mortar formations',async({page})=>{
  await meeting(page);await select(page,'Able');await page.locator('.hud-tools>summary').click();await page.locator('#open-fire-support').click();
  await expect(page.locator('[data-support="mortarHE"]')).toHaveCount(0);await expect(page.locator('.support-status')).toContainText('Choose guns, then one target');
  await page.locator('.support-other>summary').click();
  await expect(page.locator('[data-support="smokeGrenades"]')).toBeVisible();
});
test('machine-gun inspection separates crew readiness from urgent warnings',async({page})=>{
  await meeting(page);await select(page,'Easy');await page.getByRole('button',{name:'Manage',exact:true}).click();await page.getByRole('tab',{name:'Weapons',exact:true}).click();await expect(page.locator('#battle-alerts')).not.toContainText('Setting up');
  await page.locator('[data-speed="1"]').click();await expect(page.locator('#selection-detail')).toContainText('MG position',{timeout:12000});await page.locator('[data-speed="0"]').click();
});

// Synthetic saved-world fixtures isolate readiness, not building navigation.
// They use real generated roof geometry and the normal validated restore path.
async function placeMortar(page:Page,underRoof:boolean,moving=false){
  const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),building=buildingsForSeed(1944)[0];
  const operator=state.soldiers.find(s=>s.equipment?.mortar&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
  const q=state.squads.find(q=>q.id===operator.squadId)!;
  q.x=building.x;q.z=building.z+(underRoof?0:building.depth/2+6);operator.x=q.x;operator.z=q.z;
  const f=preparedPosition(state,q.id,'mortar'),helper=state.soldiers.find(s=>s.squadId!==q.id&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
  for(const other of state.living!.facilities)if(other!==f)other.weaponCrewIds=other.weaponCrewIds?.filter(id=>id!==helper.id);
  f.weaponCrewIds=[operator.id,helper.id];helper.garrisonId=f.garrisonId;helper.personalArea=true;helper.x=f.x+1;helper.z=f.z;helper.suppression=0;helper.action='watching';
  helper.duty={kind:'watch',facilityId:f.id,destination:{x:helper.x,z:helper.z},route:[],routeIndex:0,since:state.elapsed,arrivedAt:state.elapsed,until:state.elapsed+150,blockedFor:0,reason:'Synthetic mixed-formation helper'};
  q.order=moving?{type:'move',issuedAt:state.elapsed,target:{x:q.x+20,z:q.z}}:{type:'hold',issuedAt:state.elapsed};q.route=[];q.routeIndex=0;
  reconcileSupplyDemands(state);await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  return {name:q.name,id:q.id,positionId:f.id,trenchId:f.connectorId!,underRoof,crew:f.weaponCrewIds,point:{x:f.x,z:f.z},target:{x:f.x+75,z:f.z}};
}
async function inspectPit(page:Page,pit:Awaited<ReturnType<typeof placeMortar>>){
  await select(page,pit.name);await page.keyboard.press('f');await page.mouse.move(720,350);await page.mouse.wheel(0,650);
  // Drag on empty battlefield, below/right of the mission HUD. The previous
  // top-left coordinates now hit that panel and never reach command input.
  expect(await page.evaluate(()=>document.elementFromPoint(460,250)?.id)).toBe('battlefield');
  await page.mouse.move(460,250);await page.mouse.down();await page.mouse.move(480,270);await page.mouse.up();await expect(page.locator('#selection-docket')).toBeHidden();
  let last:{x:number;y:number}|undefined;
  await expect.poll(async()=>{const p=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.point),settled=last&&p.visible&&Math.hypot(p.x-last.x,p.y-last.y)<.15;last=p;return Boolean(settled);}).toBe(true);
  if(pit.underRoof){
    // Roofs correctly pick the building. Inspect this intentionally invalid
    // legacy fixture through the ordinary Positions > Weapons list instead.
    if(!await page.locator('.hud-tools').evaluate((el:HTMLDetailsElement)=>el.open))await page.locator('.hud-tools summary').click();
    await page.locator('#trenches-command').click();await page.locator('#trench-choice').selectOption(String(pit.trenchId));
    await page.locator('[data-page="weapons"]').click();await page.locator(`[data-position="${pit.positionId}"]`).click();
  }else{
    const point=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.point);await page.mouse.click(point.x,point.y);
  }
  await expect(page.locator('#trench-panel h2')).toContainText('Mortar pit');
}
test('actual pit inspector rejects roofs and fires a mixed-formation outdoor mortar without a squad selected',async({page},testInfo)=>{
  await meeting(page);const roof=await placeMortar(page,true);await inspectPit(page,roof);
  await expect(page.locator('[data-fire="mortarHE"]')).toBeDisabled();await expect(page.locator('.weapon-blocker')).toContainText('roofs');
  await page.screenshot({path:testInfo.outputPath('position-roof-blocker.png')});
  // Installation physically consumes the carried mortar. Use a fresh scenario
  // for the separate outdoor fixture rather than assuming the kit was copied.
  await meeting(page);const pit=await placeMortar(page,false);await inspectPit(page,pit);
  await expect(page.locator('.crew-slots>div')).toHaveCount(2);await expect(page.locator('#trench-panel')).toContainText('HE /');
  await expect(page.locator('.position-status')).toHaveText('READY');await expect(page.locator('[data-fire="mortarHE"]')).toBeEnabled();await expect(page.locator('[data-fire="mortarSmoke"]')).toBeEnabled();
  await page.screenshot({path:testInfo.outputPath('mixed-crew-pit-ready.png')});
  await page.locator('[data-fire="mortarHE"]').click();await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','mortarHE');await expect(page.locator('#selection-docket')).toBeHidden();
  const target=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.target);await page.mouse.click(target.x,target.y);
  await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1)?.positionId)).toBe(pit.positionId);
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1))).toMatchObject({positionId:pit.positionId,crewIds:pit.crew,kind:'mortarHE',stage:'preparing',source:'PLAYER'});
  await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await expect(page.locator('.menu-status')).toContainText('Session saved.');
  await page.reload();await page.locator('#main-continue').click();
  expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1))).toMatchObject({positionId:pit.positionId,crewIds:pit.crew});
});
test('position reports a moving crew and retains it after a normal Hold',async({page})=>{
  await meeting(page);const pit=await placeMortar(page,false,true);await inspectPit(page,pit);
  await expect(page.locator('[data-fire="mortarHE"]')).toBeDisabled();await expect(page.locator('.weapon-blocker')).toContainText('Crew moving');
  await page.keyboard.press('Escape');await select(page,pit.name);await page.keyboard.press('h');await inspectPit(page,pit);
  await expect(page.locator('[data-fire="mortarHE"]')).toBeEnabled();expect(await page.evaluate(()=>window.__FRONTLINES__.getState().simSpeed)).toBe(0);
});

test('grouped contact symbols stay quiet and allow tactical orders through them',async({page},testInfo)=>{
  await meeting(page);
  // Synthetic observed positions isolate presentation/input. Visibility and
  // memory are exercised separately in the deterministic sight regressions.
  const squadId=await page.evaluate(()=>{
    const state=window.__FRONTLINES__.getState(),q=state.squads.find(q=>q.name==='Able')!;
    const enemies=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy').slice(0,2);
    state.operation!.contacts={player:enemies.map((s,i)=>({soldierId:s.id,squadId:s.squadId,x:q.x+15+i*2,z:q.z+12,lastSeen:state.elapsed,visible:true,active:true})),enemy:[]};
    window.__FRONTLINES__.restoreState(state);return q.id;
  });
  await select(page,'Able');await page.keyboard.press('f');
  await expect(page.locator('.contact-marker')).toHaveCount(1);
  await expect(page.locator('.squad-marker.enemy')).toHaveCount(0);
  const contact=page.locator('.contact-marker');await contact.hover();
  await expect(contact.locator('.marker-tip')).toContainText('Enemy contact area');
  await page.mouse.move(700,700);await expect(contact.locator('.marker-tip')).toBeHidden();
  await page.getByRole('button',{name:'Manage',exact:true}).click();
  await page.getByRole('button',{name:'Suppress',exact:true}).click();
  const point=await contact.evaluate(e=>({x:Number((e as HTMLElement).dataset.x),z:Number((e as HTMLElement).dataset.z)}));
  await contact.click();
  await expect.poll(()=>page.evaluate(id=>window.__FRONTLINES__.getState().squads.find(q=>q.id===id)?.order.intent,squadId)).toBe('suppress');
  expect(await page.evaluate(id=>window.__FRONTLINES__.getState().squads.find(q=>q.id===id)?.order.target,squadId)).toEqual(point);
  await page.evaluate(()=>{
    const state=window.__FRONTLINES__.getState();state.operation!.contacts!.player.forEach(c=>{c.visible=false;c.status='last-reported';});window.__FRONTLINES__.restoreState(state);
  });
  await expect(page.locator('.contact-marker')).toHaveCount(1);
  await expect(page.locator('.contact-marker')).toHaveClass(/last-seen/);
  await expect(page.locator('.contact-marker')).toHaveAttribute('aria-label',/not live tracking/);
  await page.screenshot({path:testInfo.outputPath('grouped-last-report.png')});
});
