# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay-controls.spec.ts >> position reports a moving crew and retains it after a normal Hold
- Location: tests\e2e\gameplay-controls.spec.ts:98:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('[data-mode-choice="meeting"]')
    - waiting for navigation to finish...
    - navigated to "http://127.0.0.1:4173/"

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - generic "3D battlefield" [ref=f1e3]
  - dialog "FRONTLINES menu" [ref=f1e4]:
    - generic [ref=f1e6]:
      - generic [ref=f1e7]:
        - text: FIELD COMMAND
        - heading "FRONTLINES" [level=1] [ref=f1e8]
        - paragraph [ref=f1e9]: Every position has a purpose.Every soldier has a life.
      - navigation "Main menu" [ref=f1e10]:
        - button "Continue →" [disabled] [ref=f1e11]:
          - text: Continue
          - generic [ref=f1e12]: →
        - button "Quick Battle" [active] [ref=f1e13] [cursor=pointer]
        - button "Operations" [ref=f1e14] [cursor=pointer]
        - button "Sandbox" [ref=f1e15] [cursor=pointer]
        - button "Settings" [ref=f1e16] [cursor=pointer]
      - paragraph [ref=f1e17]: A living battlefield under your command
      - paragraph: The Orchard Approach · 64 personnel · LIVE / SOUND MUTED
