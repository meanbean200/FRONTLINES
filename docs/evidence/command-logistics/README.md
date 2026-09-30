# Command surfaces and workload-based logistics — 2026-09-29

Baseline: `92101cb43ae1ea6dde98c7fd4f5557007dd677e1` (`master`).
**Validated implementation milestone; overall PARTIAL — PLAYER ACCEPTANCE NOT CLEARED.**
The previous objective/outcome work already present in the checkout was retained,
integrated and regression-tested. No original save, failed evidence, DEV/Endless
system or Road Cut publication was removed.

## What changed

- Gameplay inspectors share a pinned identity, tabs and primary-action area with
  one detail scroller. Optional details replace repeated instructions. Construction,
  reinforcement, artillery and assault panels follow the same hierarchy. Controls
  retain at least 44-pixel targets in the tested desktop and emulated touch layouts.
- Empty positions no longer receive per-object food, water, material, medical or
  grenade floors. Demand comes from actual personnel, unpaid construction and
  staffed weapons. Shared finite trucks can serve the same real demand without
  duplicating inbound claims or exceeding destination capacity. Priority and oldest
  service decide allocation; making another trench does not create another truck.
- Normal hauling and personal resupply share bounded, formation-local known-threat
  queries. Haulers can use a longer safe route, replan, or wait with their physical
  cargo. An initial unsafe approach reports NO SAFE APPROACH without replacing a
  current duty; a second read-only geometric query distinguishes fighting from an
  impassable route. Critical-ammunition pickups carry saved urgency before loading
  and collect ammunition only. Neither routes nor AI opening decisions inspect
  hidden enemy coordinates. Untouched forward stock says awaiting a foot carrier,
  not that an imaginary carrier is already collecting it.
- Secured towns expose finite stock, Recover supplies and Set as supply point.
  A change waits for current handoffs, leaves old stock physically recoverable,
  then requires real truck and foot travel to the new point. Contested/lost hubs
  cannot silently continue supplying the player. The UI does not promise that
  every town shortens the route.
- New normal Open Front starts use 72 player / 64 enemy personnel by default;
  the explicit smaller/larger choices are 64/56 and 80/72. Finite starting kit and
  stock scale through production creation. Old armies and Endless are not enlarged.
  Opening AI scouts public forward ground, assembles, consolidates and then commits;
  contact can occur during every phase. There is no mandatory ceasefire.
- Mounted-MG service and relief destinations are separate from operating berths.
  Ammunition is carried to the service bay before transfer; approaching/reloading
  people are not presented as operational crew. Nearby routine reserves avoid the
  weapon workspace. Physical relief survives save/load.
- World-facing position/weapon/transport names replace raw organizational IDs.
  Formation labels are positioned each frame with bounded decluttering and leader
  lines, including reserved town-label space; no camera-motion hiding or lag tween.
- Four-gun placement retains four individual sites and physical facing, with a
  bounded arrow and `80 / 128 · 48 more` material feedback.

## Actual Edge playthroughs

All player-facing sequences used normal controls in isolated installed-Edge
profiles, seed 1944, production preview. Read-only diagnostics and saved snapshots
were inspected; no solved runtime world or debug advancement was injected.

### Developed-position run

1. Started normal Open Front, 72 player / 64 enemy personnel.
2. Drew and completed a roughly 106-metre new trench and ten short, mostly-empty
   trenches, alongside the existing staffed positions. Built an MG and four-gun
   battery through the construction controls; real material and carrier trips
   completed the orders. All four guns were built and individually assigned crew.
3. Moved Charlie/Fox to Saint-Martin, secured the town, inspected its finite stock,
   requested recovery and changed a position's supply point.
4. Observed a carrier collect six food/five water, walk back with that exact load,
   and finish the delivery. No pickup credit was awarded before return.
5. At 902.75 simulation seconds, paused Save / refresh / Continue reproduced the
   complete state exactly, including the in-transit recovery load and built works.
6. Ten extra trenches left the finite fleet at eight trucks total (four per side).
   These empty works did not themselves become twenty separate garrisons; the
   distinct automated test below exercises twenty actual empty garrison objects.

Limits: this run exposed an initial AI staging mistake, not a successful combat
pacing result. Scouts chose a rear town and there were no reports or shots even at
1,253.85 seconds. This unsuccessful pacing run and its save are retained. It must
not be used to claim a successful fresh opening. The later continuation below
separately exercised this developed position under contact after the correction.
The chosen town hub was about 580 metres from its consuming position, farther
than the old 74-metre roadhead. The UI truthfully exposed that exception; this is
not evidence of an improved last-mile route.

### Fresh forward-staging run

After correcting staging to prefer public ground ahead of the deployment line,
started a new battle rather than modifying the first run's commander state.
Queued a new MG and four guns, left construction/logistics operating, and moved
16 scouts toward the publicly known town. A legitimate report was present by
309.9 seconds. At 610.6 seconds the saved production state contained 543 shots,
7 hits, 19 delivered player reports and all 72 player personnel still alive.
Saint-Martin was enemy-controlled and physically contested; the player rear had
not been automatically lost. The MG and three gun sites were complete; the fourth
was paid but unfinished. An MG and one gun had received real crew assignments.

This is real contact while support systems run, not a matched 64/72/80 playability
comparison or the complete combined acceptance scenario. In this second run the
tester placed the MG facing backward; its construction/crewing is verified, not
its fire against the town. Do not infer MG aiming failure from that placement.

### Developed campaign continued through contact and shell flight

Restored the unmodified browser storage backup from the first actual playthrough
into a separate Edge QA profile, then used Continue. This is an existing campaign
continued through the save UI, not an invented solved state or debug advancement.
The first failed opening remains failed; continuing it does not retroactively fix
its contact timing.

- Used Map / Manage to set the built position to Stand-to and resumed normally.
  At 1,471.35 seconds, the original completed trench, ten micro-trenches, MG,
  four individually staffed field guns, friendly secured town and eight trucks
  remained present. Twelve shots / two hits and a delivered report were recorded;
  the first player death at 1,459.55 had a combat-fire provenance record. No needs
  death is inferred. Save / refresh / Continue matched the complete state exactly.
- Fire support truthfully offered two of four guns: another crew was eating and
  the fourth gun lacked HE ammunition. Targeting the recorded report produced a
  friendly-danger confirmation; the tester dismissed it rather than firing into
  friendly troops. A separate nearby clear area was chosen through the camera and
  target controls. This is an area-fire workflow test, not a claimed hit on an
  observed enemy.
- Two guns prepared. One cancelled before launch because its crew rested, with
  zero rounds consumed. The other launched one real round at 1,491.35 seconds.
  Save / refresh / Continue at 1,495.65 reproduced the entire in-flight state
  exactly. At 1,504.95 the mission was complete, one round consumed, and exactly
  one matching crater existed at the resolved impact. The crater screenshot was
  reviewed. This verifies a partial salvo and safe interruption, **not** four guns
  firing successfully under sustained pressure.
- Map entry and Locate for the discovered trench worked after replacing the last
  primary `Enemy network 255` leak with `Enemy earthworks 01`. Names are numbered
  from the observer's existing records, remain stable through capture/save, and
  do not query hidden live trench state.

The run now combines developed works, town logistics and genuine contact, but
does not close the complete busy-MG / dangerous-haul / four-ready-gun acceptance
matrix. Actual saves and the full raw diagnostics remain local under
`output/playwright/delta/`; only selected reviewed evidence is curated here.

## Browser-discovered fixes and preserved failures

- Initial Edge run: 29/31 passed. Two failures found missing visible gun-order
  blockage explanations. HE/smoke actions now display the actual crew/ammo/roof
  blocker, and an unusable gun is not labeled READY. Original screenshots and
  contexts are in `failed-edge-first/`.
- Initial short-landscape inspector left only about 14 pixels for its detail
  body. `position-landscape.png` is the failed capture. The corrected layout widens
  in short landscape and the maintained check requires at least 55 usable pixels.
- Repeated map Locate exposed an entirely grey battlefield with working UI.
  ROOT CAUSE REPRODUCED: floating-point subtraction at a cached terrain seam could
  round a local coordinate to 32, then interpolate beyond the final tile row,
  producing NaN camera height. The fix samples the last valid cell at fraction 1.
  Negative-zero/subnormal/seam tests and a real-terrain camera-settling test fail
  before the fix and pass afterward. `terrain-seam-reproduction.txt` preserves the
  two original failures. A new actual-control Edge test watches 900 rendered
  frames after Map Locate without injecting camera or world state.
- Earlier whole-suite failures are retained locally: changed old demand-floor /
  naming expectations; one incorrect EMPTY/NOT REQUIRED readout; and a concurrent
  run with two timeouts (combat replay and the 72-hour loop soak). Timeout limits
  were not enlarged. Final serial results are recorded in the ledger after the
  frozen run completes.

## Focused coverage and interpretation

- `SupplyWorkload`: twenty empty actual garrisons, proportional 2/30/50-person
  demand, position-splitting invariance, real construction/crew/inbound claims,
  and three shared trucks loading only 12/12/8 of a 32-unit demand, or 12/12/1 for
  a 25-unit storage limit. Conservation and persistence remain checked.
- `KnownRouteThreat`: shorter exposed vs longer safer routes, expired reports,
  trench-loop routing, isolated/hidden-knowledge firewall, newly dangerous routes,
  cargo/task preservation, save/load, urgent ammo and locally experienced fire.
  Added initial NO SAFE APPROACH attribution without order mutation, physical
  blockage distinction, empty-cargo urgent pickup, ammo-only conservation and
  exact continuation. The final focused five-file pass was 26/26 tests.
