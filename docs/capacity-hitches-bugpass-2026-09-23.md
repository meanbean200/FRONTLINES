# Trench capacity rebuilding and construction playthrough — 23 September 2026

## Scope and change

19:11 UTC heartbeat: local bugs, existing-mode playthroughs and small polish. No new systems, agents, publishing, spending or neural training. Original 21:45 UTC stop boundary remains unchanged; saves and prior/failed evidence are preserved.

Profiling confirmed that capacity rebuilds allocated a separate owner map plus temporary value arrays for almost every half-metre floor cell. `CapacityCells` now keeps single-owner cells lightweight and allocates an owner map only when disconnected components actually overlap. `TrenchNetwork.measureCapacity()` retains its existing scanline geometry, conservative area model, insertion order and floating-point arithmetic. No larger capacity, coarser ticks, reduced collision checks, deferred rebuilds or changed duty scheduling.

Rules remain **deterministic-9**; save v2 and observation v2 are unchanged. **1,000-person performance remains below target.**

## Verification and identity

- Four new tests compare the accumulator with the original full-map implementation: overlapping/repeated contributions, owner order, signed coordinates, zero/tiny cells and 80 seeded sequences of 1,200 updates each. Area totals match exactly, not approximately.
- The work-count regression first failed on the extracted original algorithm: **2,001 owner-value iterator requests** for 1,000 single-owner cells, versus a threshold of 10. The optimized implementation passes without changing the assertion.
- **173 tests / 26 files pass**, two workers, 20.56 seconds. Existing crossing/loop/unfinished/overlap, complex engineer queues, saves, inventory, speed-history and 72-hour loop-network tests remain green.
- Production build passes: `dist/assets/index-MgM8Ff_1.js`, **688.61 kB / 187.90 kB gzip**, SHA-256 `3d2a8fd1da9ead9a719e6dd2eeaa5b94a1a1ee941f300ef9dafd2adef895d28c`. Existing >500 kB advisory remains. Ground/navigation workers and CSS are unchanged.

## Matched CPU continuation

Actual TypeScript simulation via `scripts/profile-garrison-hitches.ts`: 600→700 simulation seconds, original fixed ticks at 5×; 100-simulation-second / 45-wall-second cap. Input is the preserved older 1,000-person fixture `output/deterministic-1000-aged.json`, SHA-256 `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`.

| Measurement | Before | After |
|---|---:|---:|
| Simulation wall time | 17,969.68 ms | 16,050.00 ms |
| Largest five-tick call | 505.30 ms | 466.43 ms |
| Capacity self-samples, including new helper | 2,517.78 ms | 1,534.55 ms |
| Garbage-collection self-samples | 1,628.77 ms | 626.72 ms |
| External searches / failures | 94 / 70 | 94 / 70 |

Both complete final-state hashes equal `7d32d2505ddc1c8bc39f2d42b0198928e08f0bc6eee01ab4c6b1e7991edc0d96`. Inventory error is zero except fuel rounding <1.6e-11. This preserves the matched history and all serialized state; it does not prove universal or browser-worker determinism. Profiling noise/JIT effects apply; the measured improvement is not a guaranteed whole-game ratio.

Artifacts: `output/capacity-hitches-before-r1.json`, `capacity-hitches-after-r1.json` and matching `.cpuprofile` files. Repeated failed approaches and global coordination remain unchanged.

## Production browser performance

Isolated headed Edge, 1440×900, DPR 1, Balanced, camera (-2690, -1130), distance 240. Five-second warm-up, 20-second RAF sample, actual speed/pause controls, no debug advancement and no concurrent headless experiments during measurements. Older fixtures were **not freshly aged under rules 9**.

| Soldiers / garrisons / trucks | Build | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---|---:|---:|---|
| 1,000 / 10 / 4 | Before `BzB2S0bZ` | 5× | 121.6 ms | 467.9 ms | 80.25 s / 20.1241 s |
| 1,000 / 10 / 4 | Final `MgM8Ff_1` | 5× | 103.2 ms | 419.1 ms | 85 s / 20.0738 s |
| 300 / 3 / 4 | Final `MgM8Ff_1` | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0028 s |
| 300 / 3 / 4 | Final `MgM8Ff_1` | 5× | 6.2 ms | 12.2 ms | 100 s / 20.0006 s |

**300 passes** the scoped p95 target with full advancement. **1,000 still fails** p95 <16.7 ms and sustained 5×. More completed simulation shifts the measurement window; do not pool windows or claim large-camp acceptance. The 300-person input hash remains `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`.

Metrics: `output/playwright/capacity-1000-before-r1.json`, `capacity-1000-final-r1.json`, `capacity-300-final-r1.json`. Matching before/final 1,000 and final 300-person 5× screenshots were inspected; 300-person 1× screenshot is also retained.

