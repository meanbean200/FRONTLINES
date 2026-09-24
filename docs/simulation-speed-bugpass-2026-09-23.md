# Speed-dependent simulation bug — 23 September, 17:41 UTC slice

Local bug/playthrough scope only; no major systems, training, publication, real-user save changes or deadline extension. Original stop remains **21:45 UTC / 4:45 PM America/Chicago**. Checks used isolated headed Edge `frontlines-speed` and production preview on port 4174. The user's Vite server stays on 4173.

## Reproduction and correction

Fast-forward previously multiplied the duration of one simulation step. The browser's 0.05-second fixed tick became a 0.25-second step at 5×, changing movement, combat, logistics and duty decisions rather than merely running them faster.

Matched hands-off defense runs of the actual TypeScript simulation reproduced different battle outcomes from changing only speed:

| Seed | Old 1× | Old 2× | Old 5× | Corrected, all three speeds |
|---|---|---|---|---|
| 1944 | Defeat, 372.00 s | Defeat, 349.20 s | Defeat, 347.25 s | Defeat, 372.00 s |
| 1945 | **Victory, 345.80 s** | **Defeat, 336.20 s** | **Defeat, 900.00 s** | **Victory, 345.80 s** |
| 1946 | Defeat, 373.25 s | Defeat, 335.70 s | Defeat, 370.50 s | Defeat, 373.25 s |

`BattlefieldSimulation.step()` now repeats the caller's original tick two or five times. Emergency decisions and terminal battle results stop the remaining ticks immediately. Invalid/nonpositive elapsed input is ignored. There is no new hidden accumulator, saved phase, altered combat balance or coarser fallback when the computer is overloaded. The caller still owns tick size; arbitrary unequal caller time steps are not claimed equivalent.

Rules are **deterministic-9**. Save v2 and observation version 2 / size 32 are unchanged. Existing 1× reference histories are preserved in these matched runs; old fast-forward histories intentionally change. No neural model was trained or adopted.

## Exact continuation evidence

`scripts/verify-speed-continuation.ts` runs seeds 1944–1946 at 1×, 2× and 5×, with the same 0.05-second caller tick and no tactical commands. It retains complete final states, ledgers and source identity, refuses to overwrite an artifact, and has a shared 45-wall-second cap.

All nine final runs complete, and their full-state SHA-256 hashes match across speeds within each seed. **Only `simSpeed` is normalized**, to 1, when hashing. The corrected hashes also equal each corresponding pre-fix 1× hash:

- 1944: `baea356684fa3bdba53590dfbf23fd7bd5fd69a08ff6c2f8cd110a370206b920`
- 1945: `2b7ffa5f97b220f2d292b38b9fa2bf81ff452581147931670e748b6fcab0428f`
- 1946: `69acc45ee5bad3a6fd8dd2f25b2ae53aa06fbeb25a30b433da998b67a099cd6e`

Final artifact: `output/speed-continuation-final-r1.json`, source hash `b895b31f13d69ab70e1a84c2ded5b89a9f406d349c5ec5a4cf08e0b423089618`. Maximum inventory discrepancy is below 5.5e-12. `speed-continuation-before-r1.json` and `speed-continuation-after-r1.json` remain preserved; the latter preceded the sixth regression test, not a different gameplay implementation. No comparison budget was extended.

## Verification

- **158 tests / 23 files pass**, 20.87 seconds with two workers. Six speed regressions cover living duties/movement/inventory at 2× and 5×, mixed-speed combat through save/load, an emergency in the first fast-forward tick, a battle ending in that tick, and invalid time input. The first five failed before the fix. No existing gameplay assertion was weakened.
- Existing complex engineer jobs, drawn movement, recovery, inventory, sleep/needs, combat, save/load and supplied 72-campaign-hour loop-soak tests pass. This is not a fresh large-camp 72-hour acceptance run.
- Production build passes: **`index-Bf_VZgy0.js`**, 687.60 kB / 187.50 kB gzip; SHA-256 `95e560e356252c50ca4f201782204b0225a4bf4a17b98da73508704e5071b6e5`. Worker remains `NavigationWorker-DxbOsWmq.js`, CSS `index-CG30qDIA.css`. The existing >500 kB bundle warning remains.
- Six additional 1× operation probes with intermediate save/load preserve previous results: three offensive wins at 361.80 / 352.45 / 361.25 seconds, and defensive loss / win / loss at 372.00 / 345.80 / 373.25. Maximum ledger discrepancy <1.7e-11. `output/operations-speed-r1.json`, source hash `d05b21426c56ae1393564136e6a4a022a65e556b759eb25c74d0ab76fade5d14`.

