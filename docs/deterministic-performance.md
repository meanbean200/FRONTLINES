# Deterministic garrison performance — September 23, 2026

Headed Microsoft Edge, production preview on port 4174, 1440 × 900, DPR 1, Balanced quality. Hardware verified locally: Intel Core i9-12900KF and NVIDIA GeForce RTX 4070. Camera at (-2690, -1130), distance 240. All soldiers are simulated, including off-screen garrisons; rendering retains distance detail reduction.

Each row restores the fixture, warms for five wall seconds, then measures requestAnimationFrame intervals for 20 seconds. Simulation advancement is also checked so a smooth rendering loop cannot hide a paused or lagging simulation. Headless QA overlapped part of the measurement. Artifact: `output/deterministic-performance-r6.json`; final packaged bundle `index-DJHBzXNI.js`. The earlier `deterministic-performance-final.json` is preserved as an intermediate measurement, not the final revision.

| Soldiers | Garrisons / trucks | Speed | Starting workload | p95 | Worst frame | Simulation advanced |
|---|---|---|---|---:|---:|---:|
| 300 | 3 / 4 | 1× | Eight campaign hours old | 6.2 ms | 18.2 ms | 20 s |
| 300 | 3 / 4 | 5× | Eight campaign hours old | 6.2 ms | 12.2 ms | 100 s |
| 1,000 | 10 / 4 | 1× | Freshly assigned garrisons | 6.2 ms | 6.3 ms | 20 s |
| 1,000 | 10 / 4 | 5× | Freshly assigned garrisons | 6.2 ms | 6.6 ms | 100 s |

The requested **300-soldier p95 target below 16.7 ms passes in this setup**. This is not a guarantee for other cameras, resolutions, hardware or arbitrarily complicated earthworks. Earlier same-day 300 measurements included 18.3 ms worst frames despite meeting p95; intermittent hitches remain possible.

## Thousand-person limit

The fresh 1,000-person rows are a short stress result, **not mature-camp certification**. A superseded eight-hour-old 1,000-person fixture previously measured p95 12.2 ms / worst 170.1 ms at 1×, and p95 103.3 ms / worst 255.2 ms at 5×; it advanced only 85.75 simulated seconds during the latter 20-second sample. A subsequent older revision's 1,000-person aging process was stopped after over 600 CPU seconds without completing its 600-simulation-second fixture. Its stop receipt is retained. These revisions and workloads are not pooled with the final rows, and their failures must not be hidden by the fresh result.

Exterior route searches and mature large-camp scheduling still warrant further thousand-person profiling. The current accepted scale is the scoped 300-soldier scenario, with the long-run qualifications in [the acceptance record](deterministic-garrisons.md).

## 15:41 UTC bug-pass follow-up

[Current recovery-target and performance evidence](recovery-targets-bugpass-2026-09-23.md) records a CPU-profiled exact corridor-membership index. A difficult five-simulation-second continuation dropped from 23.1 to 2.2 wall seconds with byte-identical final state. Current production `index-B0wrO2dJ.js` / rules `deterministic-5` rechecks the older eight-hour fixtures: 300 people meet p95 6.2 ms and full advancement at 1× and 5×, but 1,000 still fail (41.25 simulation seconds in 21.41 wall seconds at 5×, p95 163.9 ms, worst 1,518.9 ms). These older-fixture runtime checks do not replace fresh aging/soak acceptance or erase earlier failures. Full before/after metrics and the CPU profile are retained in `output/playwright/`.

## 16:41 UTC carrier-return follow-up

[Carrier-return evidence and limits](return-routes-bugpass-2026-09-23.md), build `index-CUXSpBbD.js` / rules `deterministic-7`, revalidates stored pickup approaches before reuse on laden returns. An instrumented five-simulation-second continuation drops from 18 searches / 13 failures to 5 / 0. State changes intentionally as carriers begin returning; prior timing overlapped tests, so this is not a controlled speedup claim.

