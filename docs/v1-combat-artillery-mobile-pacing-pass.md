# Final revised gameplay pass — implementation ledger

Status: **PARTIAL — release gates are not cleared.**

Authority: user's final revised gameplay, survival and presentation plan. This
replaces the earlier handoffs. Implementation starts from master `7c97a75`.
No training, automation, new cloud services, or changes to historical save files.

## P0 survival / movement milestone

### Reported versus reproduced

- **Reported, not causally reproduced:** crews dying on long trips; a trench
  pileup containing dead soldiers; an unclear cause of death. No affected save
  was supplied for this pass. Do not label those deaths proven dehydration.
- **Code audit:** the previous general self-care layer excluded most assigned
  personnel. Travelling garrison duties nevertheless already had a late timed
  ration break at hunger/thirst 75. It was incorrect to conclude that no moving
  duty could ever eat. Previous opt-in lethal needs only applied to assigned
  personnel; the ordinary demo setting is off.
- **Reproduced:** new early-threshold tests failed before the patch: no break at
  hunger 65/thirst 70 for a travelling duty, no general recovery at energy 24,
  and no interrupted general-care state to save. The complete travel fixture
  subsequently exposed eating stock while displaying sleep rather than a
  distinct ration activity.

### Implemented so far

- General carried-ration and recovery breaks also serve travelling duties.
  Rations take six simulation seconds, use physical inventory, and precede
  ordinary rest. Recovery starts at energy 25 and ends at 45. Nearby reachable
  assigned dugouts remain preferable to an unnecessary floor break.
- Self-care retains the duty, order, shipment and reservations. Mobile supply
  detours rejoin the remaining route locally; static posts retain a return trip.
- Personal resupply errands are bounded to 120 m and reject known threats.
  Known reachable loose stock participates in sourcing; hidden hostile packs do
  not. Network-bound personnel use completed trench routes to supplies, including
  recovery crates, rather than taking a direct shortcut across the bank.
  Critically dry/hungry walkers with no safe source stop locally and expose
  `SUPPLY ROUTE BLOCKED`; they do not acquire free supplies or immunity.
  Existing authorized withdrawal ration sharing remains authoritative.
- Urgent carried drinking/eating can occur in place under fire. Casualty care
  and physically necessary reactions retain precedence. Full danger-aware
  survival/crew-relief acceptance is still pending.
- Opt-in lethal deprivation uses saved elapsed-exposure seconds and now applies
  independent of assignment tags. Default lethal setting is unchanged. This is
  not a claim that the original unexplained deaths have been reproduced.
- Central idempotent death transition and saved provenance: combat, artillery,
  originating critical wounds, hunger/thirst, and explicit unknown legacy cause.
  Stock drops and death counting occur once. Player text does not reveal shooter
  identity or location. Fallen personnel are inspectable from a position's People
  tab; unknown historical deaths are not relabeled.
- Friendly-body vetoes removed from formation walking, garrison transit, building
  transit and reaction following. Real terrain/capacity restrictions remain.
  Drawn routes and engineers use the same ordinary walking primitive as formations.
- Local route projection replaces mandatory travel to the formation anchor;
  drawn-route followers no longer stop solely for a predecessor's progress.
- Persistent routine `CASUALTIES` label removed. LOW WATER/FOOD and exhaustion
  warnings added. Full ten-second casualty digest/six-second escalation remains
  unfinished.
- Drawn Move / Assault / Fall Back routes show an estimate of remaining travel,
  recovery time, and carried food/water endurance. The warning uses only actual
  personal stock, not imagined access to the rear depot. It explicitly warns
  that terrain, danger and detours can add time; this is not a safety guarantee.
- Watch coverage now rejects travelling, unarmed, empty, eating, sleeping,
  critically needy, pinned and recovering personnel. Weapon readiness also
  rejects self-care. Position Overview has five exclusive manpower totals;
  pinned/broken people are recovering, not available. Station badges survive rest.
  This does not yet implement staggered crew relief or ALL IN participation.
- Save v4 uses a separate key. Compatible v3 world-2 saves load as copies;
  originals are retained, no personnel or stock is added, and old deaths receive
  unknown provenance. This is the first v4 milestone, not completion of all
  planned v4 systems.

### Verification log (in progress)

- Focused needs-only travelling-duty tests: ration consumption, recovery and
  exact save continuation passed. These are not full simulation acceptance.
- Full fixed-step 330 m march with initially low energy/high hunger/thirst at
  1× and 5×: observed timed meal and rest, resumed, arrived, no deaths, conserved
  stock. No needs resets.
- Full fixed-step 3.7 km march, eight personnel, at 1× and 5× (the latter enemy
  faction): finite initial carried rations, no needs resets, rest and arrival,
  no deaths, stock conservation passed. This does not cover every support role.
- Blocked-supply hold and accounted local handover resume passed.
- Four provenance tests passed: idempotence/conservation, fatigue versus lethal
  thirst, delayed artillery origin, old-save copy/unknown cause, invalid records.
