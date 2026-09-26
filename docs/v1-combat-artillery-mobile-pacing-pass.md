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
