# V1 position and command pass

## Start HEAD
7229c9639763f21444629901771192bb12383d60; clean checkout and matching origin/master verified before edits.

## Player Reports
Installed weapons depend on personal equipment; connected trenches appear as separate positions; assignments disappear; R may send people to distant work; discovered enemy networks lack useful command targeting; no coordinated signal orders; UI cost and yellow line artifacts require measured investigation.

## Status and evidence boundary

Core repairs implemented; **not a complete V1 acceptance**. In particular, the normal-control coordinated-attack/capture run and the full large-network performance matrix are not passed. Subjective usability and believability remain for the player to judge.

All browser evidence below is in `output/playwright/gameplay-reset-1790368356967/`. This was a disposable headed production Edge profile at `http://127.0.0.1:4175/`, not the player's browser or storage. Play used real mouse/keyboard/menu controls; diagnostics only read state, projections and timings. CPU replays and unit fixtures are explicitly separate from browser acceptance. Failed explorations were retained. No training, cloud work, automation or deployment occurred.

## Reproduction and confirmed bugs

- Baseline `07-r-confirmed-before.json` / `08-r-confirmed-after.json`: Dog was defending completed trench 251 around (887,951). R replaced that defense with construction of job 390 around (900,1052), approximately 102 metres away. The unfinished job had actually been drawn with Baker first. The earlier unsuccessful drawing attempts (`04` / `05`) are not counted as a reproduction.
- Installed-weapon authority was conditional on the individual operator's equipment. Departure could make a completed position unusable even with replacement riflemen present. Focused fixtures reproduce the dependency; new positions were subsequently built and fired with ordinary riflemen in Edge.
- Assigning an already-defending formation to another branch called release, stripping temporary duties and crew membership. Same-network assignment now preserves these.
- An explicit crew rest order was overwritten by weapon coordination. Edge now shows the gunner asleep with both crew reservations retained and the position marked RESTING (`30` / `31`).
- The Command menu could be covered by the open position inspector. Its stacking order is corrected.
- A low camera angle produced a long inspector line through the scene/sky while paused with no shot events. Closing the inspector removed it (`camera-close-before-2.png`, `11-camera-close-no-inspector.png`). This isolates one projection artifact, not every possible yellow-line symptom.

## Weapon Ownership Change

- Completed, paid new MG/mortar positions install their weapon at the site. The existing material cost explicitly includes the installation; ammunition is separate and is never granted at completion.
- `Facility.installation` owns the weapon identity and MG firing/reload/setup state. `Facility.stock` owns ready ammunition. The soldier's personal rifle remains personal equipment.
- Any two fit eligible people may operate an installed position. Removing the gunner retains the assistant, promotes the remaining operator, and leaves the installation and stock in place. Manual/local automatic replacement is an explicit position control.
- Crew assignments survive temporary rest and supply trips. Dead or seriously wounded crew are removed from duty without removing the installed gun. No incapacitated person is forced to operate it.
- Crew must physically arrive. Local ammunition collection, return and deposit are physical transfers. MG fire and mortar launches consume the same position stock shown by the inspector and ledger.
- Firing, support coordination, enemy planning, diagnostics, sound and presentation read the installed weapon where applicable. The renderer does not create firing authority.

## Save Migration

The existing v3/world2 storage key is retained; parsing uses a copy and does not overwrite original storage. Rules version is `combat-37-position-ownership-world2`; incompatible learned policies visibly retain their rules fallback. No training is included.

New fields are optional for old saves. A legacy site does not receive a free weapon: an existing assigned equipment carrier must physically be at the post before the actual kit transfers to its installation. A transferred MG carrier becomes unarmed rather than receiving an invented rifle; the existing mortar flag is cleared. Ammunition transfers from actual inventory, never a refill. Legacy sites with absent equipment remain explicitly awaiting that equipment. Modern installations and stocks are unchanged by repeated parsing.

