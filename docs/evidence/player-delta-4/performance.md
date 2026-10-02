# Player delta 4 — busy-battle performance

**PARTIAL. The 512-person 16.7 ms p95 gate is not passed.**
Normal Open Front remains 2.4 km, 72/64 personnel; this pass did not lower it.

## Method and boundary

Installed Microsoft Edge, headless, 1654 × 910 viewport; i9-12900KF / RTX 4070
host. `scripts/qa-delta4-performance.mjs` measures 15 wall seconds per row after
warm-up. rAF intervals are uncapped browser measurements, not a certification of
native-window display pacing or a physical phone. Trace recording adds overhead.
No concurrently running regression suite or other QA renderer in this ladder.

These are **synthetic authored 4 km mixed-combat saves**, not an ordinary-control
playthrough. `scripts/delta4-busy-fixture.ts` authors finite initial conditions and
advances production ticks before saving. Active-labor fixtures include actual
rifle/MG shots, support missions, smoke, moving/duty personnel, occupied trenches,
paid unfinished construction with on-site workers, and physical supply vehicles.
Each quality/speed comparison reloads identical fixture bytes; the report retains
their SHA-256. All requested people still simulate, including off-camera enemies.
The 300-person comparison is kept separate; 1000 is an additional stress case.

The fixture's two finite HE/smoke missions completed before the sampled window;
their real smoke/terrain outcomes remain, but `missions: 2` is retained mission
history, **not two airborne shells**. Continuous artillery bursts are not covered
by this ladder. Active rifle/MG exchanges, construction, movement and logistics
continue during sampling. The deliberately long synthetic operation duration
prevents benchmark termination; its huge on-screen timer is not Open Front's UI.

The first fixture versions failed to sustain active construction. They and their
results are retained locally (`baseline-fixtures`, `after-fixtures`,
`active-work-fixtures`), not relabeled as passing workloads. The final
`active-labor-fixtures` fixes that initial-condition defect. At 136 / 5× the jobs
finish during the measurement; the report shows zero unfinished working sites at
the end, not an idle initial scene. The 136 / 1x row ends with two unfinished sites
with arrived construction assignments; the larger-population rows end with 3–10.

## Full active-labor ladder

Final production build **r12**, after the HUD readout-clearance repair. Full data:
[busy-browser-r12.json](busy-browser-r12.json). Earlier r5/r11 ladders and all failed
fixtures remain locally preserved; neither rejected cache experiment ships.

| People | Quality | Requested | Achieved | Median frame | p95 frame | Worst frame | Mean tick | p95 tick |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 136 | Balanced | 1× | 1.000× | 6.1 ms | 6.2 ms | 30.4 ms | 6.03 ms | 22.5 ms |
| 136 | Balanced | 5× | 5.000× | 6.1 ms | 12.2 ms | 42.5 ms | 4.64 ms | 10.3 ms |
| 300 | Balanced | 1× | 1.003× | 6.1 ms | 24.3 ms | 85.2 ms | 19.60 ms | 67.6 ms |
| 300 | Balanced | 5× | 2.091× | 18.3 ms | 42.7 ms | 91.0 ms | 17.87 ms | 39.1 ms |
| 512 | Balanced | 1× | 1.003× | 6.1 ms | 48.5 ms | 67.0 ms | 27.62 ms | 56.1 ms |
| 512 | Balanced | 5× | 1.372× | 30.4 ms | 66.9 ms | 85.0 ms | 28.23 ms | 58.3 ms |
| 512 | High | 1× | 1.001× | 6.1 ms | 48.6 ms | 72.9 ms | 28.39 ms | 57.8 ms |
| 512 | High | 5× | 1.305× | 36.3 ms | 72.9 ms | 79.0 ms | 29.16 ms | 60.0 ms |
| 1000 | Balanced | 1× | 0.399× | 91.1 ms | 358.5 ms | 437.4 ms | 106.53 ms | 319.6 ms |
| 1000 | Balanced | 5× | 0.409× | 91.0 ms | 352.4 ms | 437.3 ms | 103.96 ms | 320.5 ms |

Per-frame/per-tick phase summaries, LOS/path counters, heap and GC are in the JSON
report. The 512 Balanced 1× row has 319,025 actual traces from 703,871 queries,
12.03 million ground samples, 2.90 million tree candidates, eight path requests,
276 shots, three ongoing worksites and one active smoke field at the endpoint.
Mean tick: visibility 10.20 ms, targeting 5.27 ms, terrain intelligence 6.50 ms,
garrison 2.19 ms, actions 2.09 ms, movement .56 ms, earthworks .31 ms. Raw phases
include nested combat/garrison subphases; do not add every phase together.
WebGL timing is CPU submission work, not a GPU-timer measurement.

At 512 / 1×, Balanced submits 303 visible people, 170 draw calls, 1,523,814
triangles and 12 particles; High submits the same people with 176 calls,
1,664,014 triangles and 58 particles. High is not silently downgraded. Both have
276 shots; separate fixed-tick tests verify quality cannot mutate simulation or
smoke transmission. Endpoint heaps are 171.9 / 189.9 MiB, respectively (starts
176.9 / 148.7 MiB); these short, GC-dependent values do not establish long-term
memory stability. Top-level MinorGC/MajorGC totals are 208.2 / 227.0 ms over the
sample, longest 7.7 / 8.4 ms.
Nested V8 GC events are not summed again.

All ten rows retained their requested speed in state; achieved speed is measured
from actual elapsed simulation time. No page errors occurred. The 512 / 5x
screenshot shows the new actual/requested readout clear of the combat alert.
At the wide benchmark zoom the High difference is restrained; close impact/smoke
screens from the ordinary playthrough provide the more useful visual comparison.

## Changes supported by measurements

- Reused exact geometry and live ID lookups; bounded ray/section caches.
- Indexed trees and candidates before full exact tracing; preserved accumulation
  order and live geometry invalidation. No shorter sight or firing ranges.
- Eliminated repeated all-soldier scans in cooperation/shot suppression.
- Culled off-camera presentation before expensive rendering-only visibility
  checks. Knowledge still uses the full simulation rules.
- Added optional bounded tick diagnostics and achieved-throughput HUD feedback.
  Under overload the HUD now reports achieved speed rather than just promising 5×.

The initial profiled 512 fixture averaged 136.17 ms/tick; intermediate structural
changes reduced it to 65.96, 53.06 and 46.74 ms with byte-identical serialized
states for those comparisons. A separate trench-observation cache comparison
measured 49.17 → 40.09 ms with identical state. Live-ID/cooperation changes reduced
actions from 5.03 → 2.92 ms, also with identical state. Do not combine these
different staged runs into a single exact speedup claim.

The original browser baseline used the older construction-defective fixture and
an older warm-up method: its 512 p95 was 443.5–473.9 ms and achieved rate about
.28×. It is evidence of the original expensive path, **not** an exact matched
before/after player workload or a release pass.

A further localized ray-invalidation experiment preserved exact state at 160 and
600 ticks but did not reduce trace/sample counts (601,656 traces in both 600-tick
runs). Timing 34.22 vs 33.66 ms is not persuasive; the extra complexity was removed.
The neutral experiment outputs are preserved, along with cache-correctness tests.

A numeric exact-ray-key alternative was also removed: its 600-tick state matched,
but mean tick time was 44.65 ms versus 43.52 ms for the retained string-key map,
with 606,333 versus 601,656 actual traces. Different eviction behavior and no
demonstrated gain did not justify shipping another cache implementation. The
test/profile outputs and state snapshots remain available locally.

## Still required

512 frame-spike reduction, sustained long-battle memory/GC tests, actual 5× at
larger counts, the 1000-person stress improvement, native-display and physical-
phone review, and player acceptance. The main remaining measured work is LOS /
terrain-intelligence cost; none of these gates is waived by the fast 136-person
row or by maintaining average 1× at 512.
