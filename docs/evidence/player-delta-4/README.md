# Player playtest delta 4

Started 2026-10-01 from verified local/remote master
`1072d7cf678c7153afe485b8e124e128ab35669c`.

**PARTIAL — PLAYER ACCEPTANCE NOT CLEARED.**
The prior Open Front reset is delivered and preserved. This is an implementation
and verification pass, not permission to replace physical systems or lower troop
counts/simulation fidelity. Controlled fixtures are distinguished from missing
original player incident states and from actual-control playthroughs.

## Initial status and scope

- Open Front reset: IMPLEMENTED / BROWSER VERIFIED / PLAYER REPORT: GAMEPLAY MUCH BETTER.
- Direct fire into terrain / uphill firing: USER-REPORTED / MULTIPLE DIRECT-FIRE WEAPONS / ROOT CAUSE UNKNOWN / P0 OPEN.
- Large-battle lag: USER-REPORTED / 136-PERSON SHORT PROFILE EXISTS / 300-512-1000 ACCEPTANCE UNVERIFIED / P0 OPEN.
- High graphics quality: PLAYER REQUESTED / EXISTING HIGH HAS HIGHER NUMERIC FIDELITY BUDGETS / VISUAL UPGRADE OPEN.
- Building usefulness: PLAYER-REJECTED CURRENT VALUE / PHYSICAL OCCUPANCY AND FIRING FOUNDATIONS EXIST / DIFFERENTIATED VALUE OPEN.
- Construction stalls after starting: USER-REPORTED WITH TWO UNFINISHED FIELD GUNS / ORIGINAL ROOT CAUSE UNKNOWN / P0 OPEN.
- Persistent auto workers: CURRENT AUTO-WORKER FOUNDATION EXISTS / DEFAULT PERSISTENT PLAYER CONSTRUCTION AUTOSTAFFING NOT ESTABLISHED / OPEN.
- Construction priority: NOT PRESENT IN CURRENT WORKORDER MODEL / OPEN.
- Artillery targeting overlay: PLAYER-REJECTED / CURRENT CLOSED SUPPORT CIRCLE PRESENTATION VERIFIED / OPEN.
- Reinforcement pacing: PLAYER-REJECTED / CURRENT 24-CAMPAIGN-HOUR COOLDOWN SOURCE VERIFIED / OPEN.
- Smoke movement awareness: PLAYER REQUESTED / SMOKE VISIBILITY EXISTS / LOCAL NAVIGATION RESPONSE NOT FOUND / OPEN.

## Work sequence

1. Record firing/construction failures and busy-battle scaling before optimization.
2. Repair demonstrated geometry/worker causes; persisted priorities and truthful diagnostics.
3. Finite responsive releases, smoke-aware local travel and physically useful building readouts.
4. Measured structural optimization, distinct High rendering, restrained fire-control overlay.
5. Same-rule/save regressions, actual Edge normal-control play, busy 136/300/512/1000
   ladder (Balanced and High), build/offline checks, scoped commit/push.

Art direction: grounded earth/wood/steel, readable sunlight and contact depth,
soft physical smoke, short-lived impacts; thin, calm field-map orders above the
battle. No simulation effects from quality selection. No fake building bonuses.
Evidence is retained under `output/playwright/player-delta-4/` during development.

## Implemented scope and honest status

