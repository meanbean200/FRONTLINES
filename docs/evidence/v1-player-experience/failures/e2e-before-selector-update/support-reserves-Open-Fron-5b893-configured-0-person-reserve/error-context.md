# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: support-reserves.spec.ts >> Open Front shows the configured 0-person reserve
- Location: tests\e2e\support-reserves.spec.ts:10:42

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.support-status')
Expected substring: "Reserve 0/0"
Received string:    "All readyClearNo indirect weapons built. Build a field gun or battery, then assign its crew.Staff selected weaponsAmmunitionHigh explosiveSmokeChoose target · 0 readyChoose guns, then one target. Each ready weapon uses its own ammunition.Build weapon positions →Recent missionsNo missions ordered."
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('.support-status') with timeout 5000ms
  - waiting for locator('.support-status')
    2 × locator resolved to <div class="support-status"></div>
      - unexpected value ""
    12 × locator resolved to <div class="support-status">…</div>
       - unexpected value "All readyClearNo indirect weapons built. Build a field gun or battery, then assign its crew.Staff selected weaponsAmmunitionHigh explosiveSmokeChoose target · 0 readyChoose guns, then one target. Each ready weapon uses its own ammunition.Build weapon positions →Recent missionsNo missions ordered."

```

```yaml
- button "All ready"
- button "Clear"
- paragraph: No indirect weapons built. Build a field gun or battery, then assign its crew.
- button "Staff selected weapons" [disabled]
- text: Ammunition
- combobox "Ammunition":
  - option "High explosive" [selected]
  - option "Smoke"
- button "Choose target · 0 ready" [disabled]
- paragraph: Choose guns, then one target. Each ready weapon uses its own ammunition.
- button "Build weapon positions →"
- group: Recent missions
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {stepReplacements} from '../../src/operations/Replacements';
  3  | 
  4  | async function support(page:Page){
  5  |   await page.locator('.hud-tools summary').click();await page.locator('#roster-toggle').click();
  6  |   await page.locator('.roster-row').filter({hasText:'Able'}).click();await page.locator('[aria-label="Close forces"]').click();
  7  |   await page.locator('#support-command').click();
  8  | }
  9  | 
  10 | for(const reserves of [0,24,48] as const)test(`Open Front shows the configured ${reserves}-person reserve`,async({page},testInfo)=>{
  11 |   await page.goto('/');await page.locator('#choose-operation').click();await page.locator('[data-mode-choice="open-front"]').click();
  12 |   await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
  13 |   await page.locator('.advanced-setup summary').click();await page.locator('#setup-reserves').selectOption(String(reserves));
  14 |   await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();await page.locator('[data-speed="0"]').click();
> 15 |   await support(page);await expect(page.locator('.support-status')).toContainText(`Reserve ${reserves}/${reserves}`);
     |                                                                     ^ Error: expect(locator).toContainText(expected) failed
  16 |   await page.screenshot({path:testInfo.outputPath(`reserve-${reserves}.png`)});
  17 |   if(reserves!==24)return;
  18 |   // Eight synthetic losses; release uses the actual deterministic replacement
  19 |   // function. No long clock soak and no fake reserve-counter edit in the UI.
  20 |   const state=await page.evaluate(()=>window.__FRONTLINES__.getState());
  21 |   const losses=state.soldiers.filter(s=>state.squads.find(q=>q.id===s.squadId)?.faction==='player').slice(-8);
  22 |   for(const s of losses){s.health=0;s.needs!.life='dead';}
  23 |   state.living!.campaignHours=state.operation!.campaign!.replacements!.nextAt.player;
  24 |   stepReplacements(state,.05);
  25 |   expect(state.operation!.campaign!.replacements!.reserve.player).toBe(16);
  26 |   await page.evaluate(state=>window.__FRONTLINES__.restoreState(state),state);
  27 |   await support(page);await expect(page.locator('.support-status')).toContainText('Reserve 16/24');
  28 |   await page.locator('.operation-menu-button').click();await page.locator('#save-session').click();
  29 |   await expect(page.locator('.menu-status')).toContainText('Session saved.');
  30 |   await page.reload();await page.locator('#main-continue').click();await support(page);
  31 |   await expect(page.locator('.support-status')).toContainText('Reserve 16/24');
  32 |   // Wait for the restored view to settle before capturing the HUD evidence.
  33 |   await expect.poll(()=>page.evaluate(()=>window.__FRONTLINES__.getVisualStats().zoomDistance)).toBeCloseTo(300,0);
  34 |   await page.screenshot({path:testInfo.outputPath('reserve-16-of-24-reloaded.png')});
  35 | });
  36 | 
```