# Carrier return routes and withdrawal readouts — 23 September, 16:41 UTC slice

Local bug/playthrough/polish scope only. No training, new systems, publication, user-save changes or deadline extension. The heartbeat still stops at **21:45 UTC / 4:45 PM America/Chicago**. Actual browser checks used an isolated headed Edge profile (`frontlines-return`) and production preview port 4174; the user's server remains on 4173.

## Fixed

### Loaded carriers stuck despite a usable return route

The preserved older 1,000-person state `output/playwright/aged-1000-profile-state.json` reproduces the problem. Carrier 806 reached pickup at approximately (-1855.80, -1313.00), carrying 7 food, 8 water and 1 material. His stored outward route included the entrance at (-1860, -820). Every segment of its reversed external portion passed the current collision checks, but a fresh bounded navigation search failed to find a return. In the old production build, running real 5× controls advanced from 652.60 to 662.10 seconds without moving him or changing his pickup stage. Screenshot: `output/playwright/return-carrier-before.png`.

An arrived pickup now first tries the reverse of its actual saved approach. It must contain the current entrance; every segment is checked again from the soldier's actual position against current terrain and trench geometry with the existing clearance rules. New obstructions reject the trace and fall back to the existing search. Missing entrances do not authorize a direct shortcut. Cargo remains with its carrier, and assignments do not teleport him. No extra save fields or timers were added.

Final production browser repeat advances to 672.85 seconds: carrier 806 is returning at (-1871.22, -1280.13), stage `deliver`, with the same cargo. The route traverses the validated exterior approach and then the trench route. Artifact: `output/playwright/return-carrier-after-state.json`; inspected screenshot: `return-carrier-after.png`. Resource balance is zero except fuel floating-point error below 1.6e-11.

This fixes the reproduced needless re-search/stall when a valid pickup trace exists. It does **not** establish the precise reason the original grid search fails, solve arbitrary pathfinding, or certify completed delivery for every large-camp carrier. Return trajectories deliberately change, so rules are now **deterministic-7**.

Four regressions cover valid trace reuse when a fresh search fails, rejection/revalidation after a new trench obstruction, missing-entrance rejection, and identical actual continuation across a mid-pickup save/load. The first two initially failed before implementation. One test then encountered an existing timed carried-ration break; its hunger/thirst fixture was lowered to isolate route invalidation. No collision or inventory assertions were relaxed.

### Withdrawal panels showed the wrong supply location

Loading the previous slice's completed withdrawal exposed empty trench-cache stock and a local-exhaustion warning while 24.5 food and 44.5 water remained at the withdrawal point. Pure presentation helpers now choose the relevant stock location without changing inventory. Withdrawn garrisons show physical arrival counts and forward-point endurance; real stock exhaustion and critical access warnings remain visible. Selected squads show withdrawal progress, and their flags say WITHDRAWAL. Trench duty/readiness prompts are suppressed during an explicit withdrawal.

Clarification of the preceding report: the old selected squad actually read **0/8 sheltered**, with saved cover `open`. No stale physical-cover bug was confirmed. The fix replaces contextually confusing shelter/network labels, not cover simulation.

Final browser verification loaded the preserved campaign through **Load saved campaign** and matched its full state byte-for-byte. The panel reads **16/16 at supply point**, Food **24.5**, Water **44.5**, and **15.3 campaign hours** of endurance; the selected squad reads **8/8 at supply point**. At 390 × 844 the inspector client/scroll widths both remain 158 px, with no horizontal overflow. Screenshots `withdrawal-hud-before.png`, `withdrawal-hud-after.png` and `withdrawal-hud-narrow.png` were inspected. Three new tests cover separate stock locations/nonmutation, genuine shortage/access warnings and actual arrivals rather than mere assignments.

## Verification and identity

- **149 tests / 22 files pass**, 19.43 seconds with two workers. This includes existing needs, recovery, inventory, navigation, complex engineer, combat, save/load and supplied 72-campaign-hour loop-soak checks. It is not a new 300/1,000-person aging/72-hour acceptance run.
- Production build passes: **`index-CUXSpBbD.js`**, 687.46 kB / 187.43 kB gzip; SHA-256 `7ef1bef6bb2be3312c402d3662cde5ea97d98c7144c19ebcb16cc2c5c63bac6c`. CSS remains `index-CG30qDIA.css`. Existing >500 kB bundle advisory remains.
- Rules **deterministic-7**; save v2 and observation version 2 / size 32 unchanged. No neural model trained or adopted.
- Six actual-simulation operation continuations with intermediate save/load retain the prior outcomes: offensive wins at 361.80 / 352.45 / 361.25 seconds; hands-off defense loss / win / loss at 372.00 / 345.80 / 373.25 seconds. Maximum ledger error <1.7e-11. Artifact `output/operations-return-r1.json`; source hash `941d5ceeb28bbfa5ad7004d8587a152ddd5be61bd34665b34748f2a48e49db0a`.
- Real browser smoke checks started both existing operation modes, paused, selected Able and issued Hold. Defense also advanced at 5× during preparation. The saved withdrawal campaign survived both new-mode starts and loaded byte-identically. Screenshots `return-fix-offensive-smoke.png` and `return-fix-defense-smoke.png` were inspected. These are mode-transition smoke checks, **not additional completed browser battles**. Final browser console: **0 errors / 0 warnings**.
- Playtest/Playwright guidance drove ordinary browser controls, screenshot inspection and retained failed evidence. UI guidance kept the change in the existing compact panel; Three.js guidance kept presentation separate from simulation truth. Subjective readability and believability remain the user's acceptance step.

