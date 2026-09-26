# V1 player experience / autonomy pass — work record

Starting SHA: `055b9a9d4b543b832fd16ecfe393f4ef6574221b`. Remote master was verified equal before editing and rechecked before delivery.

Final implementation SHA: `34bf2d45000f4cd03abe8271e7ff11fa30b6d5e1`. This is the immutable validated source/evidence commit; the report-only descendant does not change the executable.

STATUS: **PARTIAL — not V1 ready.** The P0 repairs below are implemented and have bounded evidence. The larger AI, MG-sector, graphics, raid-completion and scale acceptance work is not complete. UI feel, camera feel, readability and artillery satisfaction remain **IMPLEMENTED / NEEDS PLAYER REVIEW**, not accepted on the player's behalf.

## Working plan and QA inventory

Use one intent-led command surface per task, the existing restrained field-command visual language, and secondary technical details. Physical inventory, crews, information and fixed-step/save authority remain in the simulation. No agents, training, automatic jobs, or unrelated rewrites.

| Workstream | Reproduction / implementation checks | Browser evidence required |
|---|---|---|
| Controls/settings | Active dropdown identity/focus; advanced values apply; paused/1×/5×; cancellation persistence | Open/change/reopen controls; heavy combat, map, narrow and DPI/iframe variants |
| Camera | Input response distinct from simulation/frame time; pan/rotate/zoom/reversal | Quiet/building/combat/5× and map transitions, motion traces |
| Command/support | Central physical gun/battery selection, mission dispatch, availability, rotation | Multiple guns from one surface; unavailable reasons, ammo, firing animation |
| Autonomy/logistics | Whole shell-demand chain, concurrent work, carriers, rest preference, crew protection, convoy reasons | Build/use and leave supplied gun alone; interrupted/blocked shipment and recovery |
| Casualties/readability | Passive autonomous response, optional priority; sleep/dead distinction | Actual combat casualties and resting troops, no permission spam |
| Vision/MG/AI | Signatures and near-range sanity, hidden physical hits without information leak, sectors, coordinated plans | Legitimate discoveries, ground fire, defended approaches, matched battles |
| Raid completion | Preserve WAIT/GO, protect home crew, physical entry/clear/capture/reorganization | 3+ formations, support, save/load, successful capture then front/rest/resupply |
| Graphics/scale | Bounded effects/LOD; 300/1,000-person limits; quality differentiation | Low/Balanced/High screenshots and separate CPU/render/camera timings |
| Shipping | Full tests/build/offline, Chromium/Edge, relative paths, iframe/fullscreen | Local hosted production + offline; real CrazyGames preview only if available |

Off-happy-path checks: cancel while a shipment is loaded; open a select while inventory/person counts change; gun becomes unavailable between targeting and firing; save/reload while a carrier is in transit; raid participants include a mixed formation with protected gun crews.

For each user report record USER-REPORTED, REPRODUCED, ROOT CAUSE, IMPLEMENTED, BROWSER VERIFIED, REMAINING. Synthetic fixtures stay separate from ordinary-input acceptance. Failed evidence is retained. Subjective improvements remain IMPLEMENTED / NEEDS PLAYER REVIEW.

## Shipping references

