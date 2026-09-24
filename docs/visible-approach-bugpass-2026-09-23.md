# Blocked return searches — 23 September, 17:11 UTC slice

Local bug/playthrough/polish scope only. No new systems, training, publication, user-save changes or deadline extension. Original stop: **21:45 UTC / 4:45 PM America/Chicago**. Browser checks use isolated headed Edge `frontlines-search`, production port 4174. The user's game remains on port 4173.

## Reproduced problem and fix

The later 1,000-person state from the preceding incomplete diagnostic (`output/return-continuation-r1.json`, `.final`) exposed another return failure. Carrier **947** was at (-1390, -1340.079), carrying **7 food, 8 water and 1 ammunition**. His old outward trace crosses neighboring trench **444** near (-1384, -1151), so the previous slice's revalidation correctly refuses to reuse it. A replacement search then exhausts its existing 8,000-iteration budget: its tested nodes get no closer than **119 m** to the entrance, despite a reachable final approach.

Correction to the initial commentary: the obstruction is another camp's main trench, not an established newly dug connector. The older fixture does not establish when the invalid trace originated. No excavation chronology is inferred.

The planner now accepts a **fully checked visible final leg shorter than 180 m** for external garrison searches, consistent with its existing direct-approach shortcut and route compaction. It no longer requires reaching the entrance's immediate grid neighborhood first. Every metre of the final leg still passes existing terrain/trench collision checks, and the 8,000-iteration bound is unchanged. Sealed destinations remain unreachable. This is a viable-route search, **not a guarantee of minimum terrain cost**; rivers retain their existing cost-based treatment. Ordinary player squad search termination is unchanged.

Terrain costs are also memoized **within one synchronous search**. The cache is discarded before the next search, so excavation/world changes cannot leave stale costs. It preserves the matched continuation state exactly relative to the visible-leg change alone. No inventory, needs, carrying speed, terrain clearance, save fields or combat rules were relaxed.

Two temporary heuristic-weight experiments (2.4 and 4 instead of 0.8) did not reliably solve the failure and were reverted. Their diagnostic artifacts remain; they are not adopted behavior or comparison-study results. Final heuristic remains 0.8. Rules are **deterministic-8** because viable return routes change.

## Browser and physical delivery evidence

- Before: production `index-CUXSpBbD.js`, real 5× for 3.5 wall seconds. At **714.35 simulation seconds**, carrier 947 remains at his pickup with unchanged cargo. `output/playwright/return-search-before-state.json` and inspected `return-search-before.png`.
- After: production `index-2wMSJVWL.js`, same fixture and controls. At **727.85 seconds**, he is returning at (-1389.93, -1312.18), with the same 7/8/1 cargo. The path detours west of the obstructing trench and enters through the proper entrance. `return-search-after-state.json` and inspected `return-search-after.png`.
- Actual **Save**, advancement at 1× and **Load** restore the stored save byte-for-byte. An initial comparison with the pre-save in-memory object was false only because saving explicitly adds `policySchema` metadata; the loaded simulation fields were unchanged. This failed comparison was investigated, not suppressed.
- A separate bounded run of the actual TypeScript simulation completes carrier 947's **physical delivery** at **1052.85 seconds**, after **341 simulation seconds / 36.50 wall seconds**. The carrier is inside his network with an empty pack, active and health 100. Food/water/materials/ammunition balances are exactly zero; fuel error <1.6e-11. `output/return-continuation-search-r1.json` retains the full initial/final state and arrival/delivery events. The existing 45-wall-second / 400-simulation-second cap was not extended.

This proves this carrier's completed delivery, not every garrison's long-term safety or throughput. The preceding incomplete run remains preserved and is not relabeled as successful.

## Verification

- **152 tests / 22 files pass**, 20.34 seconds with two workers. Three added navigation regressions cover the reduced real-world terrain/trench failure, a sealed final destination, and per-search cost caching with changed avoidance on the next search. The reachable-return assertion failed before implementation.
- Existing complex engineer queues, movement, physical recovery, inventory, needs, combat, save/load and supplied 72-campaign-hour loop-soak checks pass. This is **not** fresh 300/1,000-person aging or a new large-camp 72-hour acceptance run.
- One initial full suite had 151/152 pass because the rules-version assertion was updated before the exported version. Both are now 8, and the complete suite was rerun on the settled code. No gameplay assertion was relaxed.
- Production build passes: **`index-2wMSJVWL.js`**, 687.53 kB / 187.47 kB gzip; SHA-256 `1b40ecf10484df54e196305cfe1a1d33c13d362e195420b8ce74f577fe288541`. Navigation worker `NavigationWorker-DxbOsWmq.js`; CSS remains `index-CG30qDIA.css`. The existing >500 kB bundle warning remains.
- Save v2 and observation version 2 / size 32 unchanged. No model trained or adopted.
- Six actual-simulation operation runs with intermediate save/load preserve previous outcomes: offensive wins at 361.80 / 352.45 / 361.25 seconds; hands-off defense loss / win / loss at 372.00 / 345.80 / 373.25 seconds. Maximum ledger error <1.7e-11. `output/operations-search-r1.json`, source hash `5af255be613eed1bd7645fe95a8d33f075142fbacc4046e188505e498f38bb36`.