Position state, reports and prepared-order timestamps are validated. Tests check idempotence, inventory conservation and exact same-rules save continuation. Original incompatible-world saves are still rejected with their existing preservation notice, not rescaled.

## Trench Network Identity

Connected completed geometry now has one default picker entry, map marker and aggregated inspector. The oldest persistent segment ID is the anchor; extending it retains that ID, merging keeps the older ID, and unfinished gaps remain separate. Underlying segments and work orders are not deleted or flattened. Capacity remains the existing non-overlapping usable-floor calculation.

The inspector aggregates length, capacity, assigned/present personnel, weapons, work and supplies. Construction and reinforcement selectors, delivery destinations and emergency notices use connected names. Individual excavation jobs can still identify their physical section. No permanent soldier-owned floor slots were introduced.

Capture requires at least two selected fit people physically inside the connected floor and no active opposing defender within 18 metres. Detached defenders far away do not indefinitely own an abandoned post. Capture changes ownership, clears former individual crew/work claims, and retains guns, stocks and people at their actual locations. Regression tests cover this transition and saves; browser capture is still pending. Previously observed partial enemy identities can merge/change to the older friendly anchor as more connectivity becomes known; no alias-history/rename UI is implemented.

## Assignment Persistence

Formation defense and individual crew membership are standing assignments, distinct from watch, eating, hauling, sleeping and reactions. Reassigning to the same network no longer releases them. Explicit move/withdraw/new work orders still have authority to change assignments. A temporary inability to fire is shown as RESTING, PINNED, RESUPPLYING, MOVING TO POSITION or OUT OF AMMO rather than silently uninstalling the weapon.

## R Key Root Cause

The old shortcut searched unfinished jobs globally and chose by proximity without treating the existing defensive network or crew reservation as a boundary. The reproduced unwanted trip is removed: `14-r-after-fix.json` records refusal with unchanged defense, while the distant job still exists.

R now means eligible local continuation: an unclaimed work face within 80 metres, attached to the current network when assigned, with previously owned local work preferred. It will not steal weapon crews, active work details, building occupants or explicitly resting personnel, or redirect a movement order. The button previews the proposed job/coordinates; refusal explains why. An explicit inspector worksite selection remains a separate deliberate command. Ten automated contexts cover distant jobs, branches, reserved crew, mixed tools, buildings, rest, other networks, competing distances, save/load, and enemy work.

## Enemy Trench Targeting

Saved terrain knowledge consists of observed four-metre pieces, width and observation time—not live occupants or stocks. Environmental visibility is checked at both ends and the midpoint from one observer. Unseen excavation does not extend the remembered polyline. The operational map no longer draws all live enemy trenches. Known connected pieces share a target identity; separate glimpses of the same underlying section do not invent a connecting line.

The contextual inspector offers Observe, Suppress, Approach, Assault, Prepare assault/support, Locate and Secure & defend. Orders use remembered terrain, not hidden soldier coordinates.

**Browser limitation:** in Open Front seed 1944, eastward close-approach setup, Baker advanced through actual enemy fire from x≈-536 to x≈283 while its target was x=400. It suffered casualties and had no confirmed terrain-memory cells by elapsed 787.95 (`33`–`41`). A read-only replay found near-bank rays blocked by earth or strongly attenuated by vegetation; there is not evidence to call this a discovery-code failure. The acquisition model still needs a dedicated terrain-feature review: it currently reuses soldier-point visibility. The UI was not unlocked by injected knowledge to claim a passing acceptance run.

## Prepared / Signal Orders

Serialized per-formation intentions wait for GO; all signaled orders release on the same next fixed tick. Save/load, pause, cancellation, explicit replacement orders, unavailable/pinned status and ordinary physical movement authority are covered by tests. Support means a suppression intention, not guaranteed effective fire or an automatic mortar salvo. Hold while preparing retains existing defensive/weapon assignments. Explicitly preparing a new intention stops previous excavation rather than letting it execute early.