## Real browser playthrough and saves

Started **Hold the crossroads** through the menu. Used normal 5×, pause, Save, 1×, 2× and Load controls. The paused save at 100.10 simulation seconds restores byte-identically. Continued at 5× with no tactical repositioning: **defeat at 408.30 seconds, 2/48 friendly able, 7 enemy able**, with the correct too-few-defenders explanation.

After Inspect battlefield, Space and Hold leave the terminal simulation byte-identically frozen; speed controls are disabled. The first attempted automated click on disabled 5× correctly timed out. The repeated check asserted its disabled state instead of trying to bypass it. Load saved campaign restores the original paused battle exactly, including after the performance fixtures. Real-user storage was never opened or modified.

Evidence in `output/playwright/`:

- `speed-defense-result-state.json`: full frozen result, original save checks and loaded build identity.
- Inspected `speed-defense-result.png` and `speed-defense-restored-final.png`.
- `speed-browser-checks-r1.json`: frozen result and exact final reload assertions.
- `speed-post-performance-save-check.json`: unchanged storage and exact reload after stress checks.
- Earlier `speed-defense-loaded.png` retained: it captured the previous HUD refresh immediately after Load. The final restored screenshot waits for the normal refresh and shows the paused state correctly.

**Boundary:** browser squad navigation is asynchronous, whereas these headless comparisons use synchronous planning. Worker reply arrival can still alter browser command timing. The browser result is a completed playthrough, not evidence of browser/headless equality or fully speed-invariant browser battles. That remains a separate matched-worker timing investigation; it is not disguised by the passing core-simulation hashes.

## Performance cost and limits

Correct fixed-tick fast-forward performs more work than the old coarse stepping. Remeasured on the same older eight-campaign-hour fixtures, headed Edge, 1440 × 900, DPR 1, Balanced, camera (-2690, -1130), distance 240. Each row restores the fixture, warms for five wall seconds, then samples RAF for about 20 seconds. **No headless tests or experiments overlap these final samples.** No supply decisions pause them.

| Soldiers / garrisons / trucks | Speed | p95 frame | Worst frame | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0002 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 18.3 ms | 100 s / 20.0002 s |
| 1,000 / 10 / 4 | 5× | **315.9 ms** | **437.4 ms** | **61.5 s / 20.2461 s** |

The scoped **300-person target passes**, with an occasional >16.7 ms frame at 5×. **1,000 fails substantially**, including full simulation advance. Its p95 is worse than the preceding rules-8 sample (54.7 ms). More ticks and changed trajectories preclude a clean isolated speedup/slowdown ratio, but this is a real current performance failure, not an accepted scale. Do not restore coarse stepping to make the benchmark look better.

Final metrics: `output/playwright/aged-300-speed-metrics-r2.json` and `aged-1000-speed-metrics-r1.json`; corresponding inspected screenshots `aged-300-speed-check-r2.png` and `aged-1000-speed-check.png`. Screenshot highlights can predate the pause button's 200 ms HUD refresh; measured state and simulation advance are recorded independently.

The initial 300-person probe had a QA-script typo (`living.logistics.trucks` instead of `living.trucks`), raised a console error and completed no metric. It was paused and ended by reloading the isolated page; the failed check is recorded in `speed-browser-checks-r1.json` and `.playwright-cli/console-2026-09-23T17-44-07-156Z.log`. Corrected final browser checks have **0 errors / 0 warnings**. This was a harness error, not a hidden game fix.

Fixtures were not freshly aged under rules 9. Their identities remain: 300-person `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`; 1,000-person `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`. Older failures and source snapshots remain intact.

## Next bounded work

1. Profile corrected-tick 1,000-person CPU cost, especially repeated navigation and geometry invalidation; retain full physical simulation and measure advancement, not just rendering cadence.
2. Reproduce browser worker timing differences with matched command histories before claiming complete cross-speed determinism. Existing stale-load/result protections remain in place.
3. Continue the remaining outward-route failure and fresh crowded-camp aging separately from old-fixture runtime checks. No major systems or neural training under the narrowed request.

The playtest skill drove real control/screenshot/save checks and preservation of failed evidence. Three.js guidance kept the correction in the simulation and required new performance measurements without hiding troops or lowering graphics quality. Subjective playability and believability remain the user's acceptance step.

17:56 UTC cleanup: closed only owned QA browser `frontlines-speed` and stopped verified preview PID 33204 on 4174. User Vite PID 35696 on 4173 remains running and returned HTTP 200. All prior and failed artifacts remain. Heartbeat stays active within the original 21:45 UTC deadline; no training was started.