## Profiling and performance limits

The later-state input SHA-256 is `76924d572fff85d3859449165124fce67d19302916a48d090cb62d795b6a3353`. The five-simulation-second before trace issued **44 searches / 43 failures**, taking 5,668 ms including CPU profiling. Most sampled cost was navigation, corridor tests and repeated terrain calculations. `output/return-later-r1.cpuprofile` and `aged-route-profile-later-r1.json` are preserved.

Final trace: **12 searches / 3 failures**, 813 ms total / 372 ms navigation; final state hash `2d5da8515df304a57e44a3d56d17e541355ffafb5e445cd4be149074c6efa5f0`. Artifact: `output/aged-route-profile-search-final-r1.json`. Different profiling overhead and intentionally changed routes prevent treating this as a controlled whole-game speedup ratio. Three failures remain for an outward trip from (-1860, -820) to approximately (-1855.8, -1313.01).

`output/return-search-diagnostic-final-r1.json` records the exact blocking trench and collision-valid paths in both directions. Forward terrain-cost evaluations fall from 47,681 in the original failed search to 1,231 in the final successful search; both changed search termination and memoization contribute. Intermediate `return-search-diagnostic-r1` through `-r4` and route traces remain as failed/experimental evidence.

Browser setup: headed Edge, 1440 × 900, DPR 1, Balanced, camera (-2690, -1130), distance 240. Older eight-campaign-hour fixtures, five wall seconds of warm-up, then about 20 seconds of RAF samples. No headless experiments overlap the **final** rows below, and no supply decision pauses them.

| Soldiers / garrisons / trucks | Speed | p95 | Worst frame | Simulation advance / wall duration |
|---|---|---:|---:|---|
| 300 / 3 / 4 | 1× | 6.2 ms | 12.0 ms | 20 s / 20.001 s |
| 300 / 3 / 4 | 5× | 6.2 ms | 12.1 ms | 100 s / 20.001 s |
| 1,000 / 10 / 4 | 5× | 54.7 ms | 407.1 ms | 78.5 s / 20.151 s |

The scoped **300-person target passes**. **1,000 still fails** both p95 <16.7 ms and full simulation advancement. Its previous slice advanced 68.5 seconds, but changed route behavior and sample phase prevent a controlled timing comparison; current p95 is also worse than that earlier 48.7 ms. No broad performance-fix claim is made.

Artifacts: `output/playwright/aged-1000-search-metrics-r1.json` and `aged-300-search-metrics-r2.json`, with inspected screenshots `aged-1000-search-check.png` and `aged-300-search-check-r2.png`. The first 300-person sample (`-r1`) overlapped a later headless operation check, so it was retained and repeated without that overlap. Older fixture hashes/provenance remain in the preceding [return-route report](return-routes-bugpass-2026-09-23.md); these are not freshly aged deterministic-8 camps.

The playtest skill drove actual UI checks, screenshots and preservation of failed results. Three.js guidance kept the performance repair in navigation/simulation without changing rendering quality or hiding soldiers. Subjective believability and visual acceptance remain the user's decision.

## Completed browser operation

Started **Hold the crossroads** through New operation, used real 5× and pause controls, selected Able and issued Hold. With no tactical repositioning, the defense ended in **defeat at 345.75 seconds**, with **2/48 friendly able and 20 enemy able**. The after-action reason correctly reports too few able defenders. This is a completed browser playthrough, not a win or difficulty/balance acceptance. The separate 1× headless run has a different step/command history and is not a matched browser outcome comparison.

Inspected `output/playwright/search-defense-mid.png`, the immediate terminal-frame `search-defense-result.png`, and `search-defense-after-action.png`. The immediate screenshot caught the prior HUD frame before the 200 ms UI refresh; the after-action screenshot was captured by reopening the preserved frozen result for inspection. The complete terminal state is retained in `search-defense-result-state.json`.

After Inspect battlefield, Space, Hold and a right-click destination leave the terminal simulation byte-identically frozen. The existing carrier campaign remains unchanged in storage through New operation and the entire battle; **Load saved campaign** restores it byte-identically. Final console: **0 errors / 0 warnings**. No additional UI defect was established by this playthrough.

## Next bounded work

1. Investigate the remaining outward-route failure and why unrelated excavation repeatedly invalidates costly approach searches; avoid hiding genuinely blocked routes behind stale caches.
2. Test more crowded delivery destinations and fresh aging separately from old-fixture runtime checks. Keep earlier incomplete evidence and large-camp failures visible.
3. Continue existing-mode playthroughs and small control/inspector checks. No new systems or neural training under the narrowed request.
4. Add a matched speed-continuation check before assuming that different 1×/5× operation histories have identical combat outcomes; this slice does not establish the cause of their difference.

17:26 UTC cleanup: closed only isolated QA browser `frontlines-search` and stopped verified owned preview PID 18556 on port 4174. User Vite PID 35696 on 4173 remains running and returned HTTP 200. All saves, failed diagnostics and older evidence remain intact. Heartbeat remains active within the original 21:45 UTC deadline; no training is running.
