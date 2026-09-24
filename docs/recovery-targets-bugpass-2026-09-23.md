# Recovery targets — 23 September 2026, 15:41 UTC slice

Bug-only scope, local work, no training or new systems. Deadline remains 21:45 UTC / 4:45 PM America/Chicago. Real user saves and all previous evidence are preserved. Browser work used isolated headed Edge session `frontlines-targets`, 1440 × 900, and owned production preview port 4174.

## Fixed findings

1. **A disconnected crate trapped a carrier indefinitely.** Internal duty routing projected the crate onto the soldier's own trench component and then appended an impossible cross-wall final segment. The carrier reached the entrance, marked its route disconnected, and never reconsidered. Exact destination checks now reject a different trench component or an impassable building endpoint. External approaches also validate the final hop after squad navigation adjusts a destination away from a footprint.
2. **A failed first candidate could suppress usable work.** The coordinator now tries eligible crates nearest to the garrison entrance first, with a stable ID tie-break, and falls through to normal duties when none can be assigned. It does not reserve an impossible target or leave every available person retrying the first array entry. Existing automatic/authorized search boundaries and two-carrier limit are unchanged; no new long-range recovery system is added.
3. **Existing blocked saves kept the bad assignment.** Empty, failed crate pickups are released at the next coordination decision. Loaded state remains unchanged while paused. Cargo-bearing trips are not cancelled or emptied by this repair.

Four initial target-selection regressions failed before their fix; the older-save regression then failed before adding the narrow release path. The final six tests cover disconnected/alternative targets, fallback duties, connecting the trench later through save/load, nearest-first selection, exact building endpoints, and older blocked saves. Existing physical recovery/withdrawal and inventory-conservation tests also pass.

The disconnected crate is inaccessible through the current garrison route graph, not claimed to be impossible to reach by any conceivable route. Supporting entry through a separate trench's entrance would be a separate routing feature. Completing a real connector makes the crate eligible again; no permanent blacklist is used.

## Browser verification

`scripts/verify-recovery-targets.ts` uses the explicit recovery fixture from the preceding pass, adds an isolated completed trench, and transfers six food/water units into a crate there. It creates no extra inventory. This is a **synthetic routing diagnostic**, not a naturally occurring cutoff or a balance comparison. Normal UI decisions and 5× native simulation were used after fixture import; no developer time advancement.

- Old production bundle `index-CIxL0Zn_.js`: at **287.15 seconds**, soldier 2 was still `waiting · disconnected trench`, hunger 91.31 / thirst 96.97, empty pack, and an expired pickup deadline of 255.05 seconds. The blocked crate retained its stock. Saved through the real button and retained as `output/playwright/blocked-carrier-before-save.json`.
- New bundle `index-DwzIGpCS.js`: loading that save was **byte-identical** while paused. At 290.15 seconds the soldier had a valid recovery duty instead of the impossible pickup. By 370.40 seconds the same soldier was returning from the reachable crate with **5 food / 5 water / 4 materials**, hunger 55.75 / thirst 51.44, no route blockage, and no accumulated thirsty hours.
- Fresh matched fixture in the new bundle: first carrier selected reachable crate 25, not disconnected crate 26. At **185.05 seconds**, local cache held **5.5 food / 5.5 water / 8 materials**, no soldier had a blocked route, and resource-balance error was **zero for every resource**. The isolated crate still held its original six food/water units.

Retained before/after headless evidence: `output/recovery-targets-before-r1.json` and `output/recovery-targets-after-r1.json`, each tagged with its rules version. Both contain the initial fixture and the actual 120-second continuation. Outputs refuse an existing name. Screenshots were visually inspected: `recovery-targets-before.png`, `recovery-targets-saved-carrier-resumed.png`, and `recovery-targets-after.png` in `output/playwright/`. Trees and overlapping flags still limit individual-soldier readability; state traces support the exact behavior claims.

Two QA selector attempts timed out: Sandbox changes the start button from Begin to Enter, and an imprecise garrison-text locator found a hidden Help heading. Fresh snapshots corrected both. These were automation errors, not game freezes; failure output is retained.

## Verification

- Target-fix checkpoint: **128 tests / 18 files pass**, 20.35 seconds. After the exact corridor-query optimization below: **131 tests / 19 files pass**, 18.87 seconds, including the existing 72-campaign-hour loop soak.
- Target-fix browser checkpoint: `index-DwzIGpCS.js`, SHA-256 `2869b900cdf5a6e41ccad47a9db037b03076fa5ad997ec764da3d2f93a874795`. Final production build passes: **`index-B0wrO2dJ.js`**, 684.45 kB / 186.43 kB gzip, SHA-256 `c0418e4a438c2e81df9bb68a24acc1d8f6384a225de73760cb25e36b3c810e7c`. Existing >500 kB warning remains.
- Rules advance to **`deterministic-5`**; save v2 and observation version 2 / size 32 are unchanged. No neural model is trained or adopted.
- Six scripted operation continuations remain at the prior outcomes/times: offensive wins 361.80 / 352.45 / 361.25 seconds; hands-off defense loss / win / loss at 372.00 / 345.80 / 373.25 seconds. Evidence: `output/operations-recovery-targets-r1.json`, and final indexed rerun `output/operations-recovery-targets-r2.json`; maximum resource error < 1.7e-11. Final source hash `fe39e5e447f71f131dcb94c13bdc9d49e882acac2f507113203e89b59ca13af7`.
- Final indexed production bundle also loaded the saved stuck carrier through the real Load button. At 346.40 seconds he had physically picked up 6 food / 6 water / 4 materials from the reachable crate and was returning; the original QA save remained at 287.15 seconds. Screenshot `output/playwright/recovery-targets-final-indexed.png` was inspected; it records the HUD, not a close-up of the carrier (the camera remained at the performance camp). Final console check: zero warnings/errors.

