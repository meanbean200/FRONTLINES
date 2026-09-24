# Load and recovery reliability — 23 September 2026, 15:11 UTC slice

Scope remains bugs, existing-mode checks, and small polish. No new systems, agents, training, spending, publishing, or real user-save changes. The stop deadline remains **21:45 UTC / 4:45 PM America/Chicago**. Browser checks used isolated Edge session `frontlines-recovery` and the owned production preview on port 4174.

## Reproduced and fixed

- **Late navigation replies changed finished battles.** Normal and drawn-path callbacks could update an operation after its result had frozen. Both completion paths now reject replies after the operation ends. A world revision also rejects callbacks from a replaced world, including replacement with the same state object.
- **Pending saved movement stalled in a fresh simulation.** A save taken while browser navigation was planning retained an empty route and `planning` state when opened by the actual headless TypeScript simulation. A newly constructed simulation now uses the same pending-order restoration as state replacement. Completed-operation saves are deliberately not replanned. Eight asynchronous-order regressions cover both path types, stale replies, restoration, and frozen results; the initial terminal/pending-restore cases failed before the fix.
- **Load retained the old drawing gesture.** Reproduced through Save, squad selection, M, then Load: no squad remained selected, but canvas mode was still `move`. Loading now uses the shared world-replacement path, cancelling pointer/keyboard gestures, clearing previews, returning to Select, and resetting the frame accumulator. Final production-browser check changed `move` to `select` with no route preview.
- **The narrow garrison inspector overflowed sideways.** At 390 × 844, a 158 px content area had 234 px scroll width. Readiness and soldier dropdown intrinsic widths were the cause, not just the previously suspected score text. Controls can now shrink/stack and text wraps; final width and scroll width both measured 158 px. Actual Alert and Routine selections still worked. No larger HUD panel or overflow-hiding workaround was added.

Rules identity is **`deterministic-4`**; observation version 2 / size 32 and save version 2 remain unchanged. No neural model has been trained or adopted.

## Physical-trip diagnostics

`src/garrison/RecoveryScenario.ts` and `scripts/verify-recovery-trips.ts` create an explicit 16-person shortage fixture in the actual TypeScript simulation. After 75 seconds settling, all local stock and packs are physically accounted into a nearby crate; truck fuel is transferred into rear stock, delivery is disabled for the fixture, and an emergency is presented. This is **synthetic setup, not a naturally occurring supply-cutoff campaign**. Fixture-only harsh deprivation does not enable lethal needs in the normal demo. The fixture is not imported by production gameplay.

The production browser used normal decision, speed, pause, Save, Load, and squad-focus controls after importing that setup. No developer time advancement or direct duty edits were used after setup.

- **Recover nearby crates:** at 77.2 seconds the carrier was walking and crate stock remained 64 food / 96 water / 40 materials. At 134.7 seconds, a returning carrier held 5.5 food / 5.5 water / 4 materials while the entrance cache remained empty. Save/Load preserved the saved state exactly. At 149.2 seconds the carrier reached the cache and deposited that cargo. Resource balance was zero for every resource. The existing rules allowed the hungry carrier to consume 0.5 food/water from its own pack, accounted in consumption.
- **Withdraw to supply point:** the alternative fixture transfers 40 food / 60 water from the same crate into forward stock, without creating inventory. At 126.3 seconds, all soldiers were still travelling, no supplies had been consumed, and Save/Load was byte-identical. At 208.3 seconds all 16 had arrived at the apron, thirst had recovered below 80, and the ledger balanced exactly. Forward stock, carried stock, and consumption reconcile; nothing vanished or refilled invisibly.
- Two focused headless regressions additionally compare exact continuation through a laden return and withdrawal travel, and verify post-arrival consumption and conservation. These normal physical trips already worked; no logistics behavior was changed to make them pass.

Retained fixture files: `output/recovery-trips-r1.json` and `output/recovery-trips-r2.json` (r2 includes the withdrawal alternative). Generating fixtures refuses existing output names. Retained browser saves: `output/playwright/recovery-return-save.json` and `output/playwright/withdrawal-arrived-state.json`.

One initial browser equality probe compared pre-save state against post-load state and reported false because saving adds the policy-schema envelope. Comparing the actual saved JSON against the restored state produced no differences. This was a diagnostic comparison error, not a lost trip. Initial failure output is retained.

Screenshots in `output/playwright/` were visually checked: `recovery-inspector-before.png`, `recovery-inspector-after-390.png`, `recovery-emergency-before.png`, `recovery-loaded-return.png`, `withdrawal-travel-save.png`, and `withdrawal-arrived.png`. `recovery-delivered.png` is the immediate post-transfer frame, before the next HUD stock/speed refresh; recorded state confirmed speed zero and deposited stock. Trees obscure individuals in this woodland fixture, so ledger/position traces and regression assertions support the transfer claims, not silhouettes alone.

## Verification

- **122 tests / 17 files pass**, 18.80 seconds, including the existing 72-campaign-hour loop soak, engineer/movement regressions, and ten new async/recovery tests.
- Production build passes: `index-CIxL0Zn_.js`, 683.43 kB / 186.19 kB gzip. SHA-256 `d6ff96b3727c240a9d8a4b41ffdb7acbb50d3627a1a392d7f1daa34850ee88e0`. CSS `index-BqGs5vXH.css`. Existing >500 kB advisory remains.
- Final production browser used that bundle. Console: **zero warnings/errors** during the scoped checks.
- Six scripted operation runs with mid-operation save/load remain unchanged: offensive victories at 361.80 / 352.45 / 361.25 seconds; hands-off defenses lose / win / lose at 372.00 / 345.80 / 373.25 seconds. Maximum ledger error < 1.7e-11. Evidence: `output/operations-recovery-load-r1.json`, source hash `4f0c560ee90a17ce66ec09946bafbd539570e78c5162093717567ba30a304437`.

## Remaining risks / next actions

No new mature 300/1,000-person performance claim or natural long-night combat/supply-cutoff playthrough. Current tree occlusion and withdrawal squad-flag overlap remain visual limitations. Possible unreachable/far crate selection deserves a bounded adversarial test; it has not been established as a reproduced bug here. Aged crowded-camp cost remains the larger known performance gap. Continue with scoped bugs, not training or new mechanics.

Game Playtest and Playwright guided real-input verification and screenshot review. Three WebGL Game kept route fixes in simulation and input reset in the app boundary. Game UI Frontend guided the compact wrapping fix without expanding playfield obstruction. Subjective believability remains the player's acceptance step.

15:24 UTC cleanup: closed only QA browser `frontlines-recovery` and stopped preview PID 3160 after verifying its exact FRONTLINES/4174 command. The user-facing Vite PID 35696 on port 4173 remains running and returned HTTP 200. No training is running. Heartbeat remains active within the original deadline.