Checked current official [CrazyGames quality guidelines](https://docs.crazygames.com/requirements/quality/) and [technical requirements](https://docs.crazygames.com/requirements/technical/). Local checks do not establish platform acceptance. SDK/release preview status must be reported explicitly.

## Delivered command flow

**Command → Fire support → choose gun(s), battery, or All ready → choose ammunition → click one ground target.** Each physical gun independently validates its crew, stock, range and traverse. Selected unavailable guns explain why. Staff selected weapons uses actual eligible local personnel; it does not create a crew. Reserves, hand smoke and passive casualty status sit in a secondary foldout rather than preceding every fire order.

**Build → Weapon position → battery → click center → point the firing direction → confirm.** The entire preview rotates; each footprint and connector must still fit. Escape removes an uncommitted preview.

**Prepare a trench raid** excludes whole formations containing assigned weapon crew by default, with an explicit one-order override. This is deliberately conservative: individual detachment from a mixed squad is not implemented. Ordinary drawn movement remains an explicit player order, not an implicit raid-crew protection mechanism.

## Player reports: reproduction and exact claim limits

### 1. Camera movement feels laggy

- USER-REPORTED: delayed/jittery ordinary pan, rotate and zoom.
- REPRODUCED: the existing input pan used the same slow damping as a cinematic Focus transition. Focused tests measure reversal and settling; actual keyboard/middle-mouse/wheel input was captured at 5× during construction.
- ROOT CAUSE: excessive input damping is one contributor, not a diagnosis of every combat hitch.
- IMPLEMENTED: held-key pan and its short settling tail use faster damping; rotate/zoom also respond faster. Deliberate Focus keeps slower smoothing. Camera dt remains independent of simulation speed.
- BROWSER VERIFIED: `camera-real-input-5x.json`: 388 rendered samples over 3.50 s, p95 interval 12.2 ms, maximum 18.3 ms; first sampled reversed x-motion 5.8 ms after the opposite key event. These are browser event-to-sampled-camera timings, not physical keyboard/display latency. No page errors.
- REMAINING: no matched pre-change browser latency trace, no full active-artillery/large-raid camera acceptance, and no claim that this fixes main-thread combat cost.

### 2. Advanced settings do not reliably apply

- USER-REPORTED: advanced changes appear ignored or decorative.
- REPRODUCED: ordinary change handlers rebuilt the setup screen. A normal-control night/low-supply/+2-engineer launch also failed at seed 1944: 56 enemy personnel / 53 prepared places.
- ROOT CAUSE: unnecessary control replacement plus a fixed enemy prepared-trench length incompatible with the configured force.
- IMPLEMENTED: nonstructural setting changes retain their controls; relevant dependent fields update in place. Prepared enemy trench length accounts for the configured roster and sector distribution; default footprint is retained when sufficient.
- BROWSER VERIFIED: native fields retain identity; chosen advanced values are present in the launched state. New browser regression passes. Original launch error and screenshot are retained under `failures/advanced-force-capacity.*`.
- REMAINING: not every combination of every setup option was manually played through; generated setup/missions regressions provide additional, separate coverage.

### 3. Dropdowns lose clicks/focus

- USER-REPORTED: lag, failed opening/selection, apparently ignored values.
- REPRODUCED: at 5× with stand-to counts changing, the active front selector became disconnected and lost focus. A quiet-state check alone did not reproduce it.
- ROOT CAUSE: dynamic panel innerHTML replacement destroyed a native control during use.
- IMPLEMENTED: keyed DOM reconciliation and delegated handlers preserve live controls and expanded details; focused select children are not patched until focus leaves. Applied to dynamic position readouts and central support.
- BROWSER VERIFIED: before/after `baseline-live-front` / `fixed-live-front`; open native selector remains connected and focused, keyboard selection applies to the simulation and persists. Menu, 5× trench, support and viewport checks pass.
- REMAINING: the entire requested heavy-combat/map/DPI control matrix is not certified. The iframe/DPI suite verifies layout and picking, not every dropdown in every context.

### 4. UI still does not feel improved

- USER-REPORTED: previous internal changes were not a useful player improvement; acceptance remains failed.
- REPRODUCED: commanding multiple guns required per-position targeting, and reserve text displaced the useful fire controls.
- ROOT CAUSE: scattered asset-level commands rather than a shared player intention.
- IMPLEMENTED: central multi-gun/battery selection, one ground target, group crewing, truthful readiness and bounded scrolling; secondary reserve/casualty details no longer dominate the panel. Active gun inspectors now say Round in flight rather than READY with No current target.
- BROWSER VERIFIED: one normal order dispatched two ready physical guns while omitting the resting and unfinished members. Screenshots show the compact command path and final flight readouts.
- REMAINING: this is a focused command-flow improvement, not a complete redesign of every position/supply/raid interaction. It still needs player approval.

### 5. Cannot rotate batteries

- USER-REPORTED: orientation cannot be chosen before placement.
- REPRODUCED: previous placement committed on its first click with inherited facing.
- ROOT CAUSE: no orientation phase in the battery placement interaction.
- IMPLEMENTED: first click pins center, pointer chooses facing, second click validates and commits all guns. An initially invalid orientation does not prevent choosing a valid rotated footprint. Heading, arrows, footprint and validation reason are shown.
- BROWSER VERIFIED: north-ish, east, south, west and diagonal previews changed the whole layout. This particular site accepted north/south and correctly rejected other headings crossing the 4–40 m placement limits. Escape left 11 facilities / 16 trenches unchanged and removed the ghost. Exact cardinal/diagonal geometry and serialization have unit coverage.
- REMAINING: not all five headings were built to completion and reloaded in a browser. Post-build facing remains the existing physical gun command, not relocation of its earthworks.

### 6. Individual artillery control is too click-heavy

- USER-REPORTED: repeating the same target for each gun is annoying.
- REPRODUCED: one-gun action boundary and scattered inspectors.
- ROOT CAUSE: no central selection/dispatch layer.
- IMPLEMENTED: one deduplicated group command with atomic friendly-danger preflight and per-gun validation; no common magic inventory. Preparing missions can be cancelled without spending a round; a launched shell cannot be recalled.
- BROWSER VERIFIED: battery 384, guns 386 and 388, accepted one target near (700, -450). Both launched, consuming one shell each (4→3 and 2→1); both impacts completed. Guns 384 and 390 did not fire. Canonical save and loaded state during flight were deeply equal.
- REMAINING: a four-gun simultaneous ready salvo and several batteries together have not passed ordinary-play acceptance.

### 7. Artillery needs physical animation

- USER-REPORTED: static/fake-looking gun effects.
- REPRODUCED: prior field-gun geometry had no state-driven recoil.
- ROOT CAUSE: no presentation derived from the ammunition-consuming discharge.
- IMPLEMENTED: bounded barrel/upper-gun recoil and three pooled muzzle-dust particles per real shot. Queued/cancelled missions do not recoil. Each gun uses its own mission event; timing follows actual simulation timing.
- BROWSER VERIFIED: close screenshot of the real two-gun discharge and flight state retained; unit test checks real discharge, no false recoil, and settling.
- REMAINING: screenshot is not proof of satisfying motion. Dedicated handling/reload crew poses and a matched motion replay are not implemented. Broad visual satisfaction is unaccepted.

### 8. Unseen enemies should remain physically hittable

- USER-REPORTED: visibility must not grant immunity.
- REPRODUCED: no new immunity defect established in this pass.
- ROOT CAUSE: not assigned without a reproduction.
- IMPLEMENTED: existing physical shot/blast authority is retained; central support accepts ground coordinates without a current enemy contact. No new hidden casualty notification was added.
- BROWSER VERIFIED: actual ground-area battery fire with no target identity; physical shots, obstruction and information-boundary regressions remain green.
- REMAINING: no ordinary-play unseen victim was independently observed before/after this salvo. This does not certify every fog-of-war interaction.

### 9. Spotting is inconsistent, especially nearby large objects

- USER-REPORTED: a distant soldier can appear clearer than a battery about ten metres away.
- REPRODUCED: render visibility for weapons/vehicles used an imaginary person-sized point query. Focused tests exercise near, low-bank, masonry, smoke and distant-target cases.
- ROOT CAUSE: inappropriate signature/height and one-point sampling for physically large objects.
- IMPLEMENTED: separate field-gun/truck/earthwork profiles with four bounded physical silhouette samples and near-range sanity. Rays still respect ground, trunks, masonry, foliage and smoke. No occupant/stock lookup or contact creation.
- BROWSER VERIFIED: no ordinary-play hostile near-battery discovery case was completed. Unit tests, not a browser acceptance claim, support this repair.
- REMAINING: detected-vs-identified object memory, smooth retention, and commander consumption of object reports are not implemented. The helper supports either side, but the new renderer query alone is not an AI information-system overhaul.

### 10. Battles need more soldiers

- USER-REPORTED: defenses/assaults feel small.
- REPRODUCED: scale limitation retained; no arbitrary mission population increase made.
- ROOT CAUSE: larger populations require measured simulation and render budgets.
- IMPLEMENTED: reproducible 300/1,000-person diagnostics with frame, subsystem, shots and actual time-advancement measurements.
- BROWSER VERIFIED: synthetic benchmark results are recorded below, not ordinary-play population acceptance.
- REMAINING: no new large mission defaults or general 60 FPS claim. Performance gating takes priority over simply multiplying troops.

### 11. MGs need sector/sweep commands

- USER-REPORTED: an MG should defend an area without single-target micro.
- REPRODUCED: existing mounted guns have physical facing/traverse and observed-target engagement, but lack the requested player-drawn sector command.
- ROOT CAUSE: missing command feature, not a solved targeting regression.
- IMPLEMENTED: no new MG sector command in this slice; existing mounted engagement, crew, ammo and obstruction tests retained.
- BROWSER VERIFIED: existing MG readiness inspector regression only.
- REMAINING: sector assignment, visualization, persistence and legitimate-information targeting acceptance remain open.

### 12. Enemy AI still needs major improvement

- USER-REPORTED: poor attack/defense decisions.
- REPRODUCED: no matched-seed full-battle decision study completed in this slice.
- ROOT CAUSE: not reduced to one established defect.
- IMPLEMENTED: no accuracy, health, hidden-knowledge or national bonuses. Existing commander behavior preserved.
- BROWSER VERIFIED: campaign ran while construction/logistics were tested, but this is not a major AI acceptance test. Existing 16 commander tests pass separately.
- REMAINING: coordinated staging/support, avoiding repeated failed lanes, defense/reserve behavior and matched battle review.

### 13. Dead and sleeping people look alike

- USER-REPORTED: resting troops are indistinguishable from deaths.
- REPRODUCED: both used the same prone presentation.
- ROOT CAUSE: no distinct resting roll/folded-arm pose.
- IMPLEMENTED: active sleepers lie rolled with folded arms; dead bodies retain a separate sprawled pose/tint. No giant overhead icons or additional meshes.
- BROWSER VERIFIED: not certified in a crowded trench containing both actual combat deaths and sleepers.
- REMAINING: close/far/crowded-trench readability and wake/resume visual comparison require player review; pose differences alone are not acceptance.

### 14. Raids strip desired weapon crews

- USER-REPORTED: launching a raid should leave home guns manned.
- REPRODUCED: preparing a formation assault could release that formation's assigned weapon personnel.
- ROOT CAUSE: squad-wide movement had no eligibility filter for standing weapon assignments.
- IMPLEMENTED: prepared/known-trench raids exclude affected formations by default; count/explanation and explicit override. Ordinary garrison watch relief also avoids stealing assigned crews and active supply/meal trips.
- BROWSER VERIFIED: not certified through the full home-defense/raid-return sequence. Focused default/override/GO/save tests pass.
- REMAINING: mixed formations are held wholesale, not split into temporary detachments. Essential builder/medic/carrier role locks and the successful 3+ formation capture/reorganization gate remain open.

### 15. Rest dugouts feel pointless

- USER-REPORTED: troops sleep on the ground despite beds.
- REPRODUCED: a blanket low-energy shortcut skipped facilities; installed crews could remain on watch when they needed rest/food.
- ROOT CAUSE: rest selection bypass and missing crew duty release for needs.
- IMPLEMENTED: prefer nearest reachable built dugout with unreserved capacity; critically exhausted people only attempt short bed trips, otherwise floor fallback. Crew assignment remains while a crew member rests/eats, then resumes.
- BROWSER VERIFIED: gun 386's assigned crew rested and subsequently returned ready without being reassigned. This was floor rest, not a browser dugout demonstration.
- REMAINING: the new dugout capacity/approach/save test is synthetic; full browser dugout occupancy, watch/builder return and crew-rotation acceptance are still required. No new recovery-rate bonus invented.

### 16. Artillery supply tasks can take absurdly long

- USER-REPORTED: roughly thirty real minutes with no shell delivery.
- REPRODUCED: actual four-gun construction exposed reservation starvation. At 1,106.3 simulation seconds gun 384 held 4 HE, cache held 4 HE, gun 386 held 0 and its assistant repeatedly attempted pickup.
- ROOT CAUSE: the supplied gun claimed remaining shells toward reserve stock while an empty gun could not claim a usable load. Task dispatch tested total inventory rather than that person's available reservation.
- IMPLEMENTED: a minimum usable load for empty crewed weapons precedes deeper reserve targets; dispatch checks accessible unreserved/owned stock. Existing physical carrier/truck transfers remain authoritative.
- BROWSER VERIFIED: loading the ordinary saved failure after the fix produced 2 HE in gun 386 and then 2 HE in gun 388; both fired from the central order. Materials continued arriving and the third gun completed. Pre-fix failing reservation regression and browser state are retained.
- REMAINING: the fourth gun still awaited 4 materials after a long test; the selected forward roadhead required about 487 m of foot travel. A food/water shortage eventually required the previously agreed supply decision. Multiple batteries, blocked routes, simultaneous combat and reasonable overall delivery latency are NOT accepted. No claim that the thirty-minute complaint is universally solved.

### 17. Convoys are confusing or appear stopped

- USER-REPORTED: unclear supply chain and unexplained stopped trucks.
- REPRODUCED: a moving vehicle could retain an old Road queue/blocker reason; the inspector omitted useful journey context.
- ROOT CAUSE: stale reason after recovery plus incomplete readout.
- IMPLEMENTED: clear the resumed block/queue reason after actual movement; show source, destination, cargo, leg and estimated remaining road travel where meaningful. Blocked/queued states do not invent an ETA. Existing bounded rerouting retained.
- BROWSER VERIFIED: real multi-leg truck/foot delivery observed during the battery test and save/load in transit retained. Controlled road-cut/recovery was not performed in normal browser play.
- REMAINING: full simultaneous convoy/MG/battery/construction/replacement and blocked-road acceptance; travel ETA excludes loading and further foot delivery.

### 18. Cancel leaves things behind

- USER-REPORTED: planned ghosts, markers or tasks should disappear.
- REPRODUCED: an untouched cancelled facility/connector remained, and cancelling a released prepared marker did not stop its movement intention.
- ROOT CAUSE: cancelling metadata rather than the associated unstarted work or released order.
- IMPLEMENTED: remove unstarted empty/unpaid work and unshared untouched connector; preserve paid/physical earthworks and delivered material. Laden carriers return. Renumber surviving battery identity safely. Cancelling prepared orders stops their released intention; preparing support missions cancel without spending ammunition.
- BROWSER VERIFIED: rotated battery preview Escape removed the draft without new trenches/facilities. Other cancellation/conservation/save cases are focused automated tests.
- REMAINING: not every reinforcement, route, supply and underway construction cancellation has been re-played in the browser.

### 19. RESPOND TO CASUALTY is annoying

- USER-REPORTED: unreliable, repeated normal permission prompts.
- REPRODUCED: player-side failed rescues remained gated pending explicit approval, unlike bounded reassessment for the other side.
- ROOT CAUSE: passive failure records were treated as permanent player permission barriers.
- IMPLEMENTED: bounded autonomous reassessment for both sides; remove ordinary permission banner. Blocked/exposed/stabilized-awaiting-aid statuses are passive, with optional Reassess now. Existing explicit legacy Hold stays respected. No automatic authorization for exposed/suicidal recovery. No repeated stabilization treatment for an already stabilized casualty.
- BROWSER VERIFIED: support surface and guide expose passive status; a new natural combat casualty was not observed through complete rescue/evacuation in this test.
- REMAINING: 21 triage regressions pass, but a normal battle casualty-rescue acceptance run remains required.

### 20. Broad graphics upgrade / High versus Balanced

- USER-REPORTED: a noticeable optimized visual improvement is wanted.
- REPRODUCED: this pass establishes only the specific static gun and similar-pose issues above.
- ROOT CAUSE: broad art quality is not a single diagnosed bug.
- IMPLEMENTED: bounded recoil/dust and distinct body poses, preserving instancing and existing effect caps.
- BROWSER VERIFIED: retained actual gameplay/close-gun screenshots; quality/scale diagnostics below.
- REMAINING: terrain/forest/building/trench art revision and a clearly superior High preset were not delivered. Do not describe this as the requested overall visual rescue.

## Normal-play evidence trail

All files referenced here are under `docs/evidence/v1-player-experience/`. Raw working evidence remains under `output/playwright/gameplay-reset-1790387503152/`; it was not deleted.

1. Before/after native front-selector evidence, plus the failed advanced setup capture.
2. Actual seed-1944 Open Front, normal construction and staffing: `failures/battery-reservation-stall.json`, then `battery-after-reservation-fix.json`.
3. `battery-group-ordered.json` → `battery-group-fired.json` → `battery-group-impacts.json`. These are diagnostic reads of ordinary orders, not injected states.
4. `shell-flight-save.json` is the actual normal-control canonical save. Its restored copy was deeply equal, including people, inventories, shell flights and counters. Original loaded copy remains in raw output.
5. `fire-support-final.png`, `flight-readout-final.png`, `final-support-readouts.json` show the final command surface and corrected in-flight status.
6. `battery-rotation-cancel.json` and orientation screenshots retain both valid and invalid preview headings.
7. `camera-real-input-5x.json` contains raw event/frame/subsystem samples. Ordinary-input page-error collection remained empty.

The first full browser suite failed four tests after the UI structure changed: one ambiguous summary locator and three reserve expectations still aimed at the now gun-only container. Failures/screenshots were preserved under `failures/e2e-before-selector-update/`. The tests now open the actual secondary section and verify the reserve there; the final full suite passes. Assertions were not deleted.

Source, scripts, tests and standalone pass Git's whitespace check. Original generated failure Markdown retains its raw code-frame trailing spaces; those evidence files were not edited to hide or normalize the failed run.

## Automated and shipping verification

- Final `npm test`: **108 files, 766 tests passed**, 129.84 s. Includes the existing 72-campaign-hour supplied loop/inventory soak, multi-formation movement/digging, speed/save continuation and raid state-machine regressions. That soak is NOT the requested combined combat/casualty/multi-battery scenario.
- Final `npm run test:e2e -- --workers=1`: **25 passed**, 1.9 min, disposable Edge profiles. Synthetic saved-world mortar/contact/replacement tests are explicitly marked in their source and are not counted as ordinary construction/battle acceptance.
- Production `npm run build`: pass; 164 production modules, 1,159.24 kB main JS (341.43 kB gzip), 47.62 kB CSS. Existing >500 kB chunk warning remains.
- `npm run test:packaging`: **5 passed**. Standalone: 1,312 KiB, two embedded workers. SHA-256 `d02bad652c1f5b595970b5e79da44248e2ec0e2401e9c608af18b8244361cc48`.
- Final isolated offline Edge launch: pass with no network dependencies or page errors. Actual movement, save/continue equality, repeated refresh sizing at 1280×720 and 1920×1080, terrain/navigation workers all verified in `offline-final-result.json`. Canonical before/continued state SHA-256 was `e017bc5c3135d41996ccc94581544842726ea1328b74a12e967248c370d6fb86` in both cases. The earlier `offline-result.json` is also retained.
- Hosted production + standalone + genuine iframe viewport suite: **58 samples, 51 checks**, no errors, `viewport-result.json`. Includes host hide/reveal, fullscreen enter/exit, operational map, offset picking/label alignment, widths down to 821×462, DPR 1/1.25/1.5/2 and live DPR changes. This suite preceded only the final readout-wording correction; layout/viewport code was unchanged afterward.
- Chromium 153.0.8010.12 production smoke check: **passed**, no page errors, 1280×720 at DPR 1.25. Night configuration applied, native support-ammunition selector persisted, map toggled, simulation advanced, canvas filled the viewport. See `chromium-result.json` / `chromium-night.png`.
- Local checks do not establish CrazyGames approval. No upload, platform preview, SDK release integration, low-end hardware acceptance or publishing was performed.
- Rules identity is now `combat-41-autonomous-care-support-world2`; incompatible frozen neural policies use the existing visible fallback. No training or recurring jobs were started. Original player profiles/saves and prior failed evidence were not modified.

## Performance

Final synthetic 300/1,000-person results are in `performance-report.json`. The benchmark records fixture hashes, actual living population, shots, simulation advancement, frame intervals, frame costs, last-completed-tick subsystem costs and screenshots. It ran separately from the test suites in an owned headless Edge at 1600×900, DPR 1. Latest-tick samples are not independent timing samples of every fixed step. Each row is a short approximately six-second sample after warm-up, not a sustained-battle guarantee.

The exact synthetic fixtures are preserved in `docs/evidence/v1-player-experience/fixtures/`. After building and serving production on port 4175, run `node scripts/qa-player-experience-performance.mjs`. Optional arguments are the fixture directory and hosted URL; the starting-commit control used port 4176. Fixture SHA-256 values are stored in every report row. The fixture-path default was changed to this committed copy after measurement; benchmark behavior and fixture bytes are unchanged.

| Fixture | Quality | Requested speed | Frame interval p95 | Simulation seconds / wall seconds | Shots in sample |
|---|---|---:|---:|---:|---:|
| 300 personnel | Balanced | 1× | 12.2 ms | 6.00 / 6.002 | 49 |
| 300 personnel | Balanced | 5× | 48.7 ms | 16.60 / 6.002 | 154 |
| 300 personnel | High | 1× | 12.2 ms | 6.00 / 6.003 | 49 |
| 300 personnel | High | 5× | 73.0 ms | 11.85 / 6.009 | 107 |
| 1,000 personnel (999 active) | Balanced | 1× | 230.8 ms | 3.65 / 6.209 | 77 |
| 1,000 personnel (999 active) | Balanced | 5× | 224.8 ms | 3.65 / 6.087 | 93 |

**Scale gate FAILED.** The 300-person 1× short sample meets the local 16.7 ms target and real-time advancement; 5× does not maintain requested speed or the frame target. The 1,000-person fixture is unplayable at either speed. Do not advertise those populations as accepted gameplay capacity.

In the 300-person Balanced 5× sample, frame simulation cost p95 was 46.9 ms versus WebGL submission 1.5 ms and HUD 0.6 ms. In the 1,000-person 5× sample, frame simulation p95 was 209 ms versus WebGL submission 2.4 ms; sampled terrain-intelligence ticks peaked at p95 182.7 ms and combat at 25.8 ms. The terrain-intelligence phase contains trench observation and raid securing, so this is a phase-level bottleneck, not a CPU profile proving one function. Exact per-cell observation work/update budgeting and combat work are the next optimization investigation. Faster camera damping cannot fix these costs. WebGL submission timing is CPU time, not GPU completion time.

The 96-person normal construction/input test above is a distinct quiet-case result, not a broad 60 FPS claim. High-refresh browser RAF timing and physical display/input latency are also distinct.

### Starting-commit control

The older `gameplay-reset-final-performance-1790364734263` report predates the 055b9a9 starting commit and is not a valid before/after comparison. An isolated detached checkout of **055b9a9** was therefore rebuilt with the same installed dependencies and measured with the same new script, fixture hashes, headless Edge dimensions and warm-up. No player profile or current working files were reverted. Evidence: `performance-starting-commit.json`.

The starting build already failed: 300 Balanced 5× p95 **48.6 ms**, advancing **17.2 / 6.009 s**; 1,000 Balanced 5× p95 **212.8 ms**, advancing **3.85 / 6.021 s**. The new run's 48.7 / 224.8 ms shows the same unresolved scale problem, not a newly established smooth-play capacity. Starting-build High 5× was 48.6 ms versus 73.0 ms in the first new run; this worse sample is retained, not discarded. These short wall-clock slices are not identical simulated endpoints. Do not call performance improved or universally unchanged from a single comparison.

The independent final repeat is retained as `performance-repeat.json`, all six rows complete with no page errors. At 300 personnel, Balanced/High 1× p95 was 6.2/6.9 ms with 6.00 simulation seconds in 6.002 wall seconds. Balanced 5× was **54.7 ms**, **15.95 / 6.009 s**; High 5× was **48.7 ms**, **17.30 / 6.009 s**. At 1,000 personnel, 1×/5× p95 was **230.9/230.8 ms**, advancing only **3.65 / 6.191 s** and **3.65 / 6.027 s**. The High 5× measurements vary between the two current-build runs, but both fail. The 1,000-person current samples are somewhat worse than the starting control; this pass has not established the exact cause or a no-regression performance guarantee. All three reports and unchanged fixture hashes are retained, not just the best result.

## Next release gates — still open

1. Reduce and explain the full battery's long logistics/food delays; verify four ready guns, multiple batteries, tired carriers, road recovery and concurrent fighting through normal controls.
2. Implement and accept the MG sector command; preserve real information, crew, stock and facing.
3. Full matched-seed enemy decision review and coordinated attack/defense improvements without cheats.
4. Finish the inherited legitimate-discovery → 3+ formations → WAIT/save/reload/GO → supported entry/clearing → capture/conversion → front/rest/resupply browser run. Prior failed raid evidence remains untouched. This pass does not claim successful capture acceptance.
5. Ordinary battle casualty care and real dugout/sleep/death readability; full essential-duty raid eligibility and return behavior.
6. Object identification/memory and commander report integration; near-obvious-object browser cases and information-leak checks.
7. Performance results must constrain mission scale and the planned meaningful art/quality-level upgrade. Do not raise populations merely because one short run passes.
8. Player review of the delivered UI/camera/support flow; real CrazyGames preview and release compatibility before a V1 claim.
