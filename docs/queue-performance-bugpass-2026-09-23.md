# Supply-queue cost and restored views — 23 September, 18:11 UTC slice

Local bug/playtest/polish work only. No new major systems, training, external publication, real-user save changes or extension of the **21:45 UTC / 4:45 PM America/Chicago** stop. Browser checks use isolated headed Edge `frontlines-queue`, production port 4174; user Vite remains on 4173.

## Findings and fixes

### 1. Repeated distant-camp checks stall crowded supply queues

The corrected fixed-tick simulation exposed expensive supply waiting-point searches. For every candidate queue position, `supplyPoint()` scanned every soldier's body and destination, including people in distant camps. A five-simulation-second V8 CPU profile of the aged 1,000-person fixture is dominated by these callbacks and distance calculations. **No external navigation search occurs in this particular five-second interval**, so this hotspot is distinct from the earlier failed-route problems.

The query now makes one conservative bounding-box pass over bodies **and incoming reservations**, then performs the original exact distance checks against possible blockers. Candidate order, strict clearance thresholds, self exclusion and dead/incapacitated handling are unchanged. The box has a small conservative rounding margin; it cannot relax the final distance test. There is no persistent cache: movement and assignments made earlier in the same tick are read anew. The optimization is used only for the distant supply-approach waiting-point query, not a general scheduling rewrite.

Five new regressions check destination order, a distant soldier reserving a nearby berth, moving/deleting reservations, threshold boundaries, 100 seeded crowded layouts against the original full scan, and work bounded independently of distant camps. The cost assertion failed against the extracted original algorithm: **20,210 exact distance calls**, versus fewer than 1,000 with the broad-phase query. The behavioral checks passed before and after; no assertion was weakened.

Matched five-second actual-simulation continuation:

- Before: **1,193.71 ms**, `output/fixed-tick-routes-before-r1.json` and `fixed-tick-1000-before-r1.cpuprofile`.
- After: **439.26 ms**, `fixed-tick-routes-queue-r1.json` and `fixed-tick-1000-queue-r1.cpuprofile`.
- Both have exactly the same complete final-state hash: `fb2508cb66bd3d85105b3bd47a3bf769c6b5d006207f6d94af29aeddf0e22f74`.
- An unprofiled repeat takes 438.06 ms and has the same hash: `fixed-tick-continuation-queue-r1.json`, including full final state. All inventory discrepancies are zero except fuel rounding below 1.6e-11.

These timings include their respective diagnostic overhead and describe this interval, not a whole-game speedup guarantee. No tick, collision, need, shipment or inventory rule changed. **Rules remain deterministic-9**; save v2 and observation version 2 / size 32 are unchanged.

### 2. Load can leave a restored campaign off-screen

After inspecting a distant camp, **Load** restored the saved troops but retained the unrelated camera location. The result looked like an empty field despite 28 living soldiers. This also reproduces by panning away before loading. The pre-fix browser projection of the saved first soldier was far outside the viewport, while the saved simulation and storage were byte-identical.

Successful player-facing loads now focus an able friendly's actual position. Incapacitated survivors remain inspectable; when no survivor exists, the view uses a friendly last-known position or available battlefield reference. It never prefers an enemy merely because that enemy appears first in the arrays. It does not select troops, issue orders, save renderer objects, or change simulation state. Debug fixture/replay restoration remains separate and retains its explicit camera handling.

Four new tests cover enemy/fallen exclusions, actual positions rather than stale squad centres, old saves without needs/faction fields, incapacitated/no-survivor fallback and empty worlds. Real-browser verification uses **Shift+D** to pan away, then **Load**: the soldier returns near viewport centre (719.3, 449.4), and the campaign state still exactly equals the stored save.

Inspected screenshots: `output/playwright/queue-load-view-before.png`, `queue-load-view-final.png`. Full old save and failed-view evidence: `queue-load-view-before-state.json`; final projection/state assertions: `queue-load-view-final-check.json`.

## Final verification and identities

