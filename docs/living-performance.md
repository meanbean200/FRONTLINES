> Superseded by the September 23 deterministic-garrison brief. This is historical evidence, not current certification. See [current acceptance](deterministic-garrisons.md). The study is stopped; no neural model was adopted or installed.

# Browser performance measurements

## Historical frozen living-3 results

Source hash: `b5bd113e261d80ef19b8bf2cb056e58e9ce529c26dedb2f3d3f05e4accad9f57`. Same PC, Edge 1440 × 900, Balanced rendering, five seconds warm-up plus twenty seconds of requestAnimationFrame samples. Local CPU training was concurrent. Frame cadence is measured, not just JavaScript execution time. September 23, 2026.

| Fixture | Speed | Samples | p50 ms | p95 ms | p99 ms | 16.7 ms p95 target |
|---|---:|---:|---:|---:|---:|---|
| Fresh 300 / 3 garrisons / 4 trucks | 1× | 3293 | 6.1 | 6.2 | 6.2 | Pass |
| Fresh 300 / 3 garrisons / 4 trucks | 5× | 3293 | 6.1 | 6.2 | 6.2 | Pass |
| Aged 300, after 8 campaign hours | 5× | 3239 | 6.1 | 6.2 | 12.1 | Pass |
| Fresh 1,000 / 10 garrisons / 4 trucks | 1× | 3257 | 6.1 | 6.2 | 12.1 | Pass in short fixture |
| Fresh 1,000 / 10 garrisons / 4 trucks | 5× | 2764 | 6.1 | 12.2 | 30.4 | Pass in short fixture; spikes remain |
| Aged 1,000, after 8 campaign hours | 1× | 2633 | 6.1 | 18.2 | 24.3 | **Stress target not met** |
| Aged 1,000, after 8 campaign hours | 5× | 1692 | 6.1 | 30.3 | 60.8 | **Stress target not met** |

All rows retained the requested simulation speed, with no emergency pause. The aged 1,000-person check advanced only 114.5 simulation seconds during approximately 25 real seconds at requested 5×: frame-time clamping also slows simulation under that load. The 300-person aged fixture advanced the expected 125 seconds and had zero deaths. A passing short fresh fixture is not evidence that sustained 1,000-person play meets the target.

The first fresh 1,000 / 5× attempt measured 18.4 ms p95 while an additional CPU-profile process overlapped it. That result is retained here as a contaminated-load diagnostic; the 12.2 ms repeat removes the extra profile load. The aged measurement is not discarded: it exposes persistent congestion costs.

The optimization replaces full-world neighbor scans in avoidance/detours with bounded spatial queries, preserving movement clearance checks. The separate headless 1,000 / 5× profile now takes 4.85 seconds for 500 steps, versus 13.37 seconds on living-2. Mean step cost is 9.70 ms and p95 step cost 20.37 ms. These are simulation step timings, not browser frame percentiles. Raw profile: `output/living-v3-1000.cpuprofile`.

The integrated living-3 learned-101 export was also checked at 300 soldiers / three garrisons / four trucks / 5× through QA-only model routing: 3,292 samples, p50 6.1 ms, p95 6.2 ms, p99 6.2 ms. All three garrisons used its pinned model identity rather than fallback; endpoint warm inference was 0.1 ms. The 100-person garrison workload is outside the training distribution, so this checks cost and integration, not learned behavioral generalization.

`scripts/prepare-browser-fixture.ts` creates the reproducible aged states without rendering; it records stock balance and any predeclared hold-and-ration decisions. The 300- and 1,000-person fixtures both reached 600 simulation seconds with no emergency decisions, no deaths, and inventory residual below 1.6e-11. They do accumulate crowding and watch gaps; this is a performance workload, not a routine-quality acceptance test.

## Historical living-2 baseline

Local Microsoft Edge, headed Playwright CLI, 1440 × 900 viewport, Balanced rendering, September 22–23, 2026. Frozen `living-2` simulation (`d9dd1299c6e458181b1a0fc84c60325270c1b6983e1cfea9383ce409f3d4d114`). The offline CPU training process was running concurrently. Five seconds of warm-up followed by 20 seconds of requestAnimationFrame intervals per row, restoring a fresh fixture before each speed. Values are frame cadence, not merely JavaScript work time. These are controlled short measurements, not a guarantee across all cameras and terrain.

Verified hardware: Intel Core i9-12900KF (16 cores / 24 logical processors), NVIDIA GeForce RTX 4070.

| Fixture | Speed | Samples | p50 ms | p95 ms | p99 ms | Result against 16.7 ms p95 |
|---|---:|---:|---:|---:|---:|---|
| 300 soldiers, 3 garrisons, 4 trucks | 1× | 3286 | 6.1 | 6.2 | 6.2 | Pass in this fixture |
| 300 soldiers, 3 garrisons, 4 trucks | 5× | 3217 | 6.1 | 6.2 | 12.2 | Pass in this fixture |
| 1,000 soldiers, 10 garrisons, 4 trucks | 1× | 1397 | 6.1 | 48.6 | 60.7 | Stress target not met |
| 1,000 soldiers, 10 garrisons, 4 trucks | 5× | 300 | 54.8 | 127.6 | 188.3 | Stress target not met |

Each row ended at its requested speed, not an emergency pause. In the 300-soldier 5× check, the final rolling diagnostics measured 3.33 ms CPU frame work, including 1.23 ms simulation work.

A separate integrated **learned-101** check at 300 soldiers / three garrisons / four trucks / 5× produced 3,251 samples: p50 6.1 ms, p95 **6.2 ms**, p99 12.1 ms. All three garrisons reported the experimental model's pinned identity, not fallback. Warm worker inference at the endpoint took 0.3 ms. Model requests were intercepted only in the QA browser; this was a performance/integration check, not adoption.

The equivalent **hybrid-101** check produced 3,242 samples: p50 6.1 ms, p95 **6.2 ms**, p99 12.1 ms. All three garrisons used the pinned hybrid identity; endpoint warm inference was 0.1 ms. These short checks do not establish behavioral equivalence or generalization from the smaller training fixtures.

The 1,000-soldier stress fixture is visibly simulation-bound: the final rolling diagnostic measured 38.23 ms simulation work at 1× and 82.11 ms at 5×. Congested movement and rerouting need more optimization at this scale. These results replace the earlier pre-freeze measurements; the 1,000-soldier fixture does **not** meet the 16.7 ms target. The study's frozen rules were not changed to improve benchmark results mid-comparison.

The reproducible state generator is `scripts/browser-fixture.ts`. In a development browser:

```js
const { browserFixture } = await import('/scripts/browser-fixture.ts');
__FRONTLINES__.restoreState(browserFixture(300));
__FRONTLINES__.focus(-2400, -1110, 850);
__FRONTLINES__.setSpeed(1);
```

Do not benchmark only idle, unassigned soldiers or a paused simulation. Report neural inference separately from frame cadence. Avoid comparing frame means to the p95 target.

## Large-force diagnostic

`node --cpu-prof --cpu-prof-dir=output --cpu-prof-name=living-1000.cpuprofile --import tsx scripts/profile-living.ts 1000 5 25` profiles the same frozen simulation without rendering. The 500-step run advanced 125 simulation seconds in 13.37 wall seconds; mean step 26.74 ms, p95 step 49.48 ms. These are **step costs**, not comparable directly to browser frame percentiles.

The sampled CPU profile attributes approximately 10.68 seconds of inclusive work to garrison duty execution, including 2.22 seconds in local detour search. Repeated distance calculations and nearby-occupant queries are prominent. Next optimization work should reuse spatial neighbor queries and reduce redundant distance/nearest-edge work while preserving movement outcomes. The profile is diagnostic evidence, not a claim that this optimization has already been implemented. Source lines in the tsx profile are transformed; use function names rather than its line-1 locations.