This first UI targets the remembered network point, with assault or suppress preparation. Independent picked sub-sections, a general drawn-route staging editor, individually staged mounted posts and richer readiness reasons remain unfinished. The three-squad normal-browser WAIT / save / GO acceptance did **not** pass because the scouting run above did not acquire an enemy trench marker. Unit tests are not a substitute for that gate.

## UI Redesign

This is a contextual cleanup within the existing field-command visual system, not a claim of a full art redesign. One network surface replaces per-section default clutter. Weapon controls show installation ownership, two crew slots, ready/local ammunition, activity and supply reasons. A filled crew picker closes; content keys avoid replacing unchanged inspector HTML. Labels continue projecting every frame—no hiding or delayed tracking to disguise lag. The GO control is only present when there are pending prepared orders. Viewport ownership was not changed.

## Yellow Line Root Cause

The reproduced inspector artifact came from connecting projected points across the camera near plane and emitting unbounded SVG coordinates. Camera projections now explicitly identify points in front; inspector and order paths are finite-checked, broken at invalid/behind-camera segments and clipped to the viewport before creating SVG paths. `camera-after-0`–`3` retain the after sweep; `camera-after-2.png` was visually inspected alongside the baseline. These are sweeps, not pixel-identical camera replays.

Shot presentation additionally refuses invalid/non-finite/out-of-world/extreme-length event geometry. This is a rendering safeguard only: it does not change shot resolution. No reproduced evidence establishes tracers or planned-trench meshes as the original source. Other possible artifacts remain unproven rather than declared universally fixed.

## Normal Play Performance

Measured in an actual Road to the Rear seed-1944 battle, 48 friendly / 64 enemy personnel, eventually 14 complete connected sections and two constructed weapon positions. Normal rendering, simulation and visibility stayed enabled. Browser timings measure rAF intervals; `webgl` measures CPU submission, **not GPU execution time**.

- Before edits: `02-baseline-normal-mission-closed.json`, Balanced/1×, 8 s sample, p50 6.1 ms / p95 6.2 ms, simulation advanced 8.0 s.
- During construction: `19-normal-building-closed-5x.json`, 8.005 wall seconds / 40.05 simulation seconds, p95 6.2 ms, max 12.2 ms.
- `20-normal-building-inspector-5x.json` has a misleading filename: first contact had returned speed to **1×**. It advanced 8.0 s in 8.002 s, p95 6.2 ms, max 103.3 ms. Do not use it as a 5× result or a matched closed/open comparison.
- `32-final-*` are preliminary matched-start reloads, p95 6.2 ms at 1× / 12.2 ms at 5×. The regression suite was running concurrently; retain them as contention samples, not the final clean measurements.
- Final isolated Balanced/High measurements, after the test runner exited, follow. Each sample reloads the same normal saved battle and reframes through normal controls. Files: `42-balanced-idle-*`, `43-high-idle-*`; 8 seconds each, 1616×888 game viewport, 14 complete sections, 112 total personnel. The main view and inspector screenshots were retained.

| Rendering | Speed | Inspector | p50 / p95 frame (ms) | Worst frame (ms) | Simulation advance (s) |
| --- | --- | --- | --- | --- | --- |
| Balanced | 1× | closed | 6.1 / 6.2 | 54.7 | 8.00 |
| Balanced | 1× | open | 6.1 / 6.2 | 48.7 | 8.00 |
| Balanced | 5× | closed | 6.1 / 12.2 | 30.3 | 40.00 |
| Balanced | 5× | open | 6.1 / 12.2 | 36.5 | 40.05 |
| High | 1× | closed | 6.1 / 6.2 | 36.4 | 8.00 |
| High | 1× | open | 6.1 / 6.2 | 36.5 | 8.00 |
| High | 5× | closed | 6.1 / 12.2 | 36.4 | 40.00 |
| High | 5× | open | 6.1 / 12.2 | 36.3 | 40.00 |