| Issue | Current evidence boundary |
|---|---|
| Open Front reset | IMPLEMENTED / BROWSER VERIFIED / PLAYER REPORT: GAMEPLAY MUCH BETTER. Preserved 2400 m, 72/64, unprepared start, physical enemy works and rear-depot victory. |
| Uphill direct fire | Original USER-REPORTED incident and ROOT CAUSE UNKNOWN / P0 OPEN. Controlled muzzle-inside-earth and replacement-gunner pitch defects REPRODUCED / IMPLEMENTED. Fifteen production-geometry layouts record 1000 seeded shots each; this is not the missing original save or pixel-level muzzle validation. |
| Construction stalls | Original two-gun incident UNKNOWN. A separate ordinary-play second-gun stall REPRODUCED at 903.4 s: idle friendlies indefinitely vetoed both starting work faces. Repaired, same saved battle continued to completion through controls; a second fresh construction run also completed. |
| Auto workers / priority | IMPLEMENTED / controlled and ordinary-control BROWSER VERIFIED. New ordered facilities default ON, persistent eligible replacements, four persisted priority levels, protected roles/cargo and truthful current blockers. Actual casualty-triggered replacement in a crowded battle remains unverified. |
| Physical supply | Two additional controlled defects REPRODUCED / IMPLEMENTED: a loaded carrier must retain/retry an inaccessible return without picking up twice; urgent HE/smoke claims must be collectable, not only small-arms ammunition. Actual HE/smoke delivery and one successful field-gun round verified. |
| Finite reinforcement cadence | IMPLEMENTED / BROWSER VERIFIED. New normal Open Front uses 240 simulation seconds between eight-person releases; existing unset saves keep their previous daily schedule. Physical travel is separate. |
| Buildings | IMPLEMENTED / physical farmhouse and barn occupation BROWSER VERIFIED. Inspector reports actual capacity, openings, elevation, road distance and friendly recoverable stock; no fictitious percentage bonus/storage. Idle defensive AI's missed building opportunity reproduced and regression-fixed. AI occupation not separately browser-accepted. |
| Smoke movement | IMPLEMENTED / controlled matched matrix VERIFIED for both factions. Actual friendly junction crossing under real smoke VERIFIED, including order/crew preservation and clear-out. Full opposing-traffic ordinary campaign gate remains open. |
| High / targeting | IMPLEMENTED / BROWSER REVIEWED. Contact/soil depth, richer lighting, smoke/impacts and displacement-driven dust remain presentation-only. Thin no-fill, explicitly named danger overlay at two zooms. Commercial-quality/player visual acceptance still OPEN. |
| Large-battle performance | Busy 136/300/512/1000 ladder now MEASURED, including 512 Balanced and High. Structural optimizations retain fixed-tick results in matched tests. 512 p95 target and larger-population 5x remain FAIL / P0 OPEN; see [performance.md](performance.md). |

### Source and save boundaries

- `combat-47-player-delta4-world2`, existing V4 storage key. Optional work priority,
  access explanation, loaded-pickup state and smoke-turn memory are validated and
  persisted. Earlier V46 saves do not replay previous needs migrations; missing
  reinforcement interval retains the old cadence. No army enlargement or refill.
- Exact geometry caches are bounded and invalidate on terrain/building changes.
  Live entities, broad-phase candidates and observation queries retain the same
  ordered physical checks. Quality never changes visibility, opacity, accuracy,
  inventory, AI knowledge or simulation advancement.
- `ShotEvent` diagnostics distinguish intended aim, dispersed projection, first
  impact and origin. Mounted presentation now uses the same *active* operator as
  ballistics, including when the first listed gunner is incapacitated.
- No worker is teleported through a wall or granted a second work face. Ordinary
  fit friendly bodies are a soft obstruction; real work reservations, crew/care,
  explicit orders, sleep and enemies still constrain a cutting face.

The final controlled firing matrix produced **zero impacts within eight metres of
the muzzle** in all fifteen 1000-shot clear-solution layouts. Some dispersed shots
correctly hit terrain farther along the ray; those are not deleted or hidden.
`regression-final-r3.txt` retains sample rays and every layout's totals.

Smoke matrix: eight people took 53.65 s on the clear multi-junction route, versus
74.05 s (player) and 73.10 s (enemy) in smoke. All arrived; measured wrong turns
were zero and the longest body-stationary interval was .90 s. Reorientation
accounted for 325 / 340 person-ticks (50 ms each), not that many separate pauses.
Maximum distance from the leading sampled person grew from 8.05 m to
21.72 / 19.14 m. These are controlled route/spacing measures, not full combat-traffic
or human believability certification.

## Ordinary-control Edge playthroughs

Both were new normal seed-1944 Open Front battles in isolated installed-Edge
profiles, production preview, 1654 x 910. All construction, priority, staffing,
movement, smoke, fire, reserve and save orders used visible controls. Read-only
diagnostics measured state. No solved-state injection, advance hook, inventory
editing or hidden-enemy coordinates were used to pass these paths. Controlled
tests and the synthetic performance saves are separate evidence.

### First battle: reproduce and continue the stalled work

- Built a trench, two field guns, inline MG and utility store, with CRITICAL /
  NORMAL / HIGH / LOW priorities. The second paid gun stalled at connector .001:
  tool carrier and helper present, ordinary idle soldiers reserving its starting
  faces. The diagnostic includes work IDs, distance, tools, duty, claims and stock.
- Preserved the actual 903.4 s save. After the work-face repair, continuing that
  same battle through UI speed controls completed gun 02 around 1140 s and all
  four facilities by 1448.95 s. No progress was injected.
