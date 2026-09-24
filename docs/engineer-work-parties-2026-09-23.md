# Engineer work parties — 23 September 2026

## Scope and behavior

Direct user request: engineers should start near the middle, work outward and split onto branches. Implemented as deterministic simulation behavior, with no neural training, agents, external changes or new material economy.

- An isolated new trench starts halfway along its drawn route. A route touching existing completed trench starts at a junction instead. Already-dug legacy lines retain their prefix exactly.
- Stable pairs walk to real working faces. Crews spread between left/right fronts; a spare pair moves onto a queued branch when its junction reaches completed ground. Separate disconnected jobs wait. Finished crews rejoin unfinished work.
- Each present, active, unsuppressed worker contributes 0.2 metres per simulation second. Eight workers cannot exceed the previous 1.6 m/s aggregate rate. Walking and suppression do not excavate; casualties reduce available labor.
- Hold/movement pauses all fronts; Resume collects the engineer's remaining owned jobs. Other active teams' queued/assigned work is not stolen. Work parties, approach routes, review timing and dug intervals survive saves.
- The completed interval is shared by terrain cover, trench navigation, terrain workers, visible earthworks, timber, debug geometry and capacity markers. Both unfinished arms remain dashed plans. Original trench IDs and geometry stay stable.
- A connected network shows one capacity label, eliminating duplicate overlapping labels at the new junction. The engineer inspector reports diggers, fronts and active jobs; Help describes the new controls.

Three.js architecture guidance kept work allocation out of rendering and made all consumers use the same completed geometry. Playtest guidance required ordinary browser controls and inspected screenshots, including a full completion rather than only early progress.

## Implementation and identity

`EngineerSystem.ts` owns scheduling and work parties; `TrenchGeometry.ts` owns completed spans and clipping. Integration includes `BattlefieldSimulation`, `TrenchSystem`, `TrenchNetwork`, `GarrisonSystem`, terrain/overlay renderers and save validation. Terrain refresh keys are localized so a distant working face does not regenerate already-finished chunks everywhere.

- Save schema remains 2, with optional validated excavation and engineer-work fields; missing fields use the legacy prefix. No prior save is rewritten by loading it.
- Rules: `deterministic-12`; observation version remains 2. Older incompatible neural identities remain unavailable/fallback, not silently adopted.
- Production: `dist/assets/index-DTSKz6j5.js`, 714.75 kB / 197.18 kB gzip.
- SHA-256: `bc7a95d50e1594fb14e3f84d30938d812be6e141a97f223f9af6bc37d8fb4b9b`.
- Ground worker: `GroundWorker-BYV80BzB.js`; navigation worker: `NavigationWorker-DLpisRet.js`.

## Automated verification

`npm test`: **226 tests / 33 files pass**, 23.60 seconds with two workers. `npm run build` passes; the existing >500 kB bundle warning remains.

Thirteen new focused tests cover midpoint digging, physically arriving before work, concurrent branches, disconnected queues, a bent loop with multiple branches, suppression/recovery, casualty-scaled throughput, Hold/Resume, exact saved continuation, legacy-prefix preservation, malformed work/crew rejection, clipped bent geometry and localized chunk invalidation. The existing long complex-line/queued continuation regression, 72-campaign-hour supplied loop soak, movement, enemy AI, combat, logistics and save tests still pass.

`output/engineer-operations-r1.json` contains six actual-simulation matches with intermediate save/load. All six complete with operation payloads exactly matching `enemy-ai-operations-r2.json`: offensive wins at 364.60 / 332.60 / 342.60 seconds; defensive defeats at 269.80 / 248.30 / 293.30 seconds for seeds 1944–1946. Maximum inventory residual is below 9.1e-12. These scripts do not order new excavation, so they establish existing-operation regression behavior, not combat engineering quality. The artifact's source hash includes the earlier 11-test engineer file; only two additional tests were added afterward, with no runtime changes. Final build identity is unchanged.

## Production browser verification