## Construction playthrough

Continued the preserved ordinary sandbox browser state at **440.85 seconds** from `output/playwright/hitches-sandbox-supply-r1.json`, without changing stocks, needs or construction. Actual roster double-click and 5× for 55 wall seconds, then Pause, reached **715.85 seconds**:

- Rest dugout and its connector **complete**, with materials delivered and consumed. First complete trace sample is 670.60 seconds (not an exact completion-tick claim).
- Meal bay materials delivered; connector 33.68% excavated. Meal bay itself is **not yet complete** at this point.
- **28/28 active**, 7/7 watch, capacity increased from 57 to 62 as connected usable floor grew.
- Ledger error zero except fuel rounding <1.4e-11; no hidden replenishment or changed mortality setting.

`output/playwright/capacity-sandbox-construction-r1.json` retains initial/final states and a one-second read-only trace. The corresponding screenshot was inspected. Ordinary Load before the playthrough exactly restored the isolated initial save, which remained unchanged through this first construction segment.

An attempted early read of the construction artifacts occurred while their browser command was still running and returned file-not-found. After waiting for completion, the JSON and screenshot were read successfully. No game failure or evidence replacement. A guessed UI filename was resolved with file discovery to `GarrisonPanel.ts`.

### Save during construction, then night

Saved the paused 715.85-second construction state using the actual Save button in the **isolated QA profile**, then loaded it and verified exact JSON equality. The earlier test-only initial save remains preserved in `capacity-1000-before-r1.json`; real user saves were never accessed.

A further actual 5× / 55-wall-second segment reached **991.10 seconds / campaign 21:12**. Rest and meal facilities are complete; the supply store is 60.72% complete, with materials paid. **17 asleep, 7 watching, 2 walking to sleep and 2 hauling; all 28 active**, capacity 69, supply incident clear. Ledger error remains zero except fuel rounding <1.6e-11. The store is not claimed complete. This is an observed evening transition, not a complete-night sleep-duration acceptance test.

Artifact `output/playwright/capacity-sandbox-night-r1.json` retains the actual saved starting state, trace and final state. `capacity-sandbox-night-r1.png` was inspected: night lighting remains readable, facilities/stocks are visible in the open inspector, and the central playfield remains clear. The mid-construction save stays unchanged during the continuation.

### Night alert and return to routine

Using the actual Readiness dropdown, selected Alert, ran 5× for 25 wall seconds and paused at **1,116.10 simulation seconds**. The snapshot has **17 present / 14 required watch**, six sleeping, three walking to watch, one walking to sleep and one eating. This is an observed temporarily overstaffed snapshot, not an exact 50% staffing or continuous-coverage claim. Thirteen sleep interruptions were recorded.

Selected Routine and repeated the same run to **1,241.10 seconds / day 2, 00:32**. **7/7 watch, 16 sleeping**, four walking to watch and one walking to sleep; sleep interruptions total 17. All 28 remain active throughout these sampled states. Ledger error is zero except fuel rounding <1.6e-11. Ordinary Load then exactly restored the unchanged mid-construction save at 715.85 seconds.

`output/playwright/capacity-night-alert-r1.json` preserves the three complete sampled states and exact-load flags. Both alert and routine screenshots were inspected; readiness and watch/sleep counts remain legible at night. Final browser console: **0 errors / 0 warnings**. This checks a single night drill and its recovery, not a full-day duty or rest-quality acceptance study.

## Remaining work

1. All-garrison coordination after local excavation and repeated failed external routes remain measured hotspots; this fix does not alter their behavior.
2. Fresh rules-9 aging, later crowded-camp histories and browser-worker timing remain outstanding. The existing test soak is not fresh 1,000-person campaign acceptance.
3. Continue longer night routines and verify supply-store completion using preserved states. The night drill restores routine staffing, but overshoot and interrupted rest merit longer observation before any scheduling change. No training or major systems under the narrowed request.

The playtest skill drove real-control construction/save checks and screenshot review. Three.js guidance kept the optimization in the simulation model, required profiling before edits, and kept render state out of saves. Subjective believability remains the user's acceptance step.

## Cleanup

19:25 UTC: closed only isolated QA browser `frontlines-capacity` and stopped verified preview PID 30216 on port 4174. Its preview session exits with code 1 after the deliberate stop, not a game failure. User Vite PID 35696 on port 4173 remains healthy (HTTP 200). Production bundle hash was rechecked; no source changes followed the passing build. Saves and prior evidence remain intact. Heartbeat continues within the original 21:45 UTC boundary; no training is running.
