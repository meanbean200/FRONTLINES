# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: live-controls.spec.ts >> advanced changes preserve native fields and launch with the chosen rules
- Location: tests\e2e\live-controls.spec.ts:3:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('#begin-operation')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "3D battlefield" [ref=e3]
  - dialog "FRONTLINES menu" [ref=e4]:
    - generic [ref=e5]:
      - button "← Back" [ref=e6] [cursor=pointer]
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - text: INTO THE FIELD
            - heading "Quick Battle" [level=2] [ref=e10]
          - group "Operation" [ref=e11]:
            - generic [ref=e13]:
              - button [pressed] [ref=e14] [cursor=pointer]:
                - strong [ref=e15]: Signal at the Orchard
              - button [ref=e16] [cursor=pointer]:
                - strong [ref=e17]: Hold the Supply Road
              - button [ref=e18] [cursor=pointer]:
                - strong [ref=e19]: Race for the Hamlet
              - button [ref=e20] [cursor=pointer]:
                - strong [ref=e21]: Open Front
            - paragraph [ref=e22]: A trench and its overlooking farmhouse block the supply road. Reconnoitre the earthworks, stage a supporting group and several assault formations, then release a coordinated WAIT / GO attack. Secure the trench and farmhouse together.
          - generic [ref=e23]:
            - generic [ref=e24]:
              - text: Battle size
              - combobox "Battle size" [ref=e25]:
                - option "Small · fewer formations"
                - option "Medium · standard force" [selected]
                - option "Large · wider frontage"
            - generic [ref=e26]:
              - text: Your side
              - combobox "Your side" [ref=e27]:
                - option "U.S. forces" [selected]
                - option "German forces"
                - option "Random side"
            - generic [ref=e28]:
              - text: Map
              - combobox "Map" [ref=e29]:
                - option "Random sector"
                - option "Use a seed" [selected]
          - paragraph [ref=e30]: 72 friendly / 56 opposing personnel · 4 × 4 km
          - generic [ref=e31]:
            - text: Sector seed
            - spinbutton "Sector seed Same seed + settings recreates the same battle." [ref=e32]: "1944"
            - generic [ref=e33]: Same seed + settings recreates the same battle.
          - group [ref=e34]:
            - generic "Advanced Optional" [ref=e35] [cursor=pointer]:
              - text: Advanced
              - generic [ref=e36]: Optional
            - generic [ref=e38]:
              - text: Starting preset
              - combobox "Starting preset" [ref=e39]:
                - option "Choose preset…" [selected]
                - option "Standard"
                - option "Balanced forces"
                - option "Low supply"
                - option "Engineer support"
                - option "Closer approach"
            - generic [ref=e40]:
              - group "BATTLEFIELD" [ref=e41]:
                - generic [ref=e43]:
                  - text: Time of day
                  - combobox "Time of day" [ref=e44]:
                    - option "Dawn · 06:00"
                    - option "Day · 08:00"
                    - option "Dusk · 18:00"
                    - option "Night · 22:00" [selected]
                - generic [ref=e45]:
                  - text: Advance direction
                  - combobox "Advance direction" [ref=e46]:
                    - option "Seed-selected" [selected]
                    - option "East"
                    - option "South"
                    - option "West"
                    - option "North"
                - generic [ref=e47]:
                  - text: Staging distance
                  - combobox "Staging distance" [ref=e48]:
                    - option "Standard approach" [selected]
                    - option "Closer approach"
              - group "FORCES & SUPPORT" [ref=e49]:
                - generic [ref=e51]:
                  - text: Force balance
                  - combobox "Force balance" [ref=e52]:
                    - option "Operation roles" [selected]
                    - option "Equal rifle strength"
                - generic [ref=e53]:
                  - text: Construction equipment
                  - combobox "Construction equipment" [ref=e54]:
                    - option "8 tool sets"
                    - option "16 tool sets" [selected]
                - generic [ref=e55]:
                  - checkbox "Mortar equipment per side" [checked] [ref=e56]
                  - text: Mortar equipment per side
                - generic [ref=e57]:
                  - checkbox "Smoke ammunition" [checked] [ref=e58]
                  - text: Smoke ammunition
              - group "LOGISTICS" [ref=e59]:
                - generic [ref=e61]:
                  - text: Supplies for both sides
                  - combobox "Supplies for both sides" [ref=e62]:
                    - option "Standard supply"
                    - option "Low supply · half stock & deliveries" [selected]
                - paragraph [ref=e63]: Finite forces. Scheduled personnel replacements are available in Open Front.
                - paragraph [ref=e64]: Supplies move by convoy and carrier. No invisible refills.
            - generic [ref=e65]:
              - generic [ref=e66]:
                - text: Save these settings locally
                - textbox "Save these settings locally" [ref=e67]:
                  - /placeholder: e.g. Night defense
              - button "Save setup" [ref=e68] [cursor=pointer]
            - paragraph [ref=e69]: Settings only — your battlefield save is untouched.
          - button "Prepare battle →" [active] [ref=e70] [cursor=pointer]:
            - text: Prepare battle
            - generic [ref=e71]: →
          - paragraph [ref=e72]: Review your sector before you begin.
        - status [ref=e73]: "Could not prepare this sector. Error: Prepared enemy sector unreachable (56 people / 53 capacity)"
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | 
  3  | test('advanced changes preserve native fields and launch with the chosen rules',async({page})=>{
  4  |   await page.goto('/');await page.locator('#choose-operation').click();
  5  |   await page.locator('.advanced-setup>summary').click();
  6  |   const time=await page.locator('#setup-time').elementHandle();
  7  |   await page.locator('#setup-time').selectOption('night');
  8  |   expect(await time!.evaluate(el=>el.isConnected)).toBe(true);
  9  |   await page.locator('#setup-supply').selectOption('low');
  10 |   await page.locator('#setup-engineers').selectOption('2');
  11 |   await page.locator('#battle-map').selectOption('seed');await page.locator('#sector-seed').fill('1944');
> 12 |   await page.locator('#launch-operation').click();await page.locator('#begin-operation').click();
     |                                                                                          ^ Error: locator.click: Test timeout of 45000ms exceeded.
  13 |   await page.locator('[data-speed="0"]').click();
  14 |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState().operation?.setup?.advanced)).toMatchObject({time:'night',supply:'low',engineers:2});
  15 | });
  16 | 
  17 | test('live trench updates keep an open native select and apply its keyboard choice',async({page})=>{
  18 |   await page.goto('/');await page.locator('#sandbox-session').click();
  19 |   await page.locator('.hud-tools>summary').click();await page.locator('#trenches-command').click();
  20 |   await page.locator('#garrison-readiness').selectOption('stand-to');await page.locator('[data-speed="5"]').click();
  21 |   const field=await page.locator('#garrison-front').elementHandle();
  22 |   await page.locator('#garrison-front').click();await page.waitForTimeout(3500);
  23 |   expect(await field!.evaluate(el=>el.isConnected)).toBe(true);
  24 |   await expect(page.locator('#garrison-front')).toBeFocused();
  25 |   await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  26 |   const value=await page.locator('#garrison-front').inputValue();
  27 |   await page.locator('[data-speed="0"]').click();
  28 |   expect(await page.evaluate(()=>window.__FRONTLINES__.getState().living!.garrisons[0].front)).toBe(Number(value));
  29 | });
  30 | 
```