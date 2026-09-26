# Current playtest delta — first repair milestone

Starting commit: `e41c9795346bc6dad396ec8587ac2e70384eba07` (local and
remote master). The handoff's `20404c4` was stale; the delivered DEV editor and
authored living menu were retained. Overall release status remains **PARTIAL**.

## Reproductions and changes

- Crossing targets could repeatedly reset aim acquisition before a rifle,
  BAR or SMG fired. Tracking also survived a target's death through cooldown
  early returns. Six focused regressions failed before the fix. Live,
  observable, in-sector targets now retain priority; dead/incapacitated targets
  clear immediately. Legacy damage resolves in stable shot order, preventing a
  later shooter in the same tick from acquiring someone already killed.
- `movement-before.json`: four failed destination tests. The old 24-metre grid
  and 60-metre obstruction snap made destinations widely spread/off-centre.
  Occupied cells now centre on the click, weighted by formation size, within
  an 18-metre footprint. Obstacle adjustments are limited to 12 metres; truly
  blocked destinations report blockage instead of silently relocating far away.
- `needs-before.json`: the explicit legacy lethal setting still caused
  deprivation damage. This is a reproduction of that code path, **not proof of
  the original reported journey deaths**. The latest handoff explicitly removes
  hunger/thirst damage in all modes. Stored inventory and historical wounds/death
  provenance are preserved; no invisible refills or revived casualties.
- Missing water no longer initiates endless resupply waits or excludes fit
  workers/assault participants/guards. Food has a modest recovery benefit;
  actual carried rations and nearby stock remain physical and finite.
- Field rest is separate from sleep: nominal energy 25 to 45 in 45 simulation
  seconds, 50 seconds when very hungry, local cover within 12 metres when
  reachable, crouched/prone presentation, retained order/work/cargo, local route
  resumption. It supplies no sleep credit. Proper sleep still balances a
  rolling awake/sleep budget rather than resetting at calendar midnight.
- `field-rest-threat-reproduced.json` and
  `field-rest-authority-before.json`: sustained threat could repeatedly interrupt
  critical recovery at energy 10, and reaction movement could move an already
  resting person. Recovery now owns the body until complete; pinning remains
  active and casualty care still has priority. Both regressions pass in
  `field-rest-authority-final.json`. The earlier
  `field-rest-threat-before.json` was a fixture-initialization failure, not a
  gameplay reproduction.

## Player-facing checks

Headed Microsoft Edge, normal visible controls, isolated test session. Runtime
reads were passive diagnostics, not injected solved states:

- Quick Battle / Hold the Supply Road, select a squad, Move/Hold/Manage, People
  tab, Escape and viewport changes. The selection card is one compact lower-left
  surface; details/actions live in one tabbed inspector. At 844x390 the content
  scrolls independently while actions and tabs stay visible. Portrait 390x844
  keeps the command surface above global tools and compass out of objective text.
- Six rifle formations received a real right-click move. Target centroid was
  approximately 0.073 metres from the clicked ground point (camera projection
  rounding), with a compact 20-by-10-metre footprint. See
  `edge-layout-final.txt`; screenshot `multi-move.png`.
- Open Front, Reinforcements, Request 8, Locate, Transport details: reserve 48
  became 40 and incoming became 8, all eight manifests physically pending at
  the map edge while paused. No soldiers spawned into the destination. See
  `edge-reinforcements.txt`. This verifies the request/readout, not complete
  delivery/interdiction/night logistics acceptance.
- Opaque management panels occlude world labels. Duplicate Observe/Withdraw
  buttons are removed (Hold/Move express those intents); Suppress is contextual
  to fresh legitimate contacts. Resume works appears only with actual candidates.
  Routine recovery is local status, not a persistent prominent warning.

The maintained browser suite includes explicitly synthetic restored fixtures
for legacy decisions, casualties and congested traffic. Those are regressions,
not substitutes for the actual-control playthroughs above or a physical phone.

## Failed evidence retained

- `unit-first.json`: 841 passed / 20 failed. Several assertions still demanded
  lethal thirst, mobile sleep and automatic supply-emergency pause. They were
  updated to the new authorized rules, retaining physical transfer, injury,
  deterministic continuation and legacy decision tests.
- `regression-followup.json`: two legacy-resume fixtures omitted the stored
  previous speed; one long deterministic check timed out under concurrent load.
  `needs-final.json` subsequently passed all 29 then-current focused checks.
- `regression-probe.txt`: production menu support did physically fire from both
  sides before expired mission records were pruned. The test now records events
  over the whole cycle rather than examining only the final retained queue.
  The returning carrier really arrived and later accepted another pickup; the
  regression now checks that arrival event and exact saved continuation.
- `unit-second.json`: 864 passed / 1 failed. This in-flight run encountered the
  newly added threat-rest regression before the associated repair. It is not
  presented as a frozen-build result.
- First Edge subset: 21 passed / 3 failed. Two selectors referenced deliberately
  removed controls/readouts and were updated; one navigation was interrupted by
  source reload. Failure screenshots are retained. Final results are separate.

## Remaining gates

This is not the whole delta or A–G release. Still required: fully protected
finite-capacity settling/staging, complete cross-role/calendar survival matrix,
per-gun 12-second loading cycle and ammunition compartments, support-class
silhouettes and structural damage/repair, measured construction scaling,
selectable town/loose supplies, secured multi-hub recovery/interdiction/night
delivery, mission/AI improvements, 3-km/512-person default and performance,
physical-phone testing and the integrated 72-campaign-hour combat/shortage soak.
The existing supplied living-garrison soak does not satisfy that latter gate.

Actual squad firefight/death/rapid-fire/save-load acceptance, full logistics and
artillery player playthroughs, and subjective believability remain separate
requirements. No automation, training, cloud deployment or user-save overwrite.

## Browser and package verification on the frozen implementation

- `unit-final.json`: **865/865 tests, 127 files, 388.83 seconds**, no failures.
  This retains the 846-test baseline and adds 19 focused checks. Includes
  finite-stock 3.7-km marches at 1x/5x, deterministic restoration, reaction/
  assault/crew/construction regressions and the existing supplied living soak.
- `edge-final.json`: all 27 maintained Edge checks passed, no unexpected,
  skipped or flaky cases. Covers commands, position fire, detached assault
  membership, occupied traffic, pause behavior, reserves and viewport layouts.
- `offline-final.json`: isolated copied `FRONTLINES.html`, network disabled,
  real 64-person attract session, actual move, both worker responses, exact
  paused save/Continue and six refresh sizes pass; no console/page errors or
  HTTP dependencies. Viewports are 1280x720, 1920x1080, 2560x1440, 960x540,
  844x390 and 390x844, with visible 44-pixel home actions. Not physical-phone QA.
- Production/portable and separate strict-TypeScript DEV builds pass. Packaging
  5/5. Existing large-bundle warnings remain; no 512-person performance claim.
- `migration-probe.json`: explicit previous-rules fixture, 96 people, mobile
  sleep and obsolete supply wait. Loading converts the mobile recovery and
  releases the wait while retaining original serialized input, identities,
  coordinates, orders, duty, inventories, wound and manual pause. The retained
  legacy lethal flag does not enable sustenance damage.
- Portable output: 1,409,988 bytes, two embedded workers, SHA-256
  `f179cc5b2bfb2bf0eb69b660a0c2229a63bf9f14cbe2ebf7cd76f5a3c57bde38`.