Position-UI mean CPU work was approximately 0.30–0.31 ms open versus 0.016–0.020 ms closed. WebGL CPU submission averaged 0.92–1.09 ms; simulation per rendered frame averaged 0.76–0.79 ms at 1× and 3.70–4.00 ms at 5×. These samples meet the p95 target but **do not meet a hitch-free claim**. The original baseline and later battle differ in elapsed state; they do not establish an FPS improvement. No 300/1,000-person result is inferred from this 112-person scene.

Read-only per-frame diagnostics now separate simulation, terrain presentation, units, tactical overlay, position UI, WebGL submission and HUD. Fixed-step diagnostics separate action preparation, movement, earthworks, garrison/logistics, combat, terrain intelligence and support. They are not serialized game state. Contact, logistics, building and GC sub-costs are not yet individually instrumented.

`scripts/profile-position-pass.ts` replays an actual saved browser state for 1,200 fixed ticks and separately benchmarks 1/5/15/30/60-section graph lookup. These are headless diagnostics, **not 60-section browser acceptance**. Original replay: mean total step 2.52 ms, p95 4.62 ms, max 38.30 ms; combat mean 1.43 ms, garrison max 31.59 ms. A sampled CPU profile identifies small-arms tracing and contact work among the largest costs. A defensive-position geometry cache experiment showed no useful improvement and was reverted. Before/after artifacts remain in `output/position-command/`, including identical replay hash `0577a6d0aea632dc323d5968d26751ed1fc15bee89dbb4e54c455bdf1b7bb88b`. No FPS improvement is claimed from that rejected experiment.

## Real Browser Acceptance

| Requested run | Evidence and current result |
| --- | --- |
| 12+ connected sections | **Core pass:** 12 player-drawn branch jobs plus existing main and mortar connector, all completed physically; one Network 251, 263 m, capacity 96, two weapons. `18`–`21`, later normal saves/loads retain it. Repeated open/close works; hitch-free acceptance is not claimed. |
| Constructed MG, ordinary crew | **Core pass:** new paid position 390, Able 03/04 carrying ordinary M1s; physically arrived and fired. Removed gunner, kept gun/120 rounds/assistant, assigned Able 07; promoted operator fired again after replacement. `24`, `26`, `27`. Exact full replacement → save/load → refire chain still needs a single matched run. |
| Constructed mortar, ordinary crew | **Partial pass:** position 391 built and supplied, Able 05/06 crew, real HE order, one shell consumed, flight saved/reloaded intact. `24`, `25`. Complete replacement → refire chain was not repeated for the mortar in Edge. |
| Assignment persistence | **Pass for the tested crew:** ordinary gunner physically asleep, same garrison and crew reservation, RESTING displayed (`30`, `31`). After recovery it automatically walked back to the same MG, arrived at elapsed 975.15 and showed READY at 987.40, still crew `[255,256]` (`44`, `45`). No re-selection/reassignment was issued. |
| R | **Reproduced/repaired local case:** baseline unwanted remote job vs refusal/unchanged defense `07`, `08`, `14`. Other nine contexts covered by focused tests, not ten separate Edge runs. |
| Enemy network + three-squad signal | **Not passed:** real scout failed to acquire remembered terrain before casualties/slow advance; `33`–`41`. No knowledge injection. |
| Camera artifact | **Reproduced/repaired inspector case:** before/after low-angle sweeps and automated clipping tests. Not a guarantee against every rendering artifact. |
| Performance | Normal 14-section mission measured; occasional long simulation frame remains. Full 1/5/15/30/60+ browser matrix and larger force stress not completed. |

The first Road to the Rear playthrough ended in a legitimate defeat at elapsed 1029.05 because the billet was left undefended during weapon QA. That outcome and the subsequent attempted command on the ended operation were retained; they are not a software failure or a passed mission playthrough.

## Test Results

