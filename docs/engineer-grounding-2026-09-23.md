# Engineer floor contact and truthful trench occupancy

Direct user request after the overnight automation was paused: digging engineers are not treated as being in their trench; apply consistent logic and open a separate Edge tab. This pass does not resume the heartbeat or add new systems.

## Reproduced causes and fixes

- Terrain treated the first **currently excavated** point as an entrance. During middle-out excavation that point travels with the left working face. Its four-metre ramp left the leading pair on a shallow slope while the opposite crew stood on the full floor. The browser reproduced two digging engineers classified as forest cover, only about 0.35–0.37 m below the original surface. Five new focused assertions failed before the repair.
- Entrance slopes now belong to fixed end-started entrances, including reverse-started work. A middle-started excavation opens a pit rather than dragging an entrance ramp along either face. Depth and cover share one calculation; unfinished ground and shallow entrance slopes do not gain trench protection merely because a soldier is an engineer.
- Stationary/suppressed personnel receive refreshed cover when terrain changes, and the first simulation tick refreshes derived protection after load. Updates are revision-gated rather than a new unconditional full-army query every tick.
- Unit movement still interpolates horizontally, but feet sample the floor at the displayed position instead of interpolating vertically across its banks. The final renderer optimization keeps this to one height sample per visible soldier per frame.
- Local terrain mesh invalidation uses the same half-metre progress resolution as physical excavation, instead of trailing it in two-metre batches. Distant completed chunks remain unaffected; terrain generation stays in its existing worker.
- Selection rings now follow actual cover rather than whether `trenchId` was reserved. Trench markers separate **inside** from **assigned/capacity**, and engineers' selection details show their sheltered count. Physical presence includes living friendly engineers and incapacitated troops, excludes approaching/dead personnel and hidden enemies, and does not change garrison reservations. Counts refresh with the existing half-second graph refresh, while label positions still follow the camera every frame without fading/hiding.

Simulation rules are `deterministic-14`; observation version 2 and save version 2 remain unchanged. Existing incompatible-neural-policy fallback remains available. No training or learned model adoption occurred.

## Verification

- Full suite: **250 tests / 37 files**, including nine added terrain, renderer and occupancy regressions. Existing complex branches/loops, movement, combat, inventory, save continuation and the 72-campaign-hour soak remain covered.
- Production build passes. Existing >500 kB bundle warning remains.
- Final bundle: `dist/assets/index-CejuEkyn.js`, SHA-256 `1f449327bf46912989e568b6d0261072ce68e1f83db98b43616cc75d7ae676c5`.
- Actual headed Edge controls: select sandbox and engineers, draw a line, run at 5×, pause, inspect, Save, finish the job and Load. Gameplay is not injected. A diagnostic camera focus is used only for the close-up screenshot.
- At the repaired 96.50-second checkpoint: **8/8 digging engineers have trench cover**, each on a 1.75 m sampled cut. Label reads `8 inside · 0/29 assigned · 40%`; selection reads `8/8 in trench cover`.
- Ten live 5× samples / 80 engineer samples: no cover mismatches; maximum visible-versus-sampled floor discrepancy **0.07385 m**. Rolling frame p95 **6.1–6.2 ms** with 28 people. The full test suite ran in parallel during this small performance observation; this is not a controlled 300/1,000-person benchmark.
- All player-drawn work completed by the 221.50-second sample, with Hold and an empty work queue. Saved excavation at 96.50 seconds restores **byte-identically to the actual stored save**, with all eight cover values and physical floor probes consistent. Final-build continuation uses `index-CejuEkyn.js`.
- Browser console: zero errors and warnings.

## Evidence and retained failures

All evidence is local in `output/playwright/`:

- `engineer-depth-before-r1.json` / `.png`: original browser state and misleading left-front cover. Its camera/drawn geometry is not pixel-identical to the later run, so compare the measured ground/cover relationship, not screenshot pixels.
- `engineer-depth-after-r1.json`, `engineer-depth-after-left-r1.png`: repaired real-control play, live floor probes, UI counts and close-up. This initial browser pass used `index-CkEYMi7V.js`; the only subsequent runtime edit removed a redundant unit height sample.
- `engineer-depth-restore-inspect-r1.json` / `.png`: retained diagnostic from a faulty QA assertion. The first probe compared runtime state before Save with loaded state, forgetting that Save appends `policySchema`. Recursive comparison against the actual stored save has **zero differences**. No game-save repair was needed.
- `engineer-depth-complete-first-attempt-r1.png`: retained first completion screenshot before repeating the probe.
- `engineer-depth-continuation-r2.json`, `engineer-depth-complete-r1.png`, `engineer-depth-restored-r1.png`: final-build completed job and exact loaded checkpoint, including the full stored QA campaign.
- Probes: `scripts/qa-engineer-depth*.cjs`. Setup initially hit stale browser references, missing `URL` in the CLI VM and a HUD-overlap guard; the successful probe uses a fixed viewport and safe projection bounds. These were harness failures, not game failures.

## Handoff and limits

Separate persistent Edge session `frontlines-engineer-depth` is left open on the user's existing `http://127.0.0.1:4173/` server. It has separate browser save storage from the in-app browser. No save was copied into or overwritten in the user's existing browser. The production QA tab used separate origin 4174 and its 96.50-second save is preserved.

22:07 UTC closeout: final source suite rerun **250/250**, 26.90 seconds. Closed only the production QA tab and verified owned preview PID 14704 on port 4174. Edge tab 0 remains at the 4173 game menu; user Vite PID 35696 remains listening. No browser save was deleted.

The requested geometry/cover/display issues are repaired. Close-range art/animation quality is still an acceptance question, and large-army frame-time targets are not newly certified. No major systems, agents, publishing, purchases, destructive cleanup or unrelated configuration changes. The overnight heartbeat remains paused.
