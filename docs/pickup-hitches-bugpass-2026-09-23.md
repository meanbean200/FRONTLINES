# Forward pickup queries and later-camp hitches — 23 September 2026

## Scope and result

18:41 UTC heartbeat: bugs, existing-mode playthroughs and small polish only. No new systems, neural training, agents, publication or spending. Original 21:45 UTC stop boundary unchanged. All prior saves and evidence retained.

The forward truck-pickup reservation query repeated exact distance checks against every distant camp for every candidate berth. It now uses the same conservative body/reservation broad phase already verified for trench supply queues. Candidate order, obstacle/river exclusions, exact clearances, dead-body exclusion, distant incoming reservations and same-tick mutation visibility are unchanged. No persistent reservation cache or relaxed physical constraints.

Rules remain **deterministic-9**, save v2 / observation v2 (32 inputs). This is a scoped optimization, **not a fix for all 1,000-person lag**.

## Regression and production identity

- Added two forward-pickup integration regressions to `src/garrison/DutyReservations.test.ts`. The original implementation passes the choice/terrain test but fails the work-count test with **28,594** exact distance calls against a threshold of 2,000. Both pass after the change; no assertion was weakened.
- Existing randomized broad-phase comparisons, boundaries, distant reservations, deaths/incapacitation and live mutation tests remain green.
- **169 tests / 25 files pass** with two workers, 22.68 seconds. This includes complex engineer queues, needs, physical logistics, saves, 72-hour loop-network soak, operations and speed-history regressions.
- Production build passes: `dist/assets/index-BzB2S0bZ.js`, 688.23 kB / 187.76 kB gzip, SHA-256 `2882d010c5fb25139a9380152914a7fd2295460278bcc26a75c3d01a2684d60c`. Existing >500 kB bundle advisory remains. Navigation/ground worker identities are unchanged.
- Changed runtime source `src/garrison/GarrisonSystem.ts` SHA-256 `e185125c48fd11e94876bd9c015dc378c940c4d96699dc44c8aa430eeeb67cb4`.

## Later-state CPU evidence

New diagnostic `scripts/profile-garrison-hitches.ts` advances the **actual** fixed-tick TypeScript simulation, with a 100-simulation-second / 45-wall-second cap. It records searches, per-call wall times, complete final state and accounting; it does not change routes or rules. New evidence files are exclusive-created.

Input: preserved older 1,000-person fixture `output/deterministic-1000-aged.json`, SHA-256 `826b043e04024c4260b7ed9940f1e2647904d89b492a074dfba739bad223ac8f`. Both profiled runs advance 600 → 700 simulation seconds at 5×:

| Measurement | Before | After |
|---|---:|---:|
| Simulation wall time | 24,252.76 ms | 23,271.38 ms |
| Largest five-tick call | 888.89 ms | 597.71 ms |
| Navigation searches / failures | 94 / 70 | 94 / 70 |
| Navigation wall time | 5,311.72 ms | 6,333.31 ms |

Both **complete** final-state hashes are `7d32d2505ddc1c8bc39f2d42b0198928e08f0bc6eee01ab4c6b1e7991edc0d96`. Inventory error is exactly zero except fuel rounding <1.6e-11. This demonstrates identical state in the matched interval, not universal/browser determinism. Timing noise and CPU-profiler/JIT effects are visible even in unchanged navigation cost; no precise whole-game speedup ratio is claimed.

Artifacts: `output/later-hitches-before-r1.json`, `later-hitches-pickup-r1.json`, and matching `.cpuprofile` files. Before self-samples identify `forwardServicePoint` and its nested scans; after removing them, expensive capacity rebuilding, coordination, search and garbage collection remain. Repeated failed outward approaches include (-1860, -820) → (-1855.8, -1313.01194); the optimization does **not** repair these routes.

An early attempt to read the CPU profile before its process finished returned ENOENT; the completed profile was read successfully afterward. A guessed test filename did not exist; file discovery located the existing corridor tests. Neither diagnostic mistake modified simulation or evidence.

## Browser checks

Isolated headed Edge, 1440×900, DPR 1, Balanced quality. Production preview on 4174; user Vite on 4173 left running. Same old fixtures, camera (-2690, -1130), distance 240, five-second warm-up and 20-second RAF measurement, actual speed/pause buttons, no debug advancement. No overlapping headless experiments during measurements.