- `SupplyPoints`: finite ownership-gated stock, queued handoff, physical old stock,
  no remote cargo credit, contested access, actual preview routes and persistence.
- `MountedMGTraffic`: synthetic production network with forty people, sixteen
  counterflow travellers, reserve/rest duties and actual ammunition service. No
  body-only stall over two seconds; no inventory imbalance; exact saved continuation.
  Existing occupied-network fixtures exercise eighty travellers and ninety-six
  total people, loops and matched uncongested journey time. These are controlled
  fixtures, not proof that the user's original screenshot cause is reproduced.
- `OpenFrontReadiness`: 64/72/80 finite-force checks and an explicit simultaneous
  role budget totaling 72; opening report/assembly decisions and Endless isolation.
  The budget is a design/implementation check, not subjective user acceptance.
- `OperationOutcome` and existing mission tests retain precise decisive results,
  saved causal objectives and a readable mission-rule surface.

## Screenshots

`position-overview-compact.png`, `commands-390x844.png`, `commands-844x390.png`,
`four-gun-preview-desktop.png`, `town-supply-command.png`,
`open-front-developed.png`, and `open-front-real-contact-release.png` were
visually reviewed. `developed-battery-target-preview.png`,
`developed-safer-battery-target.png` and `developed-shell-impact.png` show the
continued normal-play fire workflow. The original `offline-launch.json` predates the late terrain
fix and is retained as earlier evidence; use the separately named release result
for the shipped artifact. Raw playthrough saves/checkpoints and unsuccessful
screenshots remain under `output/playwright/delta/` and are not player saves.

## Shipped-artifact verification

- Final production/standalone and separate strict DEV builds passed, with the
  existing large-bundle warnings retained. Packaging: 5/5.
- Final maintained Edge suite: 32/32, 5.1 minutes, one worker. Desktop, portrait
  and short-landscape controls, eight desktop sizes, live selects, actual Map
  Locate, Save/Continue, weapon blockers and occupied counterflow all passed.
  Synthetic traffic/support fixtures are still explicitly separate from the
  normal playthroughs above.
- The new save fields reject malformed copies; urgency survives supply queues.
  The last focused six-file follow-up passed 32/32. The preceding full regression
  passed 952/952 across 143 files (378.75 seconds); it is preserved as
  `full-regression-pre-save-guard.txt`. The final frozen all-file repeat passed
  **953/953 tests across 143 files, 386.16 seconds**, one worker with unchanged
  timeouts; see `full-regression-final.txt`. It includes the final save guards and
  queue-urgency preservation. No simulation/UI source changed after this run.
- `FRONTLINES.html`: 1,482,506 bytes, two embedded workers, SHA-256
  `293700ef306b1a8e492d9cd7452663c0d534b9c88969a8887880924dd2b349a1`.
  `offline-shipped.json` is the network-disabled, isolated-copy run for this
  artifact: no page errors or external dependencies, actual movement, identical
  saved/continued state hashes, six refresh sizes from 390x844 to 2560x1440.
  Gameplay and portrait-menu screenshots were reviewed. Emulation does not clear
  physical-phone acceptance.
- `offline-launch.json` and `offline-release.json` are earlier artifacts retained
  for provenance, not the identity of this final file. Final logs use the
  `-shipped` suffix; earlier failed runs and intermediate passing runs remain.
  Curated text logs have normalized line endings/trailing whitespace for Git;
  original raw command outputs remain unchanged under `output/playwright/delta/`.

## Remaining acceptance

- A single ordinary corrected-build session combining all specified large/empty
  works, busy MG traffic, all four firing guns, captured town and dangerous-route
  hauling under pressure. The continuation adds real developed-position contact
  and a saved shell impact, but does not close every interaction in that gate.
- Initial unsafe-approach feedback and empty-cargo urgent ammo now have controlled
  regression coverage. Their occurrence during an ordinary under-fire hauling
  playthrough remains to be observed; no synthetic test is substituted for it.
- Full interactive MG congestion/arc checks, discovered enemy convoy interdiction
  through completed recovery, original rear-rush/MG screenshots, and user pacing
  comparison. The original long-journey deaths remain not causally reproduced.
- Physical-phone testing, principal 512-person performance, broader A–G gates,
  and the integrated combat/supply-interruption soak. The existing deterministic
  72-hour living-network regression is not that broader release soak.
- Extreme marker-density fallback can still overlap; no 1,000-person label or
  performance acceptance is asserted. Large-bundle warnings remain.

The foundation, Three.js, UI and playtest guidance kept simulation authority out
of presentation and required real controls/screenshots alongside deterministic
tests. Passing automation does not clear player judgment or platform submission.