- Full regression run: **92 files / 684 tests passed** before the final readout-only naming changes and one additional prepared-tool-queue test.
- Follow-up focused run: **12 tests passed**, including the added queue test. The initial test incorrectly expected an explicit replacement order to retain the old queue; it was corrected to assert the actual intended cancellation and zero excavation. No production behavior was changed to satisfy that assertion.
- Production TypeScript/Vite/standalone build passes. Vite still warns about the >500 kB main chunk; it is not hidden.
- Standalone packaging checks: **5 passed**.
- Disposable file-launch check: `output/playwright/file-boot-1790370803515/`, no page errors or network dependencies, embedded navigation/terrain workers, normal movement, equal saved-state hashes, refresh at 1280×720 and 1920×1080 with canvas/menu matching viewport and no overflow.

Final run numbers and final browser checks are appended below, rather than erasing earlier/failed evidence.

Final UI checks: actual Edge window resize produced 936×588 and 1896×988 game viewports (`46-layout-*`); canvas dimensions matched exactly, no document overflow, inspector stayed within the viewport and remained scrollable. The Command control was clicked successfully over the open inspector after restoring the original window (`47-command-overlap-checked.png`). `45-recovery-followup.png` and the narrow screenshot were visually inspected. Compact windows remain information-dense; this is not subjective approval of the composition.

The subsequent full run had one outdated assertion expecting shipment destination `Trench 01`; the intentional unified label is now `Network 028`. The test was updated to require the actual persistent network anchor, retaining cargo, assignment and proximity checks. No simulation rule was changed for this naming assertion. A final full rerun follows.

### Final verification / 2026-09-25

- Final simulation regression suite: **92 files / 687 tests passed**, 89.97 s. This includes two additional MG/mortar merge regressions: when formerly separate supply areas join, reassigning the existing formation must retain its actual area, crew and duty instead of moving it to the first internal area record.
- Final production build passes: `dist/assets/main-Fm_NZOvS.js`, standalone 1,236 KiB / two embedded workers. `FRONTLINES.html` SHA-256: `6b33a62b8f11e0d3f00df6ea74bfea7b5412bb82a9c9e26218e23d16be4b7677`.
- Readiness/facing controls apply to every friendly internal area in the selected connected network; watch totals aggregate them and differing settings display Mixed. These last merged-area UI changes are built and smoke-tested, not a new ordinary multi-area Edge merge playthrough.
- Final offline launch: `output/playwright/file-boot-1790371803027/`, movement, save continuation, embedded workers, no network dependencies, exact canvas/menu sizes at 1280×720 and 1920×1080; no errors.
- Main headed Edge run ended paused with 14 completed sections and one network picker entry (`48-final-browser-check.json`). `page-errors.json` is empty. The owned browser was closed; its stdin runner required Ctrl-C after normal close. The existing local preview server and player browsers/saves were left untouched.
- Performance rows `42`/`43` were measured on production bundle `main-BaDbIBAe.js`, before the final multi-area-merge repair/readout refinements. The measured scene has one internal area, but no byte-identical final-build performance claim is made. Final multi-area performance remains a gate.
- `git diff --check` passes. Evidence remains local under the ignored output directories; the implementation, reproducible scripts, report and standalone game are included in the Git handoff.

## Remaining Problems / next gates

1. Finish normal terrain discovery → three squads + support → WAIT → save/load → GO, and physical capture. Validate whether recognizing the visible trench bank needs a terrain-specific perception target while keeping intervening terrain/vegetation authoritative.
2. Finish mortar replacement firing and same-run MG replacement/save/refire browser chains. Casualty replacement/conservation currently have automated rather than new end-to-end browser evidence. Automatic post-rest return is now observed for the tested MG crew.
3. Profile and repair the occasional long simulation step before claiming hitch-free play. Run the full 1/5/15/30/60+ inspector matrix, per-system allocation/GC analysis, and 300/1,000-person stress independently. The rejected geometry cache is not an optimization result.
4. Extend staged targeting to selected remembered sub-sections/routes and explicit post-level support; the present network-point preparation UI is narrower than the full handoff.
5. Subjective interface/combat acceptance, prior mission pacing concerns and other unresolved gates from `docs/v1-gameplay-reset.md` remain open. This pass does not erase them or declare all of V1 complete.