Isolated headed Edge session `frontlines-engineers`, production preview 4174, 1440 × 900. The user's 4173 tab and saved campaigns were not operated on. Browser reads inspected state; construction, orders, speed, focus, Save and Load used actual controls. No synthetic state, teleporting or free construction was injected.

1. Start a sandbox and select Engineer 1. Draw a roughly 200 m main line and an 80 m branch using the Trench button and mouse. At elapsed 88.85 seconds, all eight engineers are digging across **three fronts/two trenches**. Main progress 10.58%, branch 22.08%; real terrain exists only around the completed T junction. `engineer-draw-r1.json`, `engineer-plans-r1.png`, `engineer-fronts-r1.png`.
2. Save while paused. Hold, run at 5×, pause: both intervals unchanged. Resume, run, pause: both jobs advance. Load restores the entire saved state exactly, including four crew assignments and trips. `engineer-pause-save-r1.json`, `engineer-close-fronts-r1.png`.
3. Reload the final production build and restore the same save. Inspect the new network's single capacity label. At 241.35 seconds the branch is finished and its people have walked back to the remaining main-line fronts: **eight digging/two fronts/one trench**. `engineer-complete-r1.json`, `engineer-final-three-fronts-r1.png`.
4. Continue using 5×. At the sampled 266.85-second checkpoint **both trenches are 100% complete**, Engineer 1 is holding, the queue is empty and the active work-party plan is released. All 28 people remain active. `engineer-finish-r1.json`, `engineer-completed-network-1790196817990.png`.
5. Ordinary Load again restores the original paused 88.85-second campaign exactly on `index-DTSKz6j5.js`; elapsed time remains unchanged after waiting. `engineer-final-load-r2.json`, `engineer-final-load-r2-1790196930096.png`. The original isolated QA save remains available.

All browser artifacts are under `output/playwright/`; scripts are `scripts/qa-engineer-*.cjs`. Screenshots of actual digging, finished earthworks and the restored save were opened and visually inspected. Sampled rolling p95 frame interval was 6.2 ms in the 28-person scene; this is not a fresh 300/1,000-person performance certification. Browser console check: zero errors and zero warnings.

## Retained failures and claim limits

- First full test run exposed an old assertion expecting digging one second after drawing from a nearby endpoint. Middle-start crews now have to walk about 21 m. The updated test asserts zero initial work, waits for physical arrival, then verifies cancellation freezes progress; no worker-arrival requirement was relaxed.
- One atomic patch failed to find a context line; verified no partial edit before applying corrected patches. One CLI inline expression failed from quoting; file-based probes resolved it. Neither was a game failure.
- `qa-engineer-final-load.cjs` mistakenly checked `state.speed`, not the actual `simSpeed`, producing `paused:false` despite exact state restoration. The preserved revision-2 probe checks the correct field and unchanged elapsed time and passes. The original failed check/source remains available.
- Initial screenshots used `index-BAFFMhGQ.js`. The final build adds clearer help and one capacity label per network; all continuation and final-load checks identify `index-DTSKz6j5.js`.
- Supplied support construction retains its existing inventory/work model. This change does not add delivered-material costs to main fighting trenches.
- Already-assigned crew routes do not yet have a dedicated dynamic-obstruction replan loop. More fronts than available pairs wait for labor; the tests establish eventual completion in the supplied layouts, not every possible drawing.
- Existing large-camp performance limitations, asynchronous browser route timing and subjective believability remain open. No learning results are claimed or pooled with previous rules.

Next scoped checks: player review of branching behavior, obstructed/multi-team jobs, newly occupied partial networks during expansion, and sustained combat engineering. Subsequent heartbeat work returns to bugs/playthroughs within the original 21:45 UTC stop deadline.

20:57 UTC cleanup: final production hash unchanged, console again has zero errors/warnings. Closed only the owned `frontlines-engineers` QA browser and verified preview PID 35676 on 4174. The user's Vite PID 35696 on 4173 remains running and responds HTTP 200. Original saves and all prior/failed evidence remain preserved; no training or extra background work started.