Same browser setup and older eight-hour fixtures, with no overlapping headless tests or benchmarks:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.2 ms | 20.05 s / 20.002 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 12.2 ms | 100 s / 20.006 s |
| 1,000 / 10 / 4 | 5× | 48.7 ms | 716.9 ms | 68.5 s / 20.262 s |

The scoped 300-person checks pass; **1,000 still fails** both p95 and required advancement. No pending decision explains the deficit. Different phases and changed routes limit comparison with the previous sample. The fixtures are not freshly aged under deterministic-7. Metrics and inspected screenshots are retained under `output/playwright/aged-300-return-*` and `aged-1000-return-*`.

A separate 45-wall-second capped, instrumented continuation reached only 59.25 simulation seconds; the observed carrier was still returning with all cargo, not stalled, but had **not completed delivery**. `output/return-continuation-r1.json` preserves that incomplete result and full state. This is not a frame benchmark or completed long-run acceptance. Remaining mature-camp navigation/scheduling cost requires further bounded profiling.

## 17:11 UTC visible-approach follow-up

[Search-repair evidence](visible-approach-bugpass-2026-09-23.md), build `index-2wMSJVWL.js` / rules `deterministic-8`, fixes a replacement search exhausting its budget despite a collision-clear final approach. Per-search terrain-cost memoization avoids stale cross-world caches. The later preserved state's five-second diagnostic changes from 44 searches / 43 failures to 12 / 3; changed routes and different CPU-profiler overhead rule out a controlled whole-game speedup claim.

Final browser rows, same setup and older fixtures, with no overlapping headless experiments:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 12.0 ms | 20 s / 20.001 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 12.1 ms | 100 s / 20.001 s |
| 1,000 / 10 / 4 | 5× | 54.7 ms | 407.1 ms | 78.5 s / 20.151 s |

300 passes the scoped target. **1,000 still fails**; p95 is worse than the preceding row even though advancement improves. Do not pool these changed trajectories or call this large-camp certification. The first 300-person sample overlapped another headless check and was repeated; both artifacts remain, with `aged-300-search-metrics-r2.json` used for the final rows and `aged-1000-search-metrics-r1.json` for stress.

The new bounded actual-simulation continuation completes carrier 947's delivery after 341 simulation seconds / 36.50 wall seconds, with balanced inventory (`output/return-continuation-search-r1.json`). This does not relabel the earlier incomplete carrier-806 run as successful, or prove that all large-camp routes work. Fresh deterministic-8 aging remains outstanding.

## 17:41 UTC fixed-tick speed follow-up

[Speed correction and verification](simulation-speed-bugpass-2026-09-23.md), build `index-Bf_VZgy0.js` / rules `deterministic-9`, replaces coarse fast-forward time steps with repeated original ticks. This fixes speed-dependent simulation outcomes but does more CPU work at 5×. Same older fixtures, camera, quality and warm-up; no overlapping headless experiments:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0002 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 18.3 ms | 100 s / 20.0002 s |
| 1,000 / 10 / 4 | 5× | **315.9 ms** | **437.4 ms** | **61.5 s / 20.2461 s** |

300 passes the scoped p95 target, with occasional slower frames. **1,000 is substantially worse and still fails** both frame time and advancement. Changed tick histories prevent a controlled whole-game ratio to prior revisions; do not obscure the current failure or trade correct simulation for coarse steps. Fresh rules-9 aging remains outstanding.

Artifacts: `output/playwright/aged-300-speed-metrics-r2.json`, `aged-1000-speed-metrics-r1.json`, and inspected matching screenshots. The first 300 probe failed because its QA script read the wrong truck field; it produced no metric, was stopped, and is explicitly retained in the report. Final corrected browser console: 0 errors / 0 warnings. These runtime checks do not establish browser-worker determinism or large-camp long-run acceptance.

## 18:11 UTC supply-queue follow-up

[Queue profiling and load-view verification](queue-performance-bugpass-2026-09-23.md), final build `index-z2DqhRxU.js`, keeps rules `deterministic-9`. A conservative body/reservation broad phase removes repeated distance checks against distant camps without changing candidate order or clearance. The profiled five-second continuation improves from 1,193.71 ms to 439.26 ms with an identical complete state; a repeated unprofiled continuation matches too. This interval contains no external route searches, so other navigation hotspots remain.

