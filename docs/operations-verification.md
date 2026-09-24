# Operations slice — 23 September 2026

This is the first playable operations prototype, not final combat balance or subjective acceptance. The peaceful living-trench simulation remains available.

## Implemented

- Start, pause, new-operation, load/save, rendering-quality, and after-action menus. Menus and the field manual pause the simulation and gate world controls. The result is terminal even if simulation speed is changed; the battlefield remains inspectable.
- Ten-minute Village Offensive (48 friendly / 24 enemy), fifteen-minute Hold the Crossroads (48 / 48, 90-second preparation), and an open-ended 28-person sandbox. The old 224-person fixture and old saves remain unchanged.
- Three named objectives and finite food/water/ammunition caches. Capture requires three able, not heavily suppressed troops. Mixed forces halt progress; hostile presence denies control points. Supplies transfer only to stopped troops physically within 12 m of an owned, uncontested cache.
- Operation-only deterministic rifle combat: 145 m range, building and terrain occlusion, area cover, ammunition consumption, moving-fire penalty, suppression, casualties and recoverable carried cargo. Enemy squads establish firing positions on current visible contacts and otherwise move toward objectives. No trained policy, fog of war, machine guns, armor, vehicle combat, or destructible buildings.
- Friendly/enemy unit and map markers, objective flags and terrain-draped circles, short tracer lines, suppression poses, a clearer objective HUD and village detailing. Static building parts are batched by material; no per-window draw calls. The village has roof variations, shutters, sills and a bell-tower landmark.
- Optional operation save payload with validation; pre-existing v1/v2 migration is retained. New sessions do not write over saves. Quota failure preserves the prior save and reports failure.

## Tests and build

- **93 tests / 9 files passed** (15 new operation tests plus the original 78). Focused operation tests and original earthworks tests also passed separately.
- One unrestricted parallel run hit the pre-existing earthworks capacity test's 5 s wall timeout at 5.223 s; no assertion failed. The isolated file passed (capacity test 3.617 s), and the complete suite passed with two workers (capacity test 4.507 s). `npm test` now caps workers at two; no simulation assertions or timeout budgets were relaxed. Avoid running heavy training concurrently with this suite.
- `npm run build` passed. Final tested production bundle: `index-DOiozKSj.js`, 676.29 kB / 184.41 kB gzip. The existing >500 kB bundle advisory remains; there are no compile errors.

## Actual-simulation probes

`scripts/verify-operations.ts` uses the real fixed-step TypeScript simulation and does a serialized save/load after 120 simulation seconds. It never overwrites an existing evidence file.

Latest simulation pilot: `output/operations-pilot-r3.json`, source fingerprint `a248500cf70bf63902a9a2c48d689fae6a1ca300aa3aa6ff10e6ad616c26f486`. UI-only refinements followed; operation/garrison rules did not change after this pilot.

| Seed | Offensive: simple two-pronged orders | Able friendlies | Defense: no player orders | Able friendlies |
|---|---|---:|---|---:|
| 1944 | Victory at 361.80 s | 48 | Defeat at 372.00 s | 7 |
| 1945 | Victory at 352.45 s | 43 | Victory at 345.80 s | 16 |
| 1946 | Victory at 361.25 s | 43 | Timeout defeat at 900.05 s | 9 |

These are repeatable mechanical playability probes, **not learned-AI evaluation or evidence of enjoyable difficulty**. Defense is strongly sensitive to terrain/position and still needs active-player tactics and tuning. Earlier r1/r2 outputs remain, including the overly passive/rushing enemy behavior they exposed. Maximum ledger error across r3 was below 1.7e-11.

Fresh playable sandbox soak: `output/playable-sandbox-soak-r1.json`, source fingerprint `63539c527a9bbb4b177d87cf1dd646bdbe134ed0c1e98f4e8f11b81c3683de1c`. 72 campaign hours with lethal deprivation explicitly enabled for the test: all 28 active at the end, zero deaths, zero critical-need hours, zero emergency prompts, all three support facilities completed, no final blocked/stalled trips, longest travel stall 5 s, maximum inventory error below 1.7e-11. Watch gaps totaled 16.31 person-hours and 1,626 task changes; this is not a zero-watch-gap claim. Normal sandbox mortality remains opt-in.

## Browser checks

Headed Edge, separate QA profile; live user saves were not used. Desktop 1440 × 900 and narrow-window 768 × 900 screenshots were inspected. The final production preview was tested on port 4174; the user game remains on 4173.

- Started an offensive through the menu, issued a real right-mouse drawn route, and verified its four stored waypoints. Enemy markers are disabled for selection and player command methods reject enemy IDs.
- Verified menu pause with simSpeed still 1, resume without catch-up, and the field manual's pause/Escape behavior.
- Saved an operation, advanced it, and loaded it; every serialized state field matched the saved record. A naive comparison to the pre-save object differed only because serialization adds `policySchema` metadata, not because gameplay changed.
- Simulated localStorage quota failure; save returned failure and the previous saved bytes remained intact. Multiple new operations did not alter the saved campaign.
- Completed an actual production-browser offensive via developer-issued normal move orders and fixed-step acceleration: victory at **388.25 simulation seconds**, 42/48 able friendlies, 1,267 shots and 131 hits. No objective/health edits were used for this run. The earlier 4-second after-action screenshot was a synthetic UI boundary test and is not gameplay evidence.
- Twenty-second production frame-cadence sample during a 72-soldier firefight at 5×, Balanced, camera approximately (-1130, -1350), distance 330: 3,294 frames, **p95 6.2 ms**, worst 6.3 ms, 100.25 simulation seconds advanced, 632 shots / 76 hits by sample end. About 90 draw calls; final rolling mean CPU frame cost 0.88 ms. This is one short operation sample, **not a replacement for mature 300/1,000-person camp measurements**.
- No browser console errors or warnings in the final production pass.

Evidence screenshots in `output/playwright/`: `overnight-start-menu.png`, `overnight-operation-overview.png`, `overnight-village-detail.png`, `overnight-menu-768.png`, `overnight-operation-768.png`, `overnight-actual-victory.png`. `overnight-after-action.png` is the synthetic boundary screenshot noted above.

## Next risks / remaining work

1. Integrate combat alerts with living-garrison routines: under-fire guards must wake/relieve others promptly, with bounded temporary readiness that respects explicit orders. The current operation starts without an assigned garrison, so the tested offensive does not certify garrison behavior under fire.
2. Active defensive tactics, better contextual onboarding, squad health/casualty clarity, field recovery/rest and physical forward ammunition resupply. Do not add unlimited refills or silently turn permanent needs damage on.
3. More visual/audio polish and responsive checks below 768 px. Full phone/touch play is not certified.
4. Mature large-garrison navigation/performance remains a separate unresolved baseline issue.
5. A new learning pilot is authorized, but **not started**. Current `GarrisonSystem.coordinate()` always calls `rulePolicy.decide`; the retained `policyActions/requestPolicy` fields are not active. Old training scripts would therefore need an explicitly tested experimental boundary before training could contribute. Do not spend hours training a disconnected action space or pool incompatible old checkpoints. Keep deterministic normal play and require ablation/evaluation evidence before adoption.

## Skill use

Game Studio Overseer and Game Studio structured the bounded sprint; Web Game Foundations and Three WebGL Game kept operation state separate from rendering; Game UI Frontend and Game Art Development guided the command-table palette, low-chrome HUD and procedural village detail; Game Playtest and Playwright guided real-browser interaction and screenshots. OpenAI Docs was used for the thread-heartbeat setup and local-runtime constraints. No external art generation, spending, publishing, or deployment was performed.
