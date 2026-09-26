# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay-controls.spec.ts >> grouped contact symbols stay quiet and allow tactical orders through them
- Location: tests\e2e\gameplay-controls.spec.ts:105:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Suppress', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "3D battlefield" [ref=e3]
  - generic:
    - banner:
      - strong: FRONTLINES
    - navigation:
      - generic: D1 08:00
      - generic "Simulation speed":
        - button "Ⅱ" [ref=e4] [cursor=pointer]
        - button "1×" [ref=e5] [cursor=pointer]
        - button "2×" [ref=e6] [cursor=pointer]
        - button "5×" [ref=e7] [cursor=pointer]
    - navigation:
      - button "Reinforcements" [ref=e8] [cursor=pointer]
      - button "Map" [ref=e11] [cursor=pointer]
      - group [ref=e14]:
        - generic "Command" [ref=e15] [cursor=pointer]
    - region "Formation management" [ref=e16]:
      - button "Close unit details" [ref=e17] [cursor=pointer]: ×
      - generic [ref=e18]:
        - text: FORMATION
        - heading "Able" [level=2] [ref=e19]
      - generic [ref=e20]:
        - button "Defend" [ref=e21] [cursor=pointer]
        - button "Assault" [ref=e24] [cursor=pointer]
        - button "Build" [ref=e27] [cursor=pointer]
      - tablist "Formation details" [ref=e30]:
        - tab "Overview" [selected] [ref=e31] [cursor=pointer]
        - tab "People" [ref=e32] [cursor=pointer]
        - tab "Weapons" [ref=e33] [cursor=pointer]
        - tab "Supply" [ref=e34] [cursor=pointer]
      - tabpanel [ref=e35]:
        - paragraph [ref=e36]: Holding position
        - generic [ref=e37]:
          - term [ref=e38]: Ready
          - definition [ref=e39]: 8 / 8
          - term [ref=e40]: Activity
          - definition [ref=e41]: holding
          - term [ref=e42]: Cover
          - definition [ref=e43]: 0 / 8 sheltered
          - term [ref=e44]: Position
          - definition [ref=e45]: 714 E / 993 S
      - button "Focus selected [F]" [ref=e46] [cursor=pointer]
    - generic "Camera compass":
      - generic:
        - generic: "N"
        - generic: E
        - generic: S
        - generic: W
      - status: 000°
    - region "Operation objectives" [ref=e49]:
      - generic [ref=e50]:
        - generic [ref=e51]: Race for the Hamlet
        - generic [ref=e52]: BUILDING
      - button [ref=e53] [cursor=pointer]:
        - strong [ref=e54]: SEIZE THE TWO ROAD HOUSES · DENY THE JUNCTION
      - paragraph [ref=e55]: ○ House A · ○ House B · ✓ Road
      - group [ref=e56]:
        - generic "Mission details" [ref=e57] [cursor=pointer]
    - button "Menu" [ref=e58] [cursor=pointer]
  - generic:
    - button "Select Able" [ref=e59] [cursor=pointer]:
      - generic [ref=e63]: "01"
    - button "Select Baker" [ref=e64] [cursor=pointer]:
      - generic [ref=e68]: "02"
    - button "Select Easy" [ref=e69] [cursor=pointer]:
      - generic [ref=e73]: "05"
    - button "Select Fox" [ref=e74] [cursor=pointer]:
      - generic [ref=e78]: "06"
    - generic: FRIENDLY REAR
    - img "Enemy contact area · Troops observed here · nearby sightings grouped Reported 0 seconds ago" [ref=e79]
```

# Test source

```ts
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
  36  |   await meeting(page);await select(page,'Able');await page.locator('.hud-tools>summary').click();await page.locator('#open-fire-support').click();
  37  |   await expect(page.locator('[data-support="mortarHE"]')).toHaveCount(0);await expect(page.locator('.support-status')).toContainText('Choose guns, then one target');
  38  |   await page.locator('.support-other>summary').click();
  39  |   await expect(page.locator('[data-support="smokeGrenades"]')).toBeVisible();
  40  | });
  41  | test('machine-gun inspection separates crew readiness from urgent warnings',async({page})=>{
  42  |   await meeting(page);await select(page,'Easy');await page.getByRole('button',{name:'Manage',exact:true}).click();await page.getByRole('tab',{name:'Weapons',exact:true}).click();await expect(page.locator('#battle-alerts')).not.toContainText('Setting up');
  43  |   await page.locator('[data-speed="1"]').click();await expect(page.locator('#selection-detail')).toContainText('MG position',{timeout:12000});await page.locator('[data-speed="0"]').click();
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
  108 |   // memory are exercised separately in the deterministic sight regressions.
  109 |   const squadId=await page.evaluate(()=>{
  110 |     const state=window.__FRONTLINES__.getState(),q=state.squads.find(q=>q.name==='Able')!;
  111 |     const enemies=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='enemy').slice(0,2);
  112 |     state.operation!.contacts={player:enemies.map((s,i)=>({soldierId:s.id,squadId:s.squadId,x:q.x+15+i*2,z:q.z+12,lastSeen:state.elapsed,visible:true,active:true})),enemy:[]};
  113 |     window.__FRONTLINES__.restoreState(state);return q.id;
  114 |   });
  115 |   await select(page,'Able');await page.keyboard.press('f');
  116 |   await expect(page.locator('.contact-marker')).toHaveCount(1);
  117 |   await expect(page.locator('.squad-marker.enemy')).toHaveCount(0);
  118 |   const contact=page.locator('.contact-marker');await contact.hover();
  119 |   await expect(contact.locator('.marker-tip')).toContainText('Enemy contact area');
  120 |   await page.mouse.move(700,700);await expect(contact.locator('.marker-tip')).toBeHidden();
  121 |   await page.getByRole('button',{name:'Manage',exact:true}).click();
> 122 |   await page.getByRole('button',{name:'Suppress',exact:true}).click();
      |                                                               ^ Error: locator.click: Test timeout of 45000ms exceeded.
  123 |   const point=await contact.evaluate(e=>({x:Number((e as HTMLElement).dataset.x),z:Number((e as HTMLElement).dataset.z)}));
  124 |   await contact.click();
  125 |   await expect.poll(()=>page.evaluate(id=>window.__FRONTLINES__.getState().squads.find(q=>q.id===id)?.order.intent,squadId)).toBe('suppress');
  126 |   expect(await page.evaluate(id=>window.__FRONTLINES__.getState().squads.find(q=>q.id===id)?.order.target,squadId)).toEqual(point);
  127 |   await page.evaluate(()=>{
  128 |     const state=window.__FRONTLINES__.getState();state.operation!.contacts!.player.forEach(c=>{c.visible=false;c.status='last-reported';});window.__FRONTLINES__.restoreState(state);
  129 |   });
  130 |   await expect(page.locator('.contact-marker')).toHaveCount(1);
  131 |   await expect(page.locator('.contact-marker')).toHaveClass(/last-seen/);
  132 |   await expect(page.locator('.contact-marker')).toHaveAttribute('aria-label',/not live tracking/);
  133 |   await page.screenshot({path:testInfo.outputPath('grouped-last-report.png')});
  134 | });
  135 |
```