Uncontended final browser samples, same older fixtures, camera/quality/viewport and five-second warm-up:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20.05 s / 20.0035 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 12.2 ms | 100.25 s / 20.0059 s |
| 1,000 / 10 / 4 | 5× | **115.4 ms** | **741.2 ms** | **69.5 s / 20.1855 s** |

300 passes. **1,000 still fails**, although p95 is lower than this slice's new pre-fix baseline of 303.8 ms. Worst frame increases from 419.1 ms; sample phases differ as more simulation work completes. No exact whole-game speedup ratio or large-camp acceptance is claimed. Final artifact: `output/playwright/queue-final-performance-r1.json`. Intermediate queue-only metrics and all old failures remain. Fresh aging and later-state CPU profiling are outstanding.

## 18:41 UTC forward-pickup follow-up

[Later-camp profiling and pickup verification](pickup-hitches-bugpass-2026-09-23.md), final build `index-BzB2S0bZ.js`, rules unchanged at `deterministic-9`. The profiled 600→700-second continuation exposed another full-camp distance scan at forward pickup berths; its conservative broad phase preserves the complete final-state hash and inventory. The 100-second profiled continuation changes from 24.25 to 23.27 wall seconds; largest five-tick call from 888.89 to 597.71 ms. Timing noise is visible in unchanged navigation cost; no precise overall speedup ratio.

Uncontended final production browser samples, same older fixtures, camera, quality and warm-up:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0007 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 18.3 ms | 100 s / 20.0022 s |
| 1,000 / 10 / 4 | 5× | **127.6 ms** | **473.8 ms** | **80 s / 20.0872 s** |

300 passes. **1,000 still fails**. This slice's pre-fix sample is p95 133.7 / worst 735.1 ms, 69 s advance in 20.0125 wall seconds. P95 changes little and is worse than the previous slice's 115.4 ms row; worst frame and advancement improve in this sample. Different completed phases prevent pooling them as a controlled whole-game ratio. Final metrics are `output/playwright/hitches-final-1000-r1.json` and `hitches-final-300-r1.json`.

Remaining measured hotspots: capacity rebuilds, all-garrison coordination after local excavation, repeated failed external routes and garbage collection. The matched continuation still has 94 searches / 70 failures. Fresh rules-9 aging and browser-worker timing remain outstanding; no new large-camp certification.

## 19:11 UTC capacity-allocation follow-up

[Capacity profiling and night playthrough](capacity-hitches-bugpass-2026-09-23.md), final build `index-MgM8Ff_1.js`, rules still `deterministic-9`. Single-owner floor cells no longer allocate separate owner maps and temporary arrays. Geometry, contribution order and floating-point arithmetic are preserved; seeded regression totals and the matched 600→700-second complete state are exactly equal. Profiled capacity self-samples drop from 2,517.78 to 1,534.55 ms, and garbage-collection samples from 1,628.77 to 626.72 ms. Overall continuation changes from 17.97 to 16.05 seconds; profiling noise prevents a precise general speedup claim.

Uncontended final production browser measurements, same older fixtures, camera, quality and warm-up:

| Soldiers / garrisons / trucks | Speed | p95 | Worst | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 6.4 ms | 20 s / 20.0028 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 12.2 ms | 100 s / 20.0006 s |
| 1,000 / 10 / 4 | 5× | **103.2 ms** | **419.1 ms** | **85 s / 20.0738 s** |

300 passes. **1,000 still fails** frame time and sustained 5×. This slice's pre-fix sample is p95 121.6 / worst 467.9 ms, 80.25 seconds advance in 20.1241 wall seconds. Completed phases differ; do not pool windows or claim large-camp acceptance. Final metrics: `output/playwright/capacity-1000-final-r1.json`, `capacity-300-final-r1.json`. Fresh aging, all-garrison coordination, repeated failed external searches and browser-worker timing remain outstanding.