- **167 tests / 25 files pass**, 21.73 seconds with two workers. Existing construction, movement, recovery, inventory, needs, combat, speed continuity, save/load and supplied 72-campaign-hour loop-soak tests pass. This is not fresh large-camp aging or a new large-camp 72-hour acceptance run.
- Production build: **`index-z2DqhRxU.js`**, 688.29 kB / 187.77 kB gzip; SHA-256 `a0389dbeedf2366b9a25ce13e265888898898cad3f34812f5662de28f7d05512`. Navigation worker remains `NavigationWorker-DxbOsWmq.js`, terrain worker `GroundWorker-NhrtBkXz.js`, CSS `index-CG30qDIA.css`. Existing >500 kB bundle warning remains.
- All nine repeated-seed defense comparisons still have the same normalized full-state hashes at 1×/2×/5× as the previous slice, including seed 1945's preserved victory. `output/queue-speed-continuation-final-r1.json`, source hash `d90c9425665fc28c0666a2e3b565d88ab84f8979f35bf9991bc6f4fed4f7f3e7`; maximum ledger discrepancy <5.5e-12. Only `simSpeed` is normalized. Browser asynchronous navigation remains a separate timing limitation, not resolved by this change.
- Intermediate queue-only build `index-CPxv9nOb.js` and `queue-speed-continuation-r1.json` precede the camera repair. Their artifacts are retained and not substituted for the final build.
- Actual UI checks include sandbox entry, pause/speed, Save/Load, supply-route display, readiness switching and camera recovery. Saved campaigns remain unchanged through imported performance fixtures. Final browser console: **0 errors / 0 warnings**.
- Final-build sandbox continuation used real 5× for 40 wall seconds, reaching **215.85 simulation seconds**: all 28 active, **7/7 guards at post**, 5 walking haulers, 15 resting and 1 walking to rest. Forward stock now contains 55 food, 55 water, 24 materials and 5 ammunition, with an empty shuttle returning. Trench stores are still empty in this snapshot, so this is not a completed foot-delivery or long-run safety claim. Full state: `output/playwright/queue-sandbox-final-state.json`; inspected `queue-sandbox-final.png` and the roster-focused `queue-sandbox-garrison-final.png`. A final ordinary Load again restores the original paused campaign exactly; no manual simulation stepping was used.
- One initial menu automation used a stale Begin-operation reference after selecting Sandbox, whose button becomes Enter sandbox. It was corrected from a fresh snapshot; no game defect was inferred. The initial performance regression failure is retained above. No failed evidence was removed.

## Browser performance, including the remaining failure

Same older eight-campaign-hour fixtures, headed Edge, 1440 × 900, DPR 1, Balanced, camera (-2690, -1130), distance 240. Restore each fixture, five wall seconds of warm-up, then about 20 seconds of RAF samples. Actual speed buttons advance the game; no debug fast-forward is used. **No headless tests or experiments overlap these measurements.** None is paused by a supply decision.

| Build / soldiers / garrisons / trucks | Speed | p95 frame | Worst frame | Simulation advance / wall duration |
|---|---|---:|---:|---|
| Before / 1,000 / 10 / 4 | 5× | 303.8 ms | 419.1 ms | 61 s / 20.0621 s |
| Final / 1,000 / 10 / 4 | 5× | **115.4 ms** | **741.2 ms** | **69.5 s / 20.1855 s** |
| Final / 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20.05 s / 20.0035 s |
| Final / 300 / 3 / 4 | 5× | 6.2 ms | 12.2 ms | 100.25 s / 20.0059 s |

The **300-person target passes** at both speeds with full advancement. **1,000 still fails** p95 <16.7 ms and sustained 5×. Its p95 improves, but the worst hitch is worse and the changed wall/simulation phase prevents treating the rows as a precise whole-game speedup ratio. Do not call this large-camp acceptance or conceal the remaining hitch. The earlier fixed-tick regression and all older failures remain part of the record.

Final metrics: `output/playwright/queue-final-performance-r1.json`; inspected final screenshots `queue-final-1000-5x.png` and `queue-final-300-5x.png` (the 300-person 1× screenshot is also retained). Before metrics/screenshot: `aged-1000-queue-before-r1.json`, `aged-1000-queue-before.png`. Intermediate queue-only rows remain in `aged-1000-queue-after-r1.json` (p95 109.4 ms / worst 735.1 ms) and `aged-300-queue-after-r1.json`; final measurements were repeated after the camera fix.

Fixture hashes: 300-person `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`; 1,000-person `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`. These fixtures were **not freshly aged under rules 9**.

## Remaining work

1. Profile the later corrected-tick 1,000-person state and its long hitches, separately from this five-second queue hotspot. Navigation failures, geometry invalidation and crowded movement still need bounded investigation.
2. Preserve matched command timing when investigating browser-worker differences. The headless hashes do not establish browser cross-speed identity.
3. Continue existing-mode playthroughs, crowded delivery destinations and fresh aging. No major systems or neural training under the narrowed request.

The playtest skill led to the reproduced camera handoff defect and actual control/screenshot/save verification. Three.js guidance kept rendering and simulation separate and required new measurements after the optimization. Visual believability and subjective playability remain the user's acceptance step.

18:28 UTC cleanup: closed only owned QA browser `frontlines-queue` and stopped verified preview PID 4480 on 4174. User Vite PID 35696 on 4173 remains running and returned HTTP 200. Original and failed evidence and all saves remain intact. Heartbeat remains active within the original 21:45 UTC deadline; no training started.
