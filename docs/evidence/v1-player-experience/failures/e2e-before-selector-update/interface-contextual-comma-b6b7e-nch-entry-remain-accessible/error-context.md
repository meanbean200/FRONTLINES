# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: interface.spec.ts >> contextual commands, drawer escape and direct trench entry remain accessible
- Location: tests\e2e\interface.spec.ts:31:1

# Error details

```
Error: locator.click: Error: strict mode violation: locator('.support-controls summary') resolved to 3 elements:
    1) <summary>Fire support</summary> aka locator('summary').filter({ hasText: 'Fire support' })
    2) <summary>Recent missions</summary> aka getByText('Recent missions')
    3) <summary>Casualties, reserves & hand smoke</summary> aka getByText('Casualties, reserves & hand')

Call log:
  - waiting for locator('.support-controls summary')

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
    - region "Selected formation" [ref=e16]:
      - generic [ref=e17]: FORMATION SELECTED
      - generic [ref=e18]:
        - generic [ref=e19]:
          - strong [ref=e22]: Able
          - generic [ref=e23]: 8/8
        - paragraph [ref=e24]: Rifle squad · Holding
        - generic [ref=e25]:
          - generic [ref=e26]:
            - text: Ammo
            - generic [ref=e27]: Good
          - generic [ref=e28]:
            - text: Suppression
            - generic [ref=e29]: Low
        - paragraph [ref=e30]: Awaiting weapon setup
      - generic [ref=e31]:
        - button "Details" [ref=e32] [cursor=pointer]
        - button "Options" [ref=e33] [cursor=pointer]
    - navigation "Squad commands" [ref=e34]:
      - generic [ref=e35]:
        - button "Move" [ref=e36] [cursor=pointer]
        - button "Hold" [ref=e39] [cursor=pointer]
        - button "Support" [active] [ref=e42] [cursor=pointer]
        - button "Build" [ref=e45] [cursor=pointer]
    - generic: Select a formation to issue orders. M opens the operational map.
    - group [ref=e48]:
      - generic "Fire support" [ref=e49] [cursor=pointer]
      - paragraph [ref=e50]: Select individual guns, a battery, or all ready weapons. Issue one target below.
      - generic [ref=e51]:
        - generic [ref=e52]:
          - button "All ready" [ref=e53] [cursor=pointer]
          - button "Clear" [ref=e54] [cursor=pointer]
        - paragraph [ref=e56]: No indirect weapons built. Build a field gun or battery, then assign its crew.
        - button "Staff selected weapons" [disabled] [ref=e57]
        - generic [ref=e58]:
          - generic [ref=e59]:
            - text: Ammunition
            - combobox "Ammunition" [ref=e60]:
              - option "High explosive" [selected]
              - option "Smoke"
          - button "Choose target · 0 ready" [disabled] [ref=e61]
        - paragraph [ref=e62]: Choose guns, then one target. Each ready weapon uses its own ammunition.
        - button "Build weapon positions →" [ref=e63] [cursor=pointer]
        - group [ref=e64]:
          - generic "Recent missions" [ref=e65] [cursor=pointer]
      - group [ref=e66]:
        - generic "Casualties, reserves & hand smoke" [ref=e67] [cursor=pointer]
    - region "Operation objectives" [ref=e68]:
      - generic [ref=e69]:
        - generic [ref=e70]: Hold the Supply Road
        - generic [ref=e71]: 180 s PREP
      - button [ref=e72] [cursor=pointer]:
        - strong [ref=e73]: PREPARE YOUR LINE · PROTECT THE ROAD · BREAK THE ASSAULT
      - paragraph [ref=e74]: Inspect the marked road house and plan your positions.
      - group [ref=e75]:
        - generic "Mission details" [ref=e76] [cursor=pointer]
    - button "Menu" [ref=e77] [cursor=pointer]
  - generic:
    - generic: BEAUMONT
    - button "Select Able" [ref=e78] [cursor=pointer]:
      - generic [ref=e82]: "01"
    - button "Select Baker" [ref=e83] [cursor=pointer]:
      - generic [ref=e87]: "02"
    - button "Select Charlie" [ref=e88] [cursor=pointer]:
      - generic [ref=e92]: "03"
    - button "Select Dog" [ref=e93] [cursor=pointer]:
      - generic [ref=e97]: "04"
    - button "Select Easy" [ref=e98] [cursor=pointer]:
      - generic [ref=e102]: "05"
    - button "Select Fox" [ref=e103] [cursor=pointer]:
      - generic [ref=e107]: "06"
    - button "Inspect Network 251" [ref=e108] [cursor=pointer]: Network 251
    - generic: BEAUMONT / ROAD HOUSE
    - generic: FRIENDLY REAR
  - generic "Camera compass":
    - generic:
      - generic: "N"
      - generic: E
      - generic: S
      - generic: W
    - status: 342°
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | 
  3  | const quick=async(page:Page)=>{
  4  |   await page.goto('/');await page.getByRole('button',{name:'Quick Battle',exact:true}).click();
  5  |   await page.locator('[data-mode-choice="line-defense"]').click();
  6  |   await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  7  | };
  8  | const begin=async(page:Page)=>{
  9  |   await quick(page);await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
  10 |   await page.locator('[data-speed="0"]').click();
  11 | };
  12 | test('main menu separates setup, settings and operations',async({page})=>{
  13 |   await page.goto('/');await expect(page.getByRole('heading',{name:'FRONTLINES',exact:true})).toBeVisible();
  14 |   await expect(page.locator('#quick-battle-form')).toHaveCount(0);
  15 |   await page.locator('#operations-menu').click();await expect(page.locator('[data-operation]')).toHaveCount(4);
  16 |   await page.locator('[data-operation="meeting"]').click();await expect(page.locator('[data-mode-choice="meeting"]')).toHaveAttribute('aria-pressed','true');
  17 |   await page.locator('#menu-back').click();await page.locator('[data-settings]').click();
  18 |   await page.locator('[data-setting-tab="controls"]').click();await expect(page.locator('.controls-list')).toContainText('M (G also works)');
  19 | });
  20 | test('briefing previews the generated world, then rolls back without a save write',async({page})=>{
  21 |   await quick(page);
  22 |   const before=await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState()));
  23 |   const storage=await page.evaluate(()=>JSON.stringify(localStorage));
  24 |   await page.locator('#launch-operation').click();
  25 |   await expect(page.locator('.operation-menu')).toHaveAttribute('data-screen','briefing');
  26 |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.mode)).toBe('line-defense');
  27 |   await page.locator('#back-to-setup').click();
  28 |   expect(await page.evaluate(()=>JSON.stringify(window.__FRONTLINES__.getState()))).toBe(before);
  29 |   expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(storage);
  30 | });
  31 | test('contextual commands, drawer escape and direct trench entry remain accessible',async({page})=>{
  32 |   await begin(page);await expect(page.locator('#selection-docket')).toBeHidden();await expect(page.locator('.command-dock')).toBeHidden();
  33 |   await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
  34 |   await page.locator('.roster-row').first().click();await page.locator('[aria-label="Close forces"]').click();
  35 |   await expect(page.locator('.command-dock')).toBeVisible();await expect(page.locator('.command-dock button')).toHaveCount(4);await expect(page.locator('#hold-command')).toBeVisible();
  36 |   await expect(page.locator('[data-tactical="assault"]')).toBeHidden();await page.locator('#selection-orders').click();
  37 |   await expect(page.locator('[data-tactical="assault"]')).toBeVisible();await expect(page.locator('.advanced-orders')).toContainText('Move and Hold already');
> 38 |   await page.keyboard.press('Escape');await page.locator('#support-command').click();await expect(page.locator('.support-status')).toContainText('Choose guns, then one target');await page.locator('.support-controls summary').click();
     |                                                                                                                                                                                                                                  ^ Error: locator.click: Error: strict mode violation: locator('.support-controls summary') resolved to 3 elements:
  39 |   await page.locator('#selection-docket [data-hud-panel]').click();await expect(page.locator('#selection-card')).toBeVisible();
  40 |   await page.keyboard.press('Escape');await expect(page.locator('#selection-card')).toBeHidden();await expect(page.locator('.operation-menu')).toBeHidden();
  41 |   await page.locator('#build-command').click();await page.locator('#trench-command').click();
  42 |   await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','trench');await expect(page.locator('#build-panel')).toBeHidden();
  43 |   await page.keyboard.press('Escape');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','select');
  44 |   await page.keyboard.press('m');await expect(page.locator('.field-map')).toBeVisible();await page.keyboard.press('m');await expect(page.locator('.field-map')).toBeHidden();
  45 |   await page.keyboard.press('v');await expect(page.locator('#battlefield')).toHaveAttribute('data-mode','move');
  46 | });
  47 | test('pause save/load keeps exact campaign state and manual pause',async({page})=>{
  48 |   await begin(page);await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  49 |   // Compare with the canonical save, which adds the policy/rules identity even
  50 |   // before the first simulation tick. Saving does not mutate the live world.
  51 |   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('frontlines-battlefield-v3-world2-4km')!));
  52 |   await page.locator('#continue-save').click();
  53 |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState())).toEqual(saved);
  54 |   await expect(page.locator('[data-speed="0"]')).toHaveClass('active');
  55 | });
  56 | test('a supply decision cannot be obscured by the Position inspector',async({page})=>{
  57 |   await page.goto('/');await page.locator('#sandbox-session').click();await page.locator('[data-speed="0"]').click();
  58 |   await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();await expect(page.locator('#trench-panel')).toBeVisible();
  59 |   await page.evaluate(()=>{const s=window.__FRONTLINES__.getState();s.living!.garrisons[0].cutoff='decision';window.__FRONTLINES__.restoreState(s);});
  60 |   await expect(page.locator('#trench-panel')).toBeHidden();await expect(page.getByRole('button',{name:'Hold & ration',exact:true})).toBeVisible();
  61 |   await page.getByRole('button',{name:'Hold & ration',exact:true}).click();
  62 |   await expect(page.locator('.garrison-panel')).toBeHidden();
  63 |   if(!await page.locator('#trenches-command').isVisible())await page.locator('.hud-tools>summary').click();
  64 |   await page.locator('#trenches-command').click();await expect(page.locator('#trench-panel')).toBeVisible();
  65 | });
  66 | for(const [width,height] of [[1920,1080],[2560,1440],[1654,910],[1366,768],[1280,720],[1024,768],[2560,1080],[1280,540]]){
  67 |   test('full canvas and usable menus at '+width+'×'+height,async({page})=>{
  68 |     await page.setViewportSize({width,height});await quick(page);
  69 |     expect(await page.locator('#battlefield').evaluate(el=>({width:el.clientWidth,height:el.clientHeight}))).toEqual({width,height});
  70 |     expect(await page.locator('.operation-menu').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  71 |     await page.locator('#launch-operation').click();await page.locator('#begin-operation').scrollIntoViewIfNeeded();await expect(page.locator('#begin-operation')).toBeVisible();
  72 |     await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
  73 |     await page.locator('.hud-tools>summary').click();await page.locator('#open-build').click();
  74 |     await expect(page.locator('#trench-command')).toBeInViewport();
  75 |     await page.locator('[data-build-category="weapons"]').click();
  76 |     await page.locator('[data-build-kind="emplacement"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-build-kind="emplacement"]')).toBeInViewport();
  77 |     await page.locator('[data-build-close]').click();
  78 |     await page.locator('.hud-tools>summary').click();await page.locator('#roster-toggle').click();
  79 |     await page.locator('.roster-row').first().click();await page.locator('[aria-label="Close forces"]').click();
  80 |     await expect(page.locator('#selection-docket [data-hud-panel]')).toBeInViewport();
  81 |     await page.locator('#selection-docket [data-hud-panel]').click();await expect(page.locator('#selection-card')).toBeVisible();
  82 |   });
  83 | }
  84 | 
```