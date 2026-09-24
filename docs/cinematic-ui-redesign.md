# Cinematic UI redesign — September 24, 2026

Implemented from `3036b33` on `master`. This replaces the paper/folio presentation, not the simulation. Combat rules remain `combat-23-world2`; campaign/save keys, inventory rules, AI, navigation and fixed-step timing are unchanged. No training, automation, engine replacement or new assets/dependencies.

The UI/frontend skill guided progressive disclosure and readable controls. The game foundations skill guided the reversible preview boundary; the playtest skill guided real Edge controls, screenshot review and recapture. Automated success is not the user's visual acceptance.

## 1. Old components removed

- Deleted the five overlapping legacy style sheets: `field-command.css`, `operations.css`, `responsive.css`, `operational-ui.css`, `quick-battle.css`.
- Replaced the initial setup/folio with a genuine main menu and separate setup, operations, briefing, pause and settings screens.
- Removed the minimap DOM and its redundant render/update path. The operational map is the one map surface.
- Removed permanent roster, report/inspector, defense, support and developer launchers from ordinary play. Their functions remain contextual/optional.
- Replaced the Build form's entry layer with three direct choices; separated defense information into tabs and selected-unit detail into folds.

## 2. New architecture and visual system

`OperationUI` owns only menu presentation state. `BattleSetupView` renders setup/briefing from the existing configuration data. `BattlefieldUI` provides the minimal HUD, selected-unit summary, contextual command bar and alerts. `BuildPanel`, `GarrisonPanel` and `HudLayout` coordinate optional surfaces. `FieldMap` uses existing terrain and delivered knowledge; `MapLabels` deconflicts its labels without mutating observations.

`FrontlinesApp` owns a reversible preview transaction: retain the previous world/camera/selection, construct the proposed sector with the existing factory, show it paused, then either accept that same world or restore the retained state. No preview writes to the save slot. Beginning a new battle replaces the unsaved live session, with an explicit warning; only Save overwrites the saved campaign.

Styles are split into base primitives plus `ui/menu.css`, `ui/hud.css` and `ui/map.css`, not another override over old folio CSS.

| Purpose | Treatment |
| --- | --- |
| Surfaces | Near-black green `#111917`, charcoal translucent panels `rgba(20,29,28,.96)`, thin `#43534d` separators; 2 px corners |
| Text | Warm white `#eef1e9`, secondary gray-green `#b2bdb8` |
| Meaning | Selection `#d4c093`, friendly blue-gray `#b0c9d3`, enemy muted red `#d0998b`, warnings amber `#e1b580` |
| Typography | Bahnschrift condensed headings, Segoe UI body, Cascadia/Consolas for time/technical data; body 13–16 px, major headings 24–40 px |
| Controls | Labelled existing tactical SVG symbols; amber active state, matte hover/pressed state, clear disabled state and keyboard focus outline |
| Motion | 100–160 ms fades/short slide; OS and in-game reduced-motion settings. No camera-label hiding or delayed tracking |

## 3. Files changed

Presentation: `src/main.ts`, `src/style.css`, `src/ui/{menu,hud,map}.css`, `OperationUI.ts`, `BattleSetupView.ts`, `BattlefieldUI.ts`, `BuildPanel.ts`, `GarrisonPanel.ts`, `HudLayout.ts`, `FieldMap.ts`, `OperationalMap.ts`, `TacticalOverlay.ts`, new `MapLabels.ts` and its tests. Integration: `src/app/FrontlinesApp.ts` (preview and map command wiring, opening camera framing).

Verification: `tests/e2e/interface.spec.ts`, `playwright.config.ts`, `vitest.config.ts`, `tsconfig.node.json`; new `scripts/qa-cinematic-ui.cjs` and `qa-command-surface.cjs`; updated `qa-build-workflow.cjs`, `qa-quick-battle.cjs`, `qa-quick-battle-live.cjs`, `qa-quick-battle-result.cjs`. README controls/entry flow corrected. The five deleted style sheets are listed above.

## 4. Screenshots and visual iteration

Raw local evidence remains under `output/playwright/cinematic-ui/` (ignored by Git, not a hosted gallery). Initial, revised and final captures are preserved, not overwritten. The release manifest is `release-screens.json`; release screenshots use prefix **`1790275649993-`**.

| Review surface | Screenshot suffix |
| --- | --- |
| Main menu / Operations | `main.png`, `operations.png` |
| Quick Battle / real generated preview | `quick.png`, `briefing.png` |
| Unselected HUD / selected squad | `normal-hud.png`, `selected.png` |
| Unit details | `unit-details.png` |
| Build entry / support facilities | `build.png`, `build-support.png` |
| Defense / Supplies | `defense.png`, `supplies.png` |
| Operational map | `map.png` |
| Pause / Settings | `pause.png`, `settings.png` |
| Seven additional HUD sizes | `hud-WIDTHxHEIGHT.png` |

Additional real-action construction and command screenshots use `build-1790275209402-` and `commands-1790275142440-`. Live large-operation screenshots are `output/playwright/quick-battle/live-1790275689392-*`.

Inspected and revised the actual screenshots. Changes after the first capture included brighter readable setup captures (avoiding mid-animation captures), map label deconfliction/readable scale, automatically dismissing support after choosing a targeting tool, keeping Details usable in short windows, removing the remaining minimap implementation, and framing the opening camera inside the sector instead of showing the terrain edge. Final clean-HUD screenshots wait for the temporary start hint to clear and move the pointer away from formation tooltips.

## 5. Normal HUD behavior

Unselected: small brand, objective/timer, pause/speed, Menu, Map and Command. No order bar, selected report, force roster, minimap, supply ledger or debug overlay. Mission details expand on demand. At most two relevant alerts surface actual supply, casualty or formation problems; quiet conditions do not produce a permanent status wall.

Selected: a compact bottom-left summary and eight labelled orders. Panels occupy edges; the middle remains the battlefield. Escape closes the relevant tool/drawing/drawer before opening Pause. HUD changes never advance campaign time or change orders by themselves.

## 6. Operation setup

Main menu: Continue, Quick Battle, Operations, Sandbox, Settings. Continue resumes an existing live session or loads the browser-local save. Quick Battle presents operation, size, side, map and one Prepare button; Advanced remains folded. Existing seeds, presets, side/composition options and deterministic rematches remain functional.

Prepare creates the actual proposed sector. The briefing is a right-hand overlay above that paused 3D world. Back restores the exact unsaved prior world, including selection; Begin accepts the preview. Pause and after-action screens use a different, short action list rather than reusing the briefing composition.

## 7. Build flow

Build is available in the selected order bar and Command → Build with no selection. Entry choices: **Trench**, **Support structures**, **Worksites**. Trench immediately enters drawing, selecting a fit engineer through the existing API. No hypothetical fighting-position or trench-type controls were added.

Facilities retain the real requirements: completed network, assigned engineers, valid 6–40 m connector, delivered materials and actual work. These details appear only inside Support structures. Invalid/short trench input and missing crews produce concrete reasons. Worksites shows existing deliveries/construction and can focus them.

## 8. Selected-unit information

First layer: name/role, strength, actual order, qualitative ammo and suppression, one priority warning. Details opens collapsible Condition, Ammunition & supply and Activity & position. Existing Hold, Resume works, Push through and building-floor controls remain accessible when relevant. Command → Forces is the optional roster, not a permanent overlay.

## 9. Operational map

**M** toggles the map; **G** is retained as an alias and **V** now selects drawn movement (right-drag remains unchanged). The modal occupies 88% of desktop viewport dimensions, 92% in compact layouts, with aspect-correct cartography inside. Simulation pauses without changing the saved speed.

Dark cartography shows terrain/contours, roads, rivers, settlements, objectives, trenches, friendly formations and only observed/reported enemies. Added friendly depot/supply/truck indicators and actual routes, including blocked-route state. Selected squad paths remain visible. Select friendly markers, Shift-add, right-click to give point movement orders, or click terrain to focus the 3D camera. Labels avoid one another; lower-priority labels can be omitted when dense. No hidden live enemy coordinates are introduced.

## 10. Responsiveness and accessibility

Real Edge checks: **1920×1080, 2560×1440, 1654×910, 1366×768, 1280×720, 1024×768, 2560×1080, 1280×540**. Canvas follows the full viewport. Measured normal/selected HUD controls have no offscreen boxes or mutual overlap at these sizes. Menus/panels scroll when necessary; Details and the final facility option remain reachable. Advanced setup additionally checked at 960×600.

Buttons have text as well as icons, meaningful selected/disabled states and visible keyboard focus. Modal menus contain focus; map restores focus. Basic body text is 13–16 px, not the former tiny technical text. OS and in-game reduced motion are supported. Primary setup contrast measured 15.53:1 in the existing contrast check; this is not a complete accessibility audit. No key rebinding/gamepad/touch redesign was added.

## 11. Verification

- `npm test`: **59 files / 423 tests passed**. Includes hidden-information presentation checks, save continuation, fixed-step speed invariance, engineer queues, supplied 72-campaign-hour garrison soak, and three new map-label tests. This is the existing deterministic soak, not a newly played 72-hour browser campaign.
- `npm run build`: **passed**. Release `index-Gx9IxUd4.js`, 923.04 kB / 266.31 kB gzip; CSS 31.80 kB / 7.36 kB gzip. Existing >500 kB JS chunk warning remains.
- `npm run test:e2e -- --workers=1`: **12 tests passed** using Edge, including exact canonical save/load, preview rollback without save writes, contextual commands, keyboard/menu flow and eight resolutions. Previously this command had no specs. Vitest now explicitly excludes browser specs; Playwright runs them separately.
- Existing Quick Battle probe: **14/14 checks passed**, all operations, custom settings, presets/rematches, preserved save/load, seed validation and Escape.
- Real-command probe: **17/17 passed**, selection and box selection; drawn move, Hold, Defend, Observe, Suppress, Assault, Withdraw; map move; mortar-smoke mission accepted; speed; preview rollback; exact load; no page errors.
- Construction probe: **8/8 passed**, unselected Build access, actual facility queued, direct trench mode, short-line rejection, accepted 15 m line and engineer reassignment feedback. The browser checks placement/queues; the existing simulation tests verify delivered-material construction completion.
- After-action probe: **6/6 passed**, using an actual simulation-completed local defense fixture; this is not a claimed manual player victory.
- Large-operation live probe: **8/8 passed**, 160 people, active enemy orders and logistics. 1× advanced 6.00 sim seconds in 6.01 wall seconds; 5× advanced 30.05 in 6.02. Sampled p95 frame interval **6.2 ms** at both speeds. These are six-second deployment samples, not 300/1,000-person mixed-combat certification.
- Release screenshot probe: generated-world preview, exact cancellation, clean unselected HUD, map pause/toggle, all measured layouts passed. No browser page errors in action probes.

Evidence JSON: `quick-regression.json`, `commands-second.json`, `build-first.json`, `result-regression.json`, `live-regression.json`, `release-screens.json` under the local cinematic-ui evidence directory. Reproduction scripts are committed.

Failures retained and explained:

1. Initial native save check compared the zero-tick live object to a loaded save. SaveSystem already adds policy/rules metadata when serializing; changed the test to compare the complete canonical saved object, with no save-rule changes. Failure screenshot/context retained in `e2e-initial-failure/`.
2. Initial command probe rejected an otherwise visible mortar target at screen x=1579 due to an unnecessarily strict test bound. Corrected the viewport bound; the real support targeting action then passed. Also fixed the panel staying open during targeting.
3. First full unit run collected the new Playwright spec and failed with “Playwright Test did not expect test() to be called here”; all 423 unit tests passed in that run. Added explicit runner separation and reran successfully.
4. Earlier screenshots showed crowded map labels and over-dim animation frames. Those captures remain alongside the revised versions.

## 12. Remaining UX problems / acceptance limits

- This is a structural UI replacement, but **visual quality and believability still need the user's review**. Green tests are not subjective acceptance.
- Existing terrain tiling, water edges, simple buildings and vegetation are visible in the more open layout. Those rendering/art issues were deliberately not rewritten in this UI pass.
- Dense 3D formation flags can still overlap at certain camera angles; the new deconfliction applies to the operational map's text, not every battlefield marker.
- Map commands currently provide basic point movement, not every order or a drawn multi-waypoint route. Full-sector view preserves the square map, leaving dark side margins on wide screens. Very dense optional labels are suppressed rather than stacked.
- Advanced setup and detailed facilities/supplies remain information-dense by their nature. They are optional and scrollable, but could benefit from contextual onboarding. Controls help is not a complete interactive tutorial.
- Interface/audio preferences are session-local. Rebinding, localization, assistive-technology certification and touch/gamepad controls remain future work.
- Performance sample is small and early in the operation. Previous large mixed-combat/stress limitations and the JS chunk-size warning are not resolved or waived by this pass.

Suggested player review: Quick Battle → Prepare → Back (confirm the live session survives), then Begin; select a squad, move/defend it, Build a trench, open M and issue a move, and try Details at a short window height. Judge whether command is clearer and the battlefield feels dominant.

## Post-release correction: the QA browser was left constrained

The user's screenshot exposed a delivery mistake not covered by the emulated-resolution checks: the final live probe left the visible Edge session at a **960×600 emulated viewport**. Maximizing the native window did not change that override, so the correct full-viewport game still occupied only the upper-left part of the window. The earlier responsive result was insufficient evidence of a clean player-facing handoff.

Released the override through the owning Playwright session and restored native sizing, without reloading, rewriting a save or changing the paused live world. Verified actual OS-window resizing: 1200×850 produced 1176×758 content; 1600×960 produced 1576×868; maximized 1920×1032 produced **1912×948 content and canvas**. Live state and localStorage remained byte-identical. Screenshot/measurements: `output/playwright/cinematic-ui/native-window-acceptance.{png,json}`.

`scripts/run-browser-probe.mjs` now wraps viewport-changing probes in `try/finally`: release the fixed metrics and restore the original native bounds, on success or failure. Generated probe source and failures are retained beside the evidence. A passing 960×600 fixture and a deliberately throwing 960×600 fixture both returned the browser to 1912×948. `scripts/qa-native-window.cjs` verifies native resizing and uses CDP capture rather than a cached emulated screenshot rectangle. No game CSS, simulation or persistence patch was needed for this correction.