- First broad run: 766/775 passed. Retained failures included outdated ration,
  fatigue and casualty-banner assertions, and genuine withdrawal stockpiling /
  nearby-dugout regressions. Fixed the latter by keeping withdrawal service and
  reachable rest approaches authoritative; focused recovery/dugout tests pass.
- Existing 72-hour **supplied, noncombat** loop-network soak passed. This is not
  the requested combined combat/cutoff soak and must not be presented as such.
- 96-person narrow T-junction walking fixture with counterflow: 57.90 simulation
  seconds both crowded and isolated, maximum body-only stall 0 seconds; real
  corridor containment checked each step. This deliberately isolates the walking
  primitive in a treeless corridor. It does not include occupied-post reservations
  or capacity staging, and is not the entire crowded-trench release gate.
- Intermediate runs and their failures remain under `output/playwright/`:
  `p0-final-regressions.json` (779/781; distinct floor-rest and known-crate recovery
  regressions subsequently repaired), `p0-validated-regressions.json` (782/784;
  72-hour soak and async route exceeded their time limits under concurrent browser
  workload), and `p0-final-clean-regressions.json` (783/784; a test was changed
  while a worker held the prior imported module). The latter is not a valid
  immutable-source run. Its newly added pinned-pool assertion passes in a fresh
  process. Neither timeout required raising the test limits: the soak passed in
  29.15 seconds and both async restoration cases passed in the sequential rerun.
- First complete Edge UI run: 24/25. Remaining failure was a test reading the old
  v3 storage key and expecting `null` after a correct v4 restore. Updated the test
  to assert the v4 key and schema explicitly; failed screenshot/context retained.

### Player-facing checks and packaging

- Actual headed Edge controls (isolated test profile): open sandbox, pause,
  select a formation, focus, draw a route with the mouse, run 1x, open position
  management, inspect manpower, save from Menu, refresh and Continue. Screenshots
  inspected at 921x920 and 1440x900. No user profile or historical saves altered.
- `p0-march-preview.png` exposed a presentation defect: route title and estimate
  ran together and sub-minute estimates were rounded to one minute. Fixed line
  separation and five-second display increments in the final build, then checked
  the actual right-drag preview again in `march-preview-final.png`. Headed Edge
  reported zero console errors or warnings after refresh and the control check.
- Separate offline Edge automation on an isolated copy of `FRONTLINES.html`
  passed: no network dependencies, no reported errors, accepted movement, exact
  save/continue state hash, and full viewport after refresh at 1280x720 and
  1920x1080. Evidence: `output/playwright/p0-offline-1790398484005/result.json`.
- CUA browser connector failed to initialize (missing kernel-assets path).
  Followed the playtest skill's CLI fallback: real Edge via Playwright, including
  actual mouse/keyboard controls and screenshots. Headless automated checks are
  distinguished from the headed control checks and physical-phone acceptance.
- Production TypeScript/Vite/offline build passed. Existing main-bundle >500 kB
  warning remains; a successful build is not a performance certification.
- Final frozen-source `npm test`: **784/784 tests, 113/113 files**, 137.10 seconds,
  default two workers, unchanged timeout limits. Report and failed predecessors
  retained in `docs/evidence/v1-survival-p0/`.
- `npm run test:packaging`: **5/5**, rebuilt single-file game includes both workers.
- Final maintained Edge UI suite: **25/25**, zero skipped, flaky or unexpected
  cases, 117.53 seconds. The save/load test now confirms schema v4 and exact
  paused restoration. Report: `docs/evidence/v1-survival-p0/edge-final.json`.
  These are automated Edge checks, not physical-phone verification or the full
  scenario acceptance list from the final plan.
- Final isolated offline launch rerun also passed on the exact rebuilt HTML
  (`70f90b58...b7f98f`): zero errors, embedded workers, movement, exact save/continue
  hashes, 1280x720 and 1920x1080 refresh sizing, no network dependencies.
  Retained result and boot screenshot in `docs/evidence/v1-survival-p0/`.

### Status boundaries

| Item | Reported / reproduced / root cause | Implemented | Browser verified | Remaining |
|---|---|---|---|---|
| Long-walk deaths | Original report not causally reproduced; assignment/early-care eligibility gaps reproduced | Timed mobile self-care, blocked-supply hold, order retention | Mouse-issued movement and continuation; not induced mortality | Affected-save reproduction and complete role/threat/calendar matrix |
| Pileup | Friendly-body hard veto identified; 96-person counterflow fixture reproduced | Soft friendly traffic and local joining | Ordinary route only | Occupied-post / capacity staging acceptance |
| Unclear deaths | Multiple direct death paths audited | Central saved causal record, unknown legacy causes, People inspection | Inspection surface checked; no staged death screenshot | Battle-wide death log and all new causal event types |
| Readiness | Retained watch duty could count during self-care | Fit/armed/present checks, exclusive pools | Position Overview screenshot | Staggered crew relief and below-squad ALL IN |

## Remaining mandatory gates

1. Full-role march matrix (engineer, hauler, weapon relocation, temporary
   unassignment), danger/cutoff cases, 10/20/30-minute equivalence, and affected
   save reproduction if obtainable. Rolling sleep debt and calendar separation
   are not completed; calendar default remains unchanged for now.
2. Extend the quantified walking fixture to full garrison T-junction traffic with
   occupied posts, real obstacles, destination capacity and staging. Retain the
   <2-second body-only stall and <=2x baseline limits.
3. Finish readiness acceptance, staggered physical crew relief, below-squad normal
   assault and confirmed **ALL IN**, read-only preview,
   medical exclusions, physical cargo, fire-mission cancellation and persistence.
4. New 3 km maps and 512-person standard scenarios with scaled finite logistics,
   assault/reserve/support density and genuine early-contact acceptance.
5. Tactical autonomy, shared per-gun impact authority/local structural repair,
   physical salvage sourcing, unified touch command surface and historical art.
6. Full combat/supply 72-hour soak, 512/300/1000 performance measurements,
   achieved 5× rate, Edge playthroughs, refresh/narrow/touch/context recovery,
   offline delivery and physical-phone test. Player visual/playability acceptance
   remains separate from automated success.

Do not claim the final plan complete, enable larger defaults early, or substitute
smaller force performance for standard-density acceptance.

## Next implementation slice

Start with per-person assault membership and immutable normal/ALL IN consequence
previews. Existing prepared orders still use squad-level Hold/GO and must not be
relabeled as the promised ALL IN system. Inspect `PreparedOrders`, `RaidEligibility`,
`BattlefieldSimulation.prepareOrder`, `TrenchRaid`, auto-crew/worker recruitment,
and save restoration together before enabling release. Keep protected
nonparticipants at their posts and preserve squads as identities, not movement
authorities for detached assault participants. Do not enlarge force or speed up
the calendar until the remaining survival/crew gates are met.

Historical one-off QA scripts that explicitly read the v3 key remain historical;
refresh their fixtures before reuse. The maintained Edge suite and offline launch
runner above were used for this v4 milestone instead. No prior evidence was erased.

## Crew control continuation — 2026-09-26 (milestone A)

Starting revision: `699e5da`. Overall release remains **PARTIAL**. The original
long-journey deaths are still **not causally reproduced**. No new population or
calendar defaults, neural training, or automation changes in this milestone.

### Implementation

- Added per-person `AssaultPlan` membership beneath unchanged squad identity.
  NORMAL protects installed crews, construction, hauling and recovery; ALL IN
  lists actual eligible people, exclusions, awakened sleepers, equipment gaps,
  released worksites and weapon consequences before confirmation.
- Preview/cancellation does not Hold formations, remove duties, pause queues or
  reserve workers. Empty NORMAL previews stay open so a crew-only formation can
  explicitly choose ALL IN. Changes before GO or before the release tick require
  renewed confirmation; no unconfirmed participant is silently added.
- Release occurs on a fixed tick. Detached route intent is used by movement,
  reactions, cooperation, self-care, buildings and small arms. Nonparticipants
  retain their existing order. Coordinators cannot reclaim committed personnel.
- Physical cargo remains on its carrier, installed weapons stay at their posts,
  spent materials/unfinished work remain, unfired affected missions cancel and
  airborne shells continue. Cancelled detachments hold locally; return and
  re-crewing require new orders and actual movement.
- Persisted crew-relief reservation and approach/handover phases. The arriving
  replacement does not occupy an operational crew berth before handover. Critical
  recovery can leave a visible shortage; 90% readiness does not forbid rest.
- Exclusive manpower precedence is recovery, assault, station crew, work,
  available; relationship badges remain separate. Position blockers distinguish
  crew rest/eating, relief, missing ammunition, pinning and obstruction.
- Compatible v4 extension validates individual references and continuation state;
  no original save is overwritten or assigned new personnel/supplies on migration.

### Verification and failed evidence

- Initial legacy tests expected whole-squad Hold/assault/capture; updated those
  assertions to individual authority, keeping old behavior tests where applicable.
- Focused tests cover pure preparation and live duty equivalence, empty NORMAL,
  changed consequences, source-position membership, physical cargo/material/ammo
  conservation, medical/critical exclusions, no auto-reclaim, partial mission
  cancellation, save continuation and malformed membership rejection.
- Crew fixture verifies real approach, timed handover, deterministic saves during
  both phases, explicit cancellation, and an exhausted 90%-readiness crew with no
  fit relief. The latter initially failed because the work-eligibility guard also
  blocked rest; recovery uses its separate eligibility path after the repair.
- Intermediate full run: 791/792, with the supplied noncombat 72-hour soak timing
  out during concurrent build/browser work. Isolated rerun passed in 32.42 s,
  without increasing the timeout. This is not the combined combat/cutoff soak.
- New Edge UI test uses a declared synthetic occupied-post fixture and actual UI
  thereafter: NORMAL protects two crew, ALL IN previews eight, cancel preserves
  the post, GO waits for a tick, and detached save/Continue does not auto-recrew.
  First test attempt failed due to a test-side closure variable; screenshot and
  error context retained at `output/playwright/crew-control-failed-test-1/`.
- Separate headed Edge controls on the production preview: Quick Battle, pause,
  select Able, Assault ground target, NORMAL/ALL IN, Save, refresh, Continue.
  Inspected screenshots at 1920x1080 and 844x390. Fixed duplicate GO controls,
  closed the old detail drawer on review, and hid redundant selection information
  during short-window review. Preview survived refresh; console reported zero
  errors/warnings. This is desktop viewport emulation, not a physical phone.
- Production/offline build succeeds; existing large-bundle warning remains.
  Final frozen-source regression and packaging results are recorded below when
  complete. Authoring, living menu/session isolation, occupied-traffic and full
  cross-role/calendar gates are **not** implied by this milestone.

### Milestone A delivery checks

- Final full simulation run: **799/799, 115 files**, unchanged timeout limits.
  Report: `docs/evidence/v1-crew-control/regressions-final.json` (earlier 796-test
  passing report also retained). The final multi-squad release tests verify one
  pre-release snapshot and withhold the entire signal if any participant changes.
- Subsequent explicit reoccupation regression also passes: an initially stocked
  operational post loses its crew, returning people receive an actual route, and
  the gun becomes ready only after arrival. Its first fixture omitted shell stock
  and correctly stayed NO AMMO; repaired the **initial test manifest**, not the
  game, with two accounted rounds. Latest focused 16-test report is
  `return-and-relief.json`. No infinite stock or runtime refill was introduced.
- Maintained Edge UI suite **26/26**, zero skipped/flaky/unexpected, 119.80 s.
  Includes separate Cancel assault control after GO and after save/Continue.
  This full UI run preceded the final simulation-only atomic-batch correction;
  that correction is covered by the full 799-test simulation run.
- Build and offline packaging **5/5** pass. Isolated on-disk Edge launch of the
  rebuilt HTML passes movement, exact paused save hashes, embedded workers,
  1280x720/1920x1080 refresh sizing and no external network requests/errors.
  Result: `docs/evidence/v1-crew-control/offline.json`.
- Scope is individual assault/crew-control infrastructure and focused acceptance,
  not certification of long-duration combat staffing or every release scenario.
  Next: milestone B occupied production-network acceptance. Milestones C–G,
  developer authoring and living-menu isolation remain pending.

## Occupied trench continuation — 2026-09-26 (milestone B)

Starting revision: `c2cbfc9`. Overall release remains **PARTIAL**. This slice does
not change calendar speed, force size, lethal-needs settings or initial stock in
existing saves. Original long-journey deaths remain **not causally reproduced**.

### Reproduction and fixes

- The routine rest allocator exhausted coarse five-metre samples and then picked
  a sample by person ID without checking existing reservations. Replaced that
  fallback with actual floor-width sampling and live temporary reservations.
  Routine waiting/rest avoids junction centres, entrances, structures and service
  areas. Full dugouts use free floor, not an invented bed. An explicit rest order
  reports unavailable space instead of reserving an occupied point.
- The loop fixture exposed missing route ownership: at a shared junction,
  endpoint-only nearest-edge queries could omit the connecting trench traversed
  between two junctions. Route dependencies now include leg interiors, and
  replanning refreshes those dependencies. Removing that connecting passage
  replans on remaining excavated floor without jumping or crossing a wall.
- These are deterministic scheduling/navigation changes. No hard friendly-body
  veto was restored, no capacity limit was increased, and no renderer-only
  movement was introduced.

### Quantified acceptance

- `scripts/qa-occupied-traffic.ts` uses the full production fixed-step simulation,
  actual terrain/network/needs/coordinator and normal individual-order interface.
  Initial geometry and people are declared fixtures, **not** structures authored
  through player controls. No geometry, movement or survival mocks.
- 96 people: 72 opposing/crossing travellers, eight already near their
  destinations, two operational gun crew, two construction workers, two loaded
  carriers, eight resters and two other guards. The post has finite accounted
  ammunition; the dugout has only two beds. Work completes while traffic moves.
- The matched uncongested control keeps all 96 people and mixed duties, but
  parks the intermediate travellers off the tested paths; it runs the same three
  longest routes plus the eight near-destination routes. This is an 11-traveller
  control, not a claim that 80 isolated simulations were run.
- T-junction: both control and 80-traveller run complete in **70.50 simulation
  seconds**, maximum measured stationary travel stall **0 seconds**, maximum
  near-destination travel **0.105 metres**. The formation anchors deliberately
  start far away. A second occupied loop fixture actually uses the diagonal
  connecting passage; the same <=2-second stall and <=2x control gates pass.
- A separate 96-person junction pile is assigned distinct floor-rest destinations
  by the real coordinator, walks out of the junction, and continues identically
  after saving the approach. Additional tests retain hard building exclusions,
  graph boundaries, finite facility reservations and refusal of invalid capacity.
- Save/reload at 25 simulation seconds continues to the same **serialized** state.
  Initial raw-object comparison exposed absent-versus-undefined optional keys;
  serialized comparison now matches the actual save contract. No simulated value
  was discarded from comparison. Resource balance is checked at completion.

### Browser evidence and limitations

- Edge uses the declared production-validated fixture, then actual Forces,
  selection/focus, speed, pause, Save, refresh and Continue controls. No browser
  stepping or movement injection. All 80 arrive; all 96 remain active; no page
  errors. Wall timing includes pauses and reload and is **not** a 5x benchmark.
- Initial junction screenshot framed the deliberately remote formation anchor;
  the final test focuses again after movement and captures the actual counterflow.
  Both attempts remain under `output/playwright/occupied-traffic-edge-*`.
- Failed fixture setup initially overlapped carrier parking with traveller
  destinations; production orders correctly rejected those reservations. The
  fixture was corrected rather than weakening occupancy checks. The first
  exhausted-floor unit fixture failed to exclude the outer berm; its exclusions
  now cover the full width. The first loop run failed the dependency assertion
  and led to the route-ownership fix above. Failed reports are retained.
- Doorways/full buildings and impossible assignment capacity retain the maintained
  focused regressions. The new quantified 80-person gate is for trench T/loop
  traffic, **not** an 80-person building-interior performance claim. A network
  that is truly over capacity still rejects the whole assignment; automatic
  external staging for that refused order remains unfinished. No unlimited
  facility occupancy is substituted for that missing workflow.
- These tests do not certify 512-person performance, combat/cutoff soaks, physical
  phones or subjective presentation. C's complete survival matrix and independent
  calendar timing, D's scale, E's developer authoring and F's living-menu/session
  isolation remain pending. Their interfaces have not been claimed as shipped.

Final frozen-build test/package reports for this slice are appended below after
verification. The next implementation gate is the remaining B external staging
workflow, followed by the cross-role survival/calendar matrix before changing
calendar or population defaults.

### Milestone B slice delivery checks

- Full simulation regression: **808/808, 117 files**. Final focused rest-order
  rerun covers the last wording/explicit-refusal adjustment. Production build
  passes; the existing large JavaScript chunk warning remains.
- Edge **27/27**, zero skipped/flaky/unexpected, 57.17 seconds. First full run
  was 26/27: the reserves UI test required the transient PREPARATION placeholder
  even when a real tick had advanced the meeting mission to BUILDING before the
  pause click. It now asserts the displayed phase against the actual paused
  mission state, while retaining finite-reserve/no-sandbox-spawn assertions.
  Failed report and screenshot are preserved, not overwritten.
- An additional isolated occupied-traffic Edge capture passes, including waiting
  for the pause indicator before taking the completion screenshot. Screenshots
  were inspected for actual junction framing and end-state spreading.
- Offline packaging **5/5**. Isolated portable HTML in network-disabled Edge
  passes movement, exact paused save/Continue hashes, embedded worker responses,
  1280x720 and 1920x1080 refresh sizing, and zero external dependencies/errors.
- Reports/screenshots: `docs/evidence/v1-occupied-traffic/`. The earlier generic
  96-walker fixture remains unchanged; this adds production garrison/mixed-role
  coverage rather than replacing a difficult test with a smaller workload.
- This delivers crew control (A) and the occupied-traffic/rest-allocation portion
  of B. **B's true over-capacity external staging and C–G are still pending.**
  No claim of developer-tool, living-menu, 512-person, mobile or release completion.

## Integrated continuation — A extension, 2026-09-26

Verified starting local/remote revision: `39557da`, not `699e5da`. Overall status
remains **PARTIAL**. No calendar, force-size, survival, weapon-rate or inventory
default is changed in this milestone. Original long-journey deaths remain
**USER-REPORTED / NOT CAUSALLY REPRODUCED**.

### Issue status

- **REPRODUCED / ROOT CAUSE:** manpower presentation called a fit waiting reserve
  AVAILABLE, while NORMAL assault interpreted every `rest` duty as recovery and
  excluded it. Shared pure personnel-role queries now distinguish waiting from
  sleeping, meals, active self-care, serious wounds and physical pinning.
- **IMPLEMENTED:** NORMAL's **Include workers** option is off by default. It
  considers AVAILABLE people first, then eligible workers; essential crews and
  genuine recovery remain protected. Cancelled work and personally reassigned
  members are not falsely presented as active excavation workers.
- **IMPLEMENTED:** local **Select workers / Select available** creates an explicit
  person-ID selection, not a new squad. Prepare assault uses those exact IDs.
  Options and membership survive v4 save/load, staffing-mode switches and GO
  revalidation. Material changes still require confirmation. Caller-owned arrays
  cannot mutate persisted scopes; invalid scope references are rejected on load.
- **IMPLEMENTED:** previews list facility and excavation work affected, and
  separate assigned strength from physically present, fit, armed ready defenders
  and operational weapons. The exclusive pool precedence remains recovery,
  assault, station crew, workers, available; relationships remain on the people.
- **BROWSER VERIFIED:** a dugout created through actual Edge controls supplied
  a four-person mixed-formation work party. Toggle, ALL IN, Save/refresh/Continue,
  GO and cancel were exercised without runtime state injection. GO released only
  the four IDs, paused their unfinished job, and kept original squad identities.
  Cancelling the saved preview left workers and inventory unchanged.
- **REPRODUCED / IMPLEMENTED / BROWSER VERIFIED:** in portrait, the compass's
  separate stacking context covered the assault heading. It now belongs to the
  HUD context so panels occlude it. World markers still align continuously.

### Verification and remaining scope

Evidence and exact player-control sequence:
`docs/evidence/v1-worker-control/README.md`. Pre-fix failures, the concurrent
timeout run and initial portrait overlap are preserved alongside successful
checks. Final frozen verification is appended below after completion.

**REMAINING:** B's protected external staging/95% settling and return behavior;
C's distinct 45-second field-rest and full cross-role independent-calendar
verification; urgent artillery/construction/UI repairs; D's 3-km/512-person
scenarios and connected town/hub/interdiction logistics; E's developer authoring,
F's genuinely authored isolated menu; and the remaining G soak, presentation,
performance and physical-phone gates. No DEV/menu interfaces or 512-person
performance are claimed as delivered by this worker-control milestone.

### A extension delivery checks

- Frozen-source full regression **818/818, 118 files, 114.78 seconds**. The
  existing combat speed/save and supplied loop-soak tests pass at unchanged
  timeout limits. This is not the new 72-hour combat/supply-cutoff release gate.
  Ten new worker/eligibility tests supplement the preserved baseline.
- Production and portable build pass; standalone HTML is 1350 KiB with both
  embedded workers. Existing large-chunk warning remains, without disabling it.
- Packaging **5/5**. Network-disabled Edge launch of one copied standalone file
  passes physical movement, exact paused Save/Continue state hashes, worker
  responses, full 1280x720/1920x1080 refresh sizing and no external requests or
  browser errors (`offline-final.json`).
- Frozen-source maintained Edge suite **27/27**, 77.03 seconds, no skipped,
  flaky or unexpected results (`edge-frozen.json`). Actual manually authored
  worker controls and screenshots are documented separately from those fixtures.
- Final portable SHA-256:
  `239373c79cf0620590f0e04a8a3eaf7cc9f59e24b4b9f6d1fd648454aa678218`.
- Failed evidence remains intact; source freeze and isolated execution were
  necessary after a concurrent workload timeout and an in-flight test run that
  mixed older cached implementation with newly added edge-case assertions.
  The final report tests the complete unchanged implementation together.

## 2026-09-26 — Separate FRONTLINES DEV and genuinely authored living home

Baseline: local and remote `20404c4d563335c30cc82bb260a329b34570e5fc`.
This is the focused authoring/home-screen handoff, not a claim that A–G is
finished. **Overall project: PARTIAL.** Historical long-journey deaths remain
**USER-REPORTED / not causally reproduced** by this milestone.

### Issue and implementation status

- **USER-REPORTED / REPRODUCED:** the baseline had no separate visual battle
  authoring entry and no isolated, genuinely authored title-screen battle.
  Sandbox and Quick Battle's saved settings were not that workflow.
- **ROOT CAUSE:** no shared initial-condition preset/publication path or explicit
  attract-session owner existed. The existing menu used the gameplay world's
  backdrop instead of independently constructing an authored AI-vs-AI scene.
- **IMPLEMENTED:** `FRONTLINES-DEV.cmd`, `/dev.html`, separate author server/build,
  visual trench drawing/branching/extension/reshape, both factions, formations,
  installed weapons/crews, finite stock, facilities, objectives, staging,
  broad AI intentions and opening camera. Terrain generation remains read-only.
- **IMPLEMENTED:** strict versioned `ScenarioPreset`, shared deterministic
  `instantiateScenario`, reversible source-only document, explicit folder
  selection, Save/Duplicate/Load/Import/Download, isolated Play Test/Stop/Reset
  and explicit Use for title screen publication. Draft saves do not change the
  active immutable published snapshot. Reserved filenames cannot overwrite the
  catalogue; pending file operations lock authoring edits.
- **IMPLEMENTED:** `WorldSession` owns player/attract/editor-test simulation and
  navigation lifetimes; disposal rejects late results. One render host remains.
  Only player owners can save campaigns. Both authored AI factions use the
  production commander and their own delivered knowledge; spectator rendering
  grants no targeting information. Real finite-ammunition support is attributed
  to `AUTHORED_AI` only when that faction is actually AI-controlled.
- **IMPLEMENTED:** transparent live home, exclusive menu input, no command HUD,
  muted attract audio, independent Continue/new-game transitions, explicit
  Save/Discard/Cancel return, safe title-load/step failure fallback, hidden-page
  and context-loss suspension without catch-up. Victory, four-minute and
  post-contact inactivity resets recreate the preset, never revive/refill it.
- **BROWSER VERIFIED:** The Orchard Approach was actually drawn, populated,
  supplied, saved, reopened, played and published through headed Edge controls.
  It has 64 people, two trench lines, MG posts, a field gun and mortar, finite
  stores, rest areas and a physical objective. Both sides fired real ammunition.
  Source and published snapshot hash:
  `ed826cec964a142a46a05b6c337bdf115bc988b9b9b7305020f1f11851999b45`.
- **BROWSER VERIFIED:** branch/extend/node drag, item duplicate/delete, exact
  undo/redo, duplicate-file independence, failed-save document retention, ten
  editor resets, thirty Continue/home transitions, ten UI attract resets and
  one naturally timed four-minute reset. Save data and owner/resource counts
  remained stable. Title failure and Save-and-return quota failure kept the
  appropriate menus/battle usable. Publishing did not reload the editor.
- **BROWSER VERIFIED:** project-folder selection refreshes its DEV-server token;
  the final reopen/save/play/stop/publish flow retained the exact source.
  Native directory-picker rejection/write behavior is unit-tested; an actual
  OS folder-picker permission interaction is not physically accepted here.

### Evidence and boundaries

See `docs/frontlines-dev.md`, `docs/world-session-isolation.md` and
`docs/evidence/dev-menu/README.md`. Raw scripts, failed runs and screenshots are
preserved under local `output/playwright/dev-menu-20260926` and `.playwright-cli`;
selected reports/screenshots are retained in the evidence directory.

The first release authors current production 4-km generated sectors. Unsupported
world/generator versions fail explicitly; this does not silently substitute a
4-km release for the pending 3-km/512-person gate. DEV Play Test provides the real
production battle with spectator camera, pause/speed/reset controls; it does not
add a second full player-command HUD. Advanced town/hub/convoy/damage authoring
remains dependent on the corresponding gameplay work.

**USER ACCEPTED: PENDING.** Protected overflow staging, distinct field rest and
the full survival/calendar matrix, artillery/reload/damage/construction repairs,
town/hub/interdiction logistics, 512-person performance, physical-phone checks,
72-hour combat/supply-interruption soak and CrazyGames submission review remain
separate outstanding gates. No automation, training or unrelated gameplay
overhaul was started.

### Final delivery verification

- Full final regression: **846/846 tests, 123 files, 388.37 seconds**. This
  preserves the 818-test baseline and adds 28 focused checks. Ten independent
  four-minute/reset-boundary production showcase runs pass real firing from
  both sides, finite-inventory balance, clean recreation and owner disposal.
  A late-worker-response regression verifies disposed planners cannot complete
  old requests or deliver them to the replacement session.
- Maintained Edge suite: **27/27, 257.93 seconds**, no skipped, flaky or unexpected
  results (`edge-frozen.json`). The separate source-change/navigation failure
  is preserved rather than pooled into this successful run. Final DEV-only
  label simplification was separately exercised through Edge selection controls
  and included in the final full unit/type/build verification.
- Production, standalone and strict-TypeScript separate DEV builds pass;
  packaging **5/5**. Existing large-bundle warnings remain visible. Portable
  game: **1373 KiB**, two embedded workers. Player/offline artifacts contain no
  authoring controls, project-folder endpoint, directory picker or writable-file
  API; only the validated selected published runtime preset is embedded.
- Final isolated, network-disabled Edge launch passes: the real 64-person
  attract scene, physical player movement, both worker responses, exact paused
  Save/Continue state, no page errors and no external network dependencies
  (`offline-final.json`). Canvas/menu fit and all home actions remain visible
  with at least 44-pixel targets at 1280×720, 1920×1080, 2560×1440, 960×540,
  844×390 and 390×844. These are desktop viewport checks, not physical-phone
  acceptance or a 512-person frame-time result.
- Final portable SHA-256:
  `2c5d315b3b820a5538686b5988cda5b24a00009fdde072e97edb57d8488d1c49`.
- **E/F focused handoff: IMPLEMENTED / AUTOMATED VERIFIED / BROWSER VERIFIED.**
  Native OS folder-picker interaction and subjective presentation/believability
  remain for user acceptance; broader release status remains **PARTIAL**.

## 2026-09-26 — Current playtest delta: continuity, recovery and compact controls

Immutable starting commit: `e41c9795346bc6dad396ec8587ac2e70384eba07`, verified
local/remote master. The pasted `20404c4` is superseded; separate DEV and the
authored living menu are already delivered and were preserved. This milestone
implements a scoped first portion of the new delta. **Overall: PARTIAL.**

### Issue status

- **USER-REPORTED:** rapid-fire users sometimes fail to fire; people appear to
  keep targeting bodies; grouped destination orders spread too far from the
  click; the interface exposes too much unrelated state. Original unexplained
  long-journey deaths remain **not causally reproduced**.
- **REPRODUCED / ROOT CAUSE:** crossing targets continually changed nearest
  priority and restarted aim; invalid target caches survived cooldown early-outs;
  legacy volley damage was deferred until after later shooters acquired targets.
  Six focused continuity regressions failed before repair. Actual hit geometry,
  observation rules, ammunition use and deterministic shot provenance remain
  authoritative; no accuracy/visibility cheat was added.
- **REPRODUCED / ROOT CAUSE:** 24-metre multi-squad grid spacing, incomplete rows
  and large free-destination snaps caused oversized/displaced destinations.
  Four failing fixtures cover different selections/distances and true blockage.
- **IMPLEMENTED:** stable valid target acquisition, immediate invalidation and
  stable shot-order damage; person-weighted compact destination footprint and
  bounded obstacle adjustment with truthful blocked-route explanation.
- **REPRODUCED / IMPLEMENTED:** explicit old `lethalNeeds=true` caused health
  damage. The latest user override removes hunger/thirst injury/death, hunger/
  thirst staffing vetoes, inaccessible-water watch churn and indefinite waits.
  The legacy setting remains readable but inert. This is an intentional new
  gameplay rule, not retrospective proof of the original death report.
- **IMPLEMENTED:** real ration consumption, modest food-assisted recovery,
  short `field-rest`, 25-to-45 recovery nominally 45 seconds, local protection,
  retained orders/route progress/cargo and save continuation. Field rest does
  not credit sleep. Rolling sleep credit no longer clears each calendar midnight.
  Existing timing/map defaults are not changed in this milestone.
- **REPRODUCED / IMPLEMENTED:** a new threat-rest regression found critical
  recovery repeatedly interrupted at energy 10 and overlapping reaction movement.
  In-place recovery now retains action ownership until finished, without clearing
  pinning or overriding casualty care. Old mobile sleep/wait saves migrate as
  copies; old injuries, deaths, armies and stocks are not healed/refilled.
- **IMPLEMENTED:** one compact formation docket with identity, able strength,
  actual readiness, order and at most one relevant issue; Move/Hold/Manage.
  Contextual actions and Overview/People/Weapons/Supply tabs replace stacked
  selection blocks. No redundant Observe/Withdraw buttons, no empty Resume works,
  no normal lethal-needs switch. Reinforcements foreground reserve, incoming,
  destination, request and locate; transport internals are optional details.
- **BROWSER VERIFIED:** headed Edge selection/management, real six-formation
  right-click movement, compact desktop/landscape/portrait layouts, opaque panels
  and actual Request 8 / Locate / Transport details. Reserve 48 becomes 40 with
  eight physical pending passengers, not destination spawns. The six-squad
  destination centroid was within 0.073 metres of the actual ground click.
  These are normal-control checks, not injected completed runtime states.

### Evidence and remaining acceptance

See `docs/evidence/current-delta/README.md` for failed runs, reproduction details,
test-scope distinctions and player screenshots. The maintained synthetic
restoration regressions are labeled separately from actual-control playthroughs.
The game-foundations/Three.js guidance preserved deterministic simulation versus
presentation boundaries; UI/playtest guidance drove contextual density, input
isolation, 44-pixel controls and visual verification rather than screenshot-only
or unit-only acceptance.

**REMAINING:** real squad rapid-fire/death/save-load acceptance; full protected
occupancy and cross-role survival/calendar matrix; per-gun reload, local rounds,
artillery classes/damage/repair; construction calibration; selectable loose/town
stock, multiple hubs, capture/recovery/interdiction/night deliveries; mission and
AI quality; 3-km/512-person standard, 96–128-person assault with reserves; integrated
72-hour combat/shortage soak, desktop/physical-phone performance and subjective
presentation. Existing smaller-map, supplied-soak or emulation results are not
substitutes. No training, automation restart or platform publication occurred.

### Frozen milestone verification

- **865/865 tests, 127 files, 388.83 seconds.** Existing 846-test baseline plus
  19 focused checks; no failing or skipped cases in the final unit report.
  Long finite-ration marches at 1x/5x, save continuation, reactions, assault,
  physical crew relief, construction and living-menu regression coverage pass.
- **27/27 maintained Edge checks, 258.15 seconds**, no flaky, skipped or
  unexpected results. Includes the explicitly synthetic fixture tests described
  in the evidence README; those are not relabeled as full player playthroughs.
- Current production/standalone and strict-TypeScript DEV builds pass;
  packaging **5/5**. Existing large-chunk warnings remain. Portable output:
  **1,409,988 bytes / 1377 KiB**, two embedded workers. SHA-256:
  `f179cc5b2bfb2bf0eb69b660a0c2229a63bf9f14cbe2ebf7cd76f5a3c57bde38`.
- Network-disabled isolated Edge file launch: real attract world, actual
  movement, both workers, exact paused save/Continue, six refresh sizes and
  no console/page errors pass. The 96-person previous-rules migration probe
  preserves the original input, identities, locations, orders, stocks, wound
  and manual pause while adapting mobile rest and obsolete supply waits.
- Failed evidence is retained separately. **This repair milestone: IMPLEMENTED /
  AUTOMATED VERIFIED / UI BROWSER VERIFIED.** Integrated new combat, wider
  logistics/artillery, physical phone and subjective acceptance remain open;
  this does not clear the overall **PARTIAL** release status.