- Requested eight reserves at 1571 s. The finite pool fell, UI showed approximately
  3:58 until next release, and physical arrivals joined by 1781.9 s. Not twenty-plus
  minutes. MG firing consumed its ammunition and a later real supply trip restored
  it; the broader late-game understaffed/ammunition chain remains open.
- The later depleted battle was not relabeled as a fully supplied acceptance
  state. It was paused and its campaign save preserved.

### Fresh repeat: construction, supply, artillery, smoke and buildings

| Simulation time | Actual observation |
|---:|---|
| 26 to 200.1 s | How dug a 50 m trench from an unprepared field. |
| 200.1 s | Four facilities ordered: field guns 436/438, MG 440 and store 441, with CRITICAL/NORMAL/HIGH/LOW priorities and auto workers ON. How and Dog assigned through UI. |
| 302 to 677 s | Truck delivered to the forward roadhead, then carriers walked the approximately 223 m last mile; claims, actual payments and connector progress were inspected. No immediate/free build. |
| 756.55 / 812.70 / 813.30 / 872.15 s | Gun 01 / store / MG / gun 02 completed. Low-priority stock already in transit was not confiscated to fake a strict completion order. |
| 860.4 s | Save, refresh and Continue preserved people, stocks, progress and duties. Existing save normalization pruned seven completed enemy queue entries and added policy metadata; full raw JSON was therefore NOT identical. |
| 920 to 1240 s | Gun and MG crews walked to their posts. MG had 120 rounds. Carrier 279 brought actual HE/smoke from the roadhead; gun 01 received two HE and one smoke round. |
| 1249.7 to 1269.7 s | First salvo cancelled when crew became exhausted; no round consumed. This is interruption evidence, not a successful firing claim. |
| 1335.25 / 1355.25 / 1359.91 s | Recovered crew received a second order, discharged, then produced the authoritative impact/crater. Exactly one HE round consumed. Second gun completion is verified, but it was not independently fired in this repeat. |
| 1362.3 to 1435 s | Real grenade order consumed one grenade; cloud appeared at 1365.35. Dog's seven mobile members followed the retained order through the smoky trench while its assigned gunner remained at the post. Order finished by 1398.25; cloud expired at 1425.35. |
| 1435.2 to 1692 s | George physically occupied all eight barn places; Fox reached seven upper-floor farmhouse places. The eighth soldier was disabled on the stairs by enemy artillery event 509 at 1688 s, not by marching/needs. Wound provenance records that cause. No scripted casualties. |
| 1692 s | Final Save/refresh/Continue preserved all people, supplies, positions, wounds and operation state. Only three completed facility-504 queue entries were removed. Original and loaded snapshots retained. |

High was selected through Settings. Targeting was inspected at two zooms, with
actual ready-gun/range/traverse/friendly-risk feedback and thin danger lines, not a
made-up maximum range. Farmhouse's +3.4 m upper floor, sixteen total sheltered
places and directional openings differ physically from the barn's eight places.
The barn UI truthfully exposed one soldier's unavailable local food.

The final wait originally targeted 1750 s, but contact/actual speed meant the
45-second browser wait expired at 1692 s. Its timeout and paused state are retained;
the evidence above uses the measured time, not the intended endpoint. Screenshots
named `fresh-farmhouse-arrivals-high.png` show the actual 1692 s state.

## Evidence inventory and verification

Raw local directory: `output/playwright/player-delta-4/`. Selected evidence is
copied alongside this document for repository review; campaign snapshots and
large CPU/GC traces remain local. No original or failed evidence was removed.

- Before/after: `work-face-*`, `forward-return-*`, `urgent-shell-*`,
  `replacement-muzzle-*`, `idle-building-*`.
- Ordinary state: `ordinary-gun02-stall-*`, `fixed-gun-browser-progress.txt`,
  `ordinary-two-guns-complete.txt`, `fresh-520-work-progress.txt`,
  `fresh-1120-physical-resupply.txt`, `fresh-artillery-*-salvo.txt`,
  `fresh-smoke-*.txt`, and `fresh-1692-*-refresh-state.txt`.
- Screens: `ordinary-high-built-position.png`,
  `reinforcement-request-cadence.png`, `fresh-completed-position.png`,
  `fresh-artillery-overlay-{wide,high}.png`, `fresh-smoke-in-motion-high.png`,
  `fresh-{farmhouse-arrivals,barn-occupied}-high.png`.