Game Playtest/Playwright drove real-input reproduction and screenshot review. Three WebGL Game kept the fix in simulation/navigation rather than renderer state. Believability and long-session difficulty remain player acceptance steps.

## Bounded performance investigation

The older `output/deterministic-1000-aged.json` fixture still exposes a serious performance failure under the current rules. This is an eight-campaign-hour-old state produced by an earlier revision, **not proof of fresh aging or long-run safety under current rules**. Fixture SHA-256 `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`. Headed Edge at 1440 × 900, Balanced, camera (-2690, -1130), distance 240; all garrisons continue simulation. Each unprofiled run restores the same source fixture, warms for five wall seconds, then samples requestAnimationFrame intervals for at least 20 seconds. No headless test/benchmark ran during these samples.

Before indexing, at 5× the 1,000-person camp advanced only **21.25 simulation seconds in 20.75 wall seconds**, with p95 **18.3 ms** and worst **1,755.7 ms**. The misleadingly modest p95 is not a pass: long stalls comprise few rendered frames, and simulated time falls far behind. A separate short Chrome DevTools CPU profile attributed about 9.17 seconds of self time to `segmentClear`, 1.97 seconds to route `plan`, and 0.90 seconds to `corridorClearance`; this is main-thread routing cost, not evidence of a GPU bottleneck. Raw profile: `output/playwright/aged-1000-rules5.cpuprofile`.

`TrenchNetwork.corridorContains()` previously scanned every edge, including distant camps, for each navigation sample. A 32 m spatial index now narrows that boolean membership query to nearby edges, retaining the identical exact distance test and clearance radius. Full-distance clearance remains unchanged. The index rebuilds with geometry; tests compare more than 6,000 points and end-cap boundaries against the untouched full-scan oracle, including signed cell boundaries, removal, and completion. The initial no-full-scan regression failed before the optimization.

The captured difficult state at 652.6 seconds was continued for 20 actual simulation steps at 5× before and after indexing. Both produced **byte-identical complete state**, SHA-256 `a01b0838dcce26e847180cbb43b4692f005dfd7ebcd6dcc001d7e7d23d84f679`, and matching inventory balance. Cost fell from **23,071 ms to 2,206 ms**. Evidence: `output/aged-continuation-before-r1.json`, `output/aged-continuation-after-r1.json`, and `scripts/verify-aged-continuation.ts`. This is a scoped roughly 10× CPU improvement, not a game-wide speed claim. Rules identity remains deterministic-5 because this index is behavior-preserving.

The final production 1,000-person browser recheck still **fails**: **41.25 simulation seconds in 21.41 wall seconds**, p95 **163.9 ms**, worst **1,518.9 ms**. It advances further into the workload, so frame distributions are not a matched fixed-state comparison; do not present the p95 change alone as an improvement or regression. Both runs fail the 5× real-time requirement. Long route searches need further bounded profiling; this pass does not certify 1,000-person playability.

The final 300-person / three-garrison / four-truck check meets the scoped frame and advancement targets in both runs:

| Speed | Wall seconds | Simulation seconds advanced | p95 frame | Worst frame |
|---|---:|---:|---:|---:|
| 1× | 20.003 | 20.0 | 6.2 ms | 6.4 ms |
| 5× | 20.002 | 100.0 | 6.2 ms | 12.1 ms |

Source fixture `output/deterministic-300-aged-final.json`, SHA-256 `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`. No pending supply decisions paused any measurement. Metrics are preserved in `output/playwright/aged-rules5-before-metrics.json` and `output/playwright/aged-rules5-indexed-metrics.json`. Screenshots `aged-1000-targets-check.png`, `aged-1000-indexed-check.png`, and `aged-300-indexed-check.png` were visually inspected. The performance results are scoped runtime checks of older fixtures, not a fresh long-campaign acceptance run.

## Remaining work

Continue bounded profiling of long external route searches for the mature 1,000-person case, preserving the failed samples. Check how a player changes an acknowledged emergency recovery choice when all nearby supplies are inaccessible; this pass fixes assignment behavior, not new decision controls. Tree occlusion and overlapping squad flags remain visual limitations. No major systems or neural training should start under the current narrowed request.

15:57 UTC cleanup: closed only QA browser `frontlines-targets` and stopped verified FRONTLINES preview PID 20788 on port 4174. The user-facing Vite PID 35696 on port 4173 remains running and returned HTTP 200. No training is running. Heartbeat remains active within the original deadline.