| Soldiers / garrisons / trucks | Build | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---|---:|---:|---|
| 1,000 / 10 / 4 | Before `z2DqhRxU` | 5× | 133.7 ms | 735.1 ms | 69 s / 20.0125 s |
| 1,000 / 10 / 4 | Final `BzB2S0bZ` | 5× | 127.6 ms | 473.8 ms | 80 s / 20.0872 s |
| 300 / 3 / 4 | Final `BzB2S0bZ` | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0007 s |
| 300 / 3 / 4 | Final `BzB2S0bZ` | 5× | 6.2 ms | 18.3 ms | 100 s / 20.0022 s |

**1,000 still fails** p95 <16.7 ms and sustained 5×. This pass's worst observed hitch is shorter and advancement improves, but p95 is only slightly lower and is worse than the preceding slice's 115.4 ms sample. More completed simulation also changes the measured phase. Do not pool changed sample windows or call this large-camp acceptance.

**300 passes** the scoped target at both speeds with full advancement. The 300-person fixture hash is `eecf8fbaca816d18ec9f95d0743c9d6cfb0dc345b6cc87115aacdd2c99a9bace`.

Metrics/screenshots: `output/playwright/hitches-1000-before-r1.json`, `hitches-1000-before-r1.png`, `hitches-final-1000-r1.json`, `hitches-final-1000-5x-r1.png`, `hitches-final-300-r1.json`, and `hitches-final-300-{1,5}x-r1.png`. Before/final 1,000 and final 300-person 5× screenshots were inspected.

### Sandbox physical delivery and save preservation

Continued the previous browser's preserved **215.85-second** sandbox state (`output/playwright/queue-sandbox-final-state.json`), without changing inventories or needs. Actual roster double-click, 5× for 45 wall seconds, then Pause advances it to **440.85 seconds**. No debug advancement. A one-second read-only trace follows physical carrier positions, cargo and stock:

- The entrance cache first contains stock in the **275.10-second sample**: 7 food / 9 water, after a carrier's physical return. This is a sample timestamp, not an exact transfer-tick claim.
- Final cache: **45 food / 51 water / 12 materials**. Other supplies remain with carriers and in-world stores; no invisible refill.
- **28/28 active**, 8 present watch for 7 required during relief. Inventory error zero except fuel rounding <6e-12.
- A rest dugout is planned, **not yet built** in this snapshot. Completion of this facility is not claimed.

Artifact `output/playwright/hitches-sandbox-supply-r1.json` retains complete initial/final states and trace. `hitches-sandbox-supply-r1.png` was inspected, showing the occupied trench and unobstructed central playfield. This is a continued sandbox playthrough, not new full-day/fresh-aging acceptance.

Started both offensive and defensive modes using their actual menus, tested Pause/5×, then used ordinary Load. These are **entry/transition smoke checks, not completed combat matches this slice**. Both transitions preserve the isolated saved campaign. Final state matches its saved JSON **exactly**: 28 soldiers, elapsed 14.20 seconds, paused. The real user browser profile and saves were never used.

Artifacts: `hitches-initial-save-r1.json`, `hitches-mode-load-r1.json`, and inspected `hitches-offensive-entry-r1.png`, `hitches-defense-entry-r1.png`, `hitches-restored-save-r1.png`. Final browser console: **0 errors / 0 warnings**.

## Remaining risks and next actions

1. Capacity recomputation and all-garrison rescheduling after local excavation are now prominent measured costs. Any later optimization needs exact geometry/overlap and save-continuation checks; do not hide these costs with coarser ticks.
2. Repeated failed external approaches remain. The existing finite search budget is unchanged.
3. These old aged fixtures are not fresh rules-9 aging. Fresh longer-run aging and 1,000-person acceptance remain outstanding.
4. Browser asynchronous order timing remains distinct from core fixed-tick determinism. No browser/headless identity claim.

The playtest guidance requires real controls and inspected screenshots; the Three.js guidance kept simulation truth separate from rendering and required measurement before optimization. Subjective believability remains the user's acceptance step.

18:53 UTC cleanup: closed only owned QA browser `frontlines-hitches` (daemon PID 32748) and stopped verified preview PID 34620 on 4174. User Vite PID 35696 on 4173 remains running and returned HTTP 200. All saves, original fixtures and failed evidence retained. Heartbeat remains active within the original 21:45 UTC deadline; no training started.