- Failed working regression `regression-first-integrated.txt` and
  `regression-final-r1.txt` preserved. r2 passed 1034/1034 before later narrow
  regressions; final source verification is recorded below, not inferred from r2.
  The return-approach regression now advances the documented three-second retry
  interval while checking unchanged cargo on every intermediate tick. Default-auto
  expectations changed with the explicitly requested default. The first AI-building
  after-run chose a different valid nearby house; the corrected fixture checks a
  real nearby structure and matching plan, not an unjustified specific house ID.
- Edge r6 was 33/35: two selection helpers raced the moving camera and selected
  actual soldiers instead of empty ground. Corrected by waiting for camera settle
  and projecting a checked empty area, still issuing real mouse input. No relaxed
  gameplay assertions. r7 then passed 35/35; final repeat recorded below.
- Construction-defective early performance fixtures, two neutral cache
  experiments, the cancelled salvo and browser timeout remain distinguishable
  from passing cases. Neither neutral optimization ships.
- The final busy-scene screenshot exposed a new HUD overlap: the measured-speed
  readout extended to y=90.95 while a combat alert began at y=80. A focused Edge
  layout test reproduced it before repair (`rate-layout-before.txt`). The readout
  now reserves clearance from alerts and compact mission text at 1654x910,
  960x540, 844x390 and 390x844. This test is explicitly a presentation-only DOM
  fixture; the original overlap was observed in the real measured overload scene.

### Final verification

- Final source: **1048/1048 tests, 161 files, 191.55 s PASS**, quiet run with our
  QA renderers closed. `regression-final-r3.txt`; suite timeout limits were not
  increased. This includes the maintained loop-network/supply soak, not the still
  outstanding full ordinary Open Front combat/supply campaign soak.
- Production/standalone, separate developer build and **5/5 packaging checks
  PASS** (`build-r12.txt`, `dev-build-r12.txt`, `packaging-r12.txt`). Existing
  large-bundle warnings remain. Portable HTML is 1,538,310 bytes with two embedded
  workers. After the final CSS-only readout repair, presentation/rate checks also
  passed **12/12** (`presentation-r12.txt`); no later simulation change.
- Final maintained installed-Edge controls: **36/36 PASS, 4.5 minutes**,
  `edge-r12.txt`. Includes pause/5x front buttons, touch front controls, occupied
  counterflow, actual mortar controls, reserve configurations, save/load and eight
  desktop sizes plus narrow/landscape-phone layouts. The additional readout-layout
  test covers four sizes. Some maintained tests use
  declared authored fixtures; they are not mislabeled as normal setup playthroughs.
- Installed Edge, networking disabled: isolated one-file `FRONTLINES.html` and
  `index.html` companion launch both **PASS** real movement, exact Save/Continue,
  no page errors/network dependencies, and six refresh sizes including 390x844
  and 2560x1440. Results: `offline-r12.json`, `index-launch-r12.json`; final gameplay
  and portrait-menu screenshots reviewed (`offline-*-r12.png`). This is not
  physical-phone testing. Prior r11 evidence remains preserved.
- Tested portable SHA-256:
  `aca77191564ee55ff76a1d5f8e0c6401d58054f6e0a38d95174b43977eb387da`.
  No release or platform-submission certification is implied. Final busy-ladder
  results are recorded separately in [performance.md](performance.md).
- Final build-r12 ladder: 136 sustains **1.000x / 5.000x** with **6.2 / 12.2 ms**
  p95; 512 Balanced/High at 1x are **48.5 / 48.6 ms p95**. Their selected 5x
  achieves **1.372x / 1.305x**, not 5x. 1000 advances about **.40x**. All ten rows
  completed without page errors. The **512 performance gate remains failed**.

## Remaining acceptance / next work

1. Capture the player's original uphill-firing and unfinished-gun states; inspect
   failed authoritative rays/work histories before claiming those exact causes.
2. Reduce measured LOS/terrain-intelligence spikes further. The 512-person p95
   gate is not waived by a smooth 136-person battle or average 1x advancement.
3. Actual casualty-driven replacement, opposing traffic under smoke, sustained
   crowded MG/relief and late-game interrupted delivery/recovery across more seeds.
4. Full ordinary Open Front combat/supply soak and varied combined save points.
5. Native display pacing, physical mid-range phone and player visual/game-feel
   review. Desktop emulation/build success cannot supply these judgments.