## Performance: scoped improvement, unresolved thousand-person limit

The bounded route diagnostic uses the same older captured state as the preceding slice, SHA-256 `db342e35f0c66e4741770bf49e003ace2ffeff62ead297139d9daa7f779fb800`. Twenty actual simulation steps now issue **5 searches / 0 failures**, compared with the preserved prior **18 / 13**. Navigation takes 92.57 ms and total continuation 662.01 ms. Artifact: `output/aged-route-profile-return-r1.json`; final state hash `9cd727383581d6727fde2cc2c567076a3b296ac07c7b803229e367fcfd1c5793`. State differs intentionally because carriers now return. Prior timings overlapped tests; these instrumented figures are diagnostic, not a controlled browser speedup claim.

Current browser measurements: headed Edge, 1440 × 900, DPR 1, Balanced, camera (-2690, -1130), distance 240. Each restores an older eight-campaign-hour fixture, warms five wall seconds, then samples RAF for about 20 seconds. No headless test/benchmark overlapped these samples; no pending emergency paused them.

| Soldiers / garrisons / trucks | Speed | Elapsed simulation start → end | Wall time | Frames | p95 | Worst |
|---|---|---|---:|---:|---:|---:|
| 300 / 3 / 4 | 1× | 605 → 625.05 | 20,001.9 ms | 3,293 | 6.2 ms | 6.2 ms |
| 300 / 3 / 4 | 5× | 625 → 725 | 20,005.8 ms | 3,293 | 6.2 ms | 12.2 ms |
| 1,000 / 10 / 4 | 5× | 625.25 → 693.75 | 20,261.8 ms | 1,148 | 48.7 ms | 716.9 ms |

The scoped 300-person checks pass p95 <16.7 ms and full simulation advancement. **1,000 still fails**: 68.5 simulation seconds instead of approximately 101 expected. The previous slice advanced only 41.25 seconds, but changed return behavior and measurement phase prevent treating the timing difference as a controlled fixed-state benchmark. Screenshots `aged-300-return-check.png` and `aged-1000-return-check.png` were inspected; metrics are `output/playwright/aged-300-return-metrics-r1.json` and `aged-1000-return-metrics-r1.json`.

Fixture provenance, not fresh deterministic-7 aging:

- `output/deterministic-300-aged-final.json`: SHA-256 `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`.
- `output/deterministic-1000-aged.json`: SHA-256 `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`.

### Longer return diagnostic stopped incomplete

New `scripts/verify-return-continuation.ts` runs the actual TypeScript simulation with a 45-wall-second / 400-simulation-second cap and preserves full final state and ledger. It does not answer emergency decisions or extend its budget. `output/return-continuation-r1.json` stopped after finishing the current tick at **45.61 wall seconds**, only **59.25 simulation seconds** later (elapsed 711.85). Carrier 806 had started returning at 652.85 and remained walking, unblocked, healthy and carrying the same 7/8/1 supplies at (-1901.33, -1215.91). No emergency was pending; inventory remains balanced below 1.6e-11.

**Full-trip completion is not verified by this run.** Its per-tick state instrumentation is included in elapsed time, so it is not a performance benchmark either. The incomplete artifact is retained, and the diagnostic was not silently extended.

## Next bounded checks

1. Profile the later saved 1,000-person state (the continuation artifact's `.final`) to distinguish remaining failed searches, congestion and scheduling cost. Preserve cargo and validate all route changes against live geometry.
2. Check physical end-to-end returns where no usable outward trace exists and during intervening support construction. Do not call return initiation proof of arrival.
3. Continue existing-mode controls/save transitions and small inspector issues; no new systems or training. Fresh large-camp aging remains an explicit outstanding verification item.

16:54 UTC cleanup: closed only isolated QA browser `frontlines-return` and stopped verified owned preview PID 37128 on port 4174. User Vite PID 35696 on 4173 remains running and returned HTTP 200. All saves and prior/failed evidence remain intact. Heartbeat remains active within the original deadline; no training is running.