```

# Test source

```ts
  1   | import {test,expect,type Page} from '@playwright/test';
  2   | import {buildingsForSeed} from '../../src/terrain/WorldFeatures';
  3   | import {preparedPosition} from '../../src/combat/testing/PositionFixture';
  4   | import {reconcileSupplyDemands} from '../../src/garrison/SupplyDemand';
  5   |
  6   | async function meeting(page:Page){
> 7   |   await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="meeting"]').click();await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
      |                                                                                                                           ^ Error: locator.click: Test timeout of 45000ms exceeded.
  8   | }
  9   | async function select(page:Page,name:string,add=false){
  10  |   if(!await page.locator('.hud-tools').evaluate((el:HTMLDetailsElement)=>el.open))await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();
  11  |   await page.locator('.roster-row').filter({hasText:name}).click({modifiers:add?['Shift']:[]});await page.locator('[aria-label="Close forces"]').click();
  12  | }
  13  | test('Add troops is a normal sandbox action with repeatable batch placement',async({page})=>{
  14  |   await page.goto('/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();const before=await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length);
  15  |   await page.getByRole('button',{name:'Add troops',exact:true}).click();await page.getByLabel('Squads per placement',{exact:true}).selectOption('3');await page.locator('[data-deploy="rifle"]').click();
  16  |   await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','deploy');
  17  |   let placed=false;for(const [x,y] of [[740,540],[900,500],[740,390],[600,480]]){
  18  |     await page.mouse.move(x,y);await expect(page.locator('.draft-readout')).toBeVisible();
  19  |     await expect.poll(()=>page.locator('.draft-readout').getAttribute('data-valid')).not.toBeNull();
  20  |     if(await page.locator('.draft-readout').getAttribute('data-valid')==='true'){await page.mouse.click(x,y);placed=true;break;}
  21  |   }
  22  |   expect(placed).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before+24);
  23  |   await page.keyboard.press('Escape');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');await expect(page.locator('#selection-summary')).toContainText('3 squads');
  24  |   await page.locator('#deployment-command').click();await page.locator('.hud-tools summary').click();await page.locator('#open-build').click();await expect(page.locator('#deployment-panel')).toBeHidden();
  25  | });
  26  | test('finite operations explain reserves without offering sandbox spawning',async({page})=>{
  27  |   await meeting(page);const paused=await page.evaluate(()=>window.__FRONTLINES__.getState()),before=paused.soldiers.length;expect(paused.simSpeed).toBe(0);await page.getByRole('button',{name:'Reinforcements',exact:true}).click();
  28  |   // The first real tick may precede the pause click: this mission has no timed
  29  |   // preparation and immediately requests building occupation. Display live truth,
  30  |   // not the transient blankMission placeholder observed by an unusually fast run.
  31  |   await expect(page.locator('.operation-topline')).toContainText('Race for the Hamlet');await expect(page.locator('.operation-topline')).toContainText(paused.operation!.runtime!.mission!.phase.toUpperCase());
  32  |   await expect(page.locator('.deployment-status')).toContainText('Finite-force');await expect(page.locator('[data-deploy="rifle"]')).toBeHidden();
  33  |   await page.keyboard.press('Escape');expect(await page.evaluate(()=>window.__FRONTLINES__.getState().soldiers.length)).toBe(before);
  34  | });
  35  | test('Support routes players to physical positions rather than abstract mortar formations',async({page})=>{
  36  |   await meeting(page);await select(page,'Able');await page.locator('#support-command').click();
  37  |   await expect(page.locator('[data-support="mortarHE"]')).toHaveCount(0);await expect(page.locator('.support-status')).toContainText('Choose guns, then one target');
  38  |   await page.locator('.support-other>summary').click();
  39  |   await expect(page.locator('[data-support="smokeGrenades"]')).toBeVisible();
  40  | });
  41  | test('machine-gun inspection separates crew readiness from urgent warnings',async({page})=>{
  42  |   await meeting(page);await select(page,'Easy');await expect(page.locator('.crew-readiness')).toBeVisible();await expect(page.locator('#battle-alerts')).not.toContainText('Setting up');
  43  |   await page.locator('[data-speed="1"]').click();await expect(page.locator('.crew-readiness')).toContainText('MG position',{timeout:12000});await page.locator('[data-speed="0"]').click();
  44  | });
  45  |
  46  | // Synthetic saved-world fixtures isolate readiness, not building navigation.
  47  | // They use real generated roof geometry and the normal validated restore path.
  48  | async function placeMortar(page:Page,underRoof:boolean,moving=false){
  49  |   const state=await page.evaluate(()=>window.__FRONTLINES__.getState()),building=buildingsForSeed(1944)[0];
  50  |   const operator=state.soldiers.find(s=>s.equipment?.mortar&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
  51  |   const q=state.squads.find(q=>q.id===operator.squadId)!;
  52  |   q.x=building.x;q.z=building.z+(underRoof?0:building.depth/2+6);operator.x=q.x;operator.z=q.z;
  53  |   const f=preparedPosition(state,q.id,'mortar'),helper=state.soldiers.find(s=>s.squadId!==q.id&&state.squads.find(q=>q.id===s.squadId)?.faction==='player')!;
  54  |   for(const other of state.living!.facilities)if(other!==f)other.weaponCrewIds=other.weaponCrewIds?.filter(id=>id!==helper.id);
  55  |   f.weaponCrewIds=[operator.id,helper.id];helper.garrisonId=f.garrisonId;helper.personalArea=true;helper.x=f.x+1;helper.z=f.z;helper.suppression=0;helper.action='watching';
  56  |   helper.duty={kind:'watch',facilityId:f.id,destination:{x:helper.x,z:helper.z},route:[],routeIndex:0,since:state.elapsed,arrivedAt:state.elapsed,until:state.elapsed+150,blockedFor:0,reason:'Synthetic mixed-formation helper'};
  57  |   q.order=moving?{type:'move',issuedAt:state.elapsed,target:{x:q.x+20,z:q.z}}:{type:'hold',issuedAt:state.elapsed};q.route=[];q.routeIndex=0;
  58  |   reconcileSupplyDemands(state);await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  59  |   return {name:q.name,id:q.id,positionId:f.id,trenchId:f.connectorId!,underRoof,crew:f.weaponCrewIds,point:{x:f.x,z:f.z},target:{x:f.x+75,z:f.z}};
  60  | }
  61  | async function inspectPit(page:Page,pit:Awaited<ReturnType<typeof placeMortar>>){
  62  |   await select(page,pit.name);await page.keyboard.press('f');await page.mouse.move(720,350);await page.mouse.wheel(0,650);
  63  |   // Drag on empty battlefield, below/right of the mission HUD. The previous
  64  |   // top-left coordinates now hit that panel and never reach command input.
  65  |   expect(await page.evaluate(()=>document.elementFromPoint(460,250)?.id)).toBe('battlefield');
  66  |   await page.mouse.move(460,250);await page.mouse.down();await page.mouse.move(480,270);await page.mouse.up();await expect(page.locator('#selection-docket')).toBeHidden();
  67  |   let last:{x:number;y:number}|undefined;
  68  |   await expect.poll(async()=>{const p=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.point),settled=last&&p.visible&&Math.hypot(p.x-last.x,p.y-last.y)<.15;last=p;return Boolean(settled);}).toBe(true);
  69  |   if(pit.underRoof){
  70  |     // Roofs correctly pick the building. Inspect this intentionally invalid
  71  |     // legacy fixture through the ordinary Positions > Weapons list instead.
  72  |     if(!await page.locator('.hud-tools').evaluate((el:HTMLDetailsElement)=>el.open))await page.locator('.hud-tools summary').click();
  73  |     await page.locator('#trenches-command').click();await page.locator('#trench-choice').selectOption(String(pit.trenchId));
  74  |     await page.locator('[data-page="weapons"]').click();await page.locator(`[data-position="${pit.positionId}"]`).click();
  75  |   }else{
  76  |     const point=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.point);await page.mouse.click(point.x,point.y);
  77  |   }
  78  |   await expect(page.locator('#trench-panel h2')).toContainText('Mortar pit');
  79  | }
  80  | test('actual pit inspector rejects roofs and fires a mixed-formation outdoor mortar without a squad selected',async({page},testInfo)=>{
  81  |   await meeting(page);const roof=await placeMortar(page,true);await inspectPit(page,roof);
  82  |   await expect(page.locator('[data-fire="mortarHE"]')).toBeDisabled();await expect(page.locator('.weapon-blocker')).toContainText('roofs');
  83  |   await page.screenshot({path:testInfo.outputPath('position-roof-blocker.png')});
  84  |   // Installation physically consumes the carried mortar. Use a fresh scenario
  85  |   // for the separate outdoor fixture rather than assuming the kit was copied.
  86  |   await meeting(page);const pit=await placeMortar(page,false);await inspectPit(page,pit);
  87  |   await expect(page.locator('.crew-slots>div')).toHaveCount(2);await expect(page.locator('#trench-panel')).toContainText('HE /');
  88  |   await expect(page.locator('.position-status')).toHaveText('READY');await expect(page.locator('[data-fire="mortarHE"]')).toBeEnabled();await expect(page.locator('[data-fire="mortarSmoke"]')).toBeEnabled();
  89  |   await page.screenshot({path:testInfo.outputPath('mixed-crew-pit-ready.png')});
  90  |   await page.locator('[data-fire="mortarHE"]').click();await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','mortarHE');await expect(page.locator('#selection-docket')).toBeHidden();
  91  |   const target=await page.evaluate(p=>window.__FRONTLINES__.projectWorld(p.x,p.z,.1),pit.target);await page.mouse.click(target.x,target.y);
  92  |   await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1)?.positionId)).toBe(pit.positionId);
  93  |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1))).toMatchObject({positionId:pit.positionId,crewIds:pit.crew,kind:'mortarHE',stage:'preparing',source:'PLAYER'});
  94  |   await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();await expect(page.locator('.menu-status')).toContainText('Session saved.');
  95  |   await page.reload();await page.locator('#main-continue').click();
  96  |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.supportMissions?.at(-1))).toMatchObject({positionId:pit.positionId,crewIds:pit.crew});
  97  | });
  98  | test('position reports a moving crew and retains it after a normal Hold',async({page})=>{
  99  |   await meeting(page);const pit=await placeMortar(page,false,true);await inspectPit(page,pit);
  100 |   await expect(page.locator('[data-fire="mortarHE"]')).toBeDisabled();await expect(page.locator('.weapon-blocker')).toContainText('Crew moving');
  101 |   await page.keyboard.press('Escape');await select(page,pit.name);await page.keyboard.press('h');await inspectPit(page,pit);
  102 |   await expect(page.locator('[data-fire="mortarHE"]')).toBeEnabled();expect(await page.evaluate(()=>window.__FRONTLINES__.getState().simSpeed)).toBe(0);
  103 | });
  104 |
  105 | test('grouped contact symbols stay quiet and allow tactical orders through them',async({page},testInfo)=>{
  106 |   await meeting(page);
  107 |   // Synthetic observed positions isolate presentation/input. Visibility and
```
