# Reliability follow-up — 23 September 2026, 14:41–14:56 UTC

Heartbeat scope: existing-mode playthroughs, reproducible bugs, and small polish only. No training, new systems, agents, publishing, or real user-save modifications. Deadline remains **21:45 UTC / 4:45 PM America/Chicago**. All browser work used isolated Edge session `frontlines-followup` and the owned production preview on port 4174.

## Fixed findings

- **Emergency pause could be bypassed.** After a supply decision appeared, setting speed advanced time anyway. `BattlefieldSimulation.step()` now enforces the pending-decision pause, the shared speed setter rejects bypasses, and speed buttons are disabled. Both direct state tampering and ordinary Space input were checked; this is not only a disabled-button fix.
- **Simultaneous shortages lost the previous speed.** The first incident recorded 5×, then the second replaced it with zero. Only the first incident now records the resume speed. Resolving one of two incidents stays paused; resolving the last restores 5×, including after save/load.
- **Combat casualties retained duty reservations.** Actual simulated shots left dead/incapacitated soldiers owning sleep/watch/aid assignments. Damage now releases duties, and the next living-system step clears stale inactive reservations from older saves. Cargo still drops through the existing conservation path; save files are not rewritten retroactively.
- **Dead soldiers permanently occupied garrison capacity.** A 48-person garrison with 24 fatalities still rejected 24 replacements. Assignment and the capacity/cover displays now count living personnel, including incapacitated troops. Bodies, membership history, and dropped cargo remain in the world. Regression first rejects over-capacity reinforcements, still rejects them when the 24 casualties are incapacitated, then accepts them after death without moving/removing bodies or changing stock totals.
- **Rendering settings disagreed.** Selecting Performance in the menu left Diagnostics on Balanced; selecting High in Diagnostics left the menu on Performance. Both views now synchronize through the renderer's setting path.
- **Defense after-action display was misleading.** It showed control points even though defense does not win on points. It now shows remaining able enemies; offensive results retain their relevant control score.

The emergency, casualty-duty, and casualty-capacity regressions were run and failed before their fixes. Initial failures remain in task output.

## Browser evidence and boundaries

**Actual defense playthrough:** normal roster selection, B and mouse trench drawing, trench-capacity click, and the 5× button. No developer advancement or health/result edits. The first trench proposal across village buildings was correctly rejected; a roughly 70 m south-side trench completed. Dog, Easy, and the Pioneer team were assigned at 227.6 seconds. At 343.6 seconds, 13/13 required guards were physically at watch, selected readiness still Routine, with the temporary under-fire response active. Victory at **418.1 simulation seconds**, **27/48 able**, **2,461 shots / 287 hits**. This used the preceding `index-Ce3k-Vg9.js` build and exposed the casualty bugs fixed in this pass; it is not a post-fix balance comparison. A QA click waited on the obsolete label `Pioneer team 8` after casualties changed it to 5; the retained timeout is an automation selector failure, not a game stall.

Saved the result with the normal menu button and retained the exact JSON in `output/playwright/followup-garrison-defense-save.json`. Loading it in the newer build produced byte-identical serialized state. Starting Sandbox, Offensive, then Defense preserved the saved bytes each time, retained High rendering, and paused time in every menu. Rendering setting synchronization passed in both directions. The defense result showed `0 ENEMY ABLE`.

**Synthetic emergency diagnostic:** `scripts/verify-emergency-pause.ts` creates two deliberately critical garrisons in the actual TypeScript simulation, exports an explicit fixture, and verifies save/resume/inventory accounting. This is not a naturally occurring supply-cutoff playthrough. In the production browser, time stayed at **0.25 seconds** through Space, the first decision, save/load, Help, and Menu. The second decision resumed **5×**, reaching 2.25 seconds after 400 ms. Both prompts used real buttons. The isolated QA save was intentionally used for this diagnostic only after archiving the defense save; real user storage was untouched.

Final build browser check loaded the recorded defense state and showed **14/25** living network occupancy instead of **24/25**. Dog's card correctly showed **7/8 able, 7/7 sheltered**. Final browser console check: zero warnings/errors. This is a short scoped check, not certification of every driver or long session.

Screenshots in `output/playwright/`, visually inspected:

- `followup-defense-preparation.png`
- `followup-garrison-under-fire.png`
- `followup-garrison-defense-result.png` (before result-stat polish)
- `followup-defense-result-polish.png`
- `followup-emergency-paused.png`
- `followup-casualty-capacity.png`, `followup-casualty-capacity-r2.png`

## Final verification

- **112 tests / 15 files passed**, 16.96 seconds. Includes the existing 72-campaign-hour loop-network soak and exact save continuation, plus seven new emergency/casualty regressions.
- Production build passes: `index-D_jcRfRK.js`, 683.23 kB / 186.12 kB gzip. SHA-256 `86e8d6d51860a1bd4ad0ce05fc2e555b8a773a327b5d394f33ecc92cbe219a17`. The existing >500 kB advisory remains.
- Rules identity advances to **`deterministic-3`**. Observation version/size and save-v2 shape are unchanged. No new neural policy or training evidence exists.
- `output/operations-followup-r2.json`: six actual-simulation runs, three seeds per mode with intermediate save/load. Offensives win at 361.80 / 352.45 / 361.25 seconds; hands-off defenses lose / win / lose at 372.00 / 345.80 / 373.25 seconds. Results match the prior scripted operation baseline; maximum ledger error below 1.7e-11. Source hash `62df40e00bda9c5712184cb2a2d96eabfdf65bb13bfb57fa31e8516f4351d88b`. Earlier r1 is retained.
- `output/emergency-pause-followup-r1.json`: rules-tagged diagnostic fixture, exact 5× resume and zero ledger error. Generated outputs refuse pre-existing target names. CLI sandbox did not expose Node imports for exporting browser state; those failed attempts are retained, and the state was instead saved via a browser download.

## Remaining risks / next work

No new mature 300/1,000-soldier performance claim. Difficulty and believability still require player review. The browser defense covered daytime under-fire routines, not a long night/supply-cutoff combat campaign. The emergency diagnostic tests authority and continuation, not a complete physical emergency recovery trip. Next useful bug-only checks: interrupted physical recovery/withdrawal, async route/load boundaries, and aged crowded-camp profiling. Minor visible polish issue: the expanded garrison inspector can show horizontal overflow with long policy-score text; investigate its wrapping without increasing HUD obstruction.

Game Playtest/Playwright drove real input and mandatory screenshot checks. Three WebGL Game kept gameplay fixes in the simulation and presentation synchronization in the UI/renderer boundary. No game rules were implemented in renderer objects.
