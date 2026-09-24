# Operations V2 — architecture and verification

## Audit and implementation boundary

The old factory, commander, victory evaluator, save validator and HUD all assume exactly three flags including `village`. Keep that behavior only for existing `advance`, `defense` and `campaign` saves/regression fixtures. New games use a definition registry, seed-dependent terrain placement and versioned operational runtime. Combat, drawn paths, construction and casualty rules are not replaced.

Definitions describe forces, intent and prepared sides. Placement chooses existing settlement/road data, deployment, rear areas, oriented depth bands and alternative road corridors. Runtime objective evaluators own area control, route control, viable breakthrough and hold-line conditions. The map displays planning geography, not an omniscient live front or compulsory movement path.

Breakthrough needs eight fit combat personnel from at least two formations beyond the belt, a usable connection and sustained consolidation. Defend the Line protects a broad rear boundary until relief, not one village. Meeting Engagement combines terrain control and opposing effectiveness. Open Front retains the existing physical convoy/replacement subsystem and finite reserves, with no match timer.

Optional settlements contain finite, ledger-accounted supplies; occupying them never creates a resource bonus. Old mission saves remain old missions. Operations runtime versioning is separate from unchanged combat rules.

## Implemented rules

| Operation | Starting force (player / enemy) | Primary intent | End condition |
| --- | --- | --- | --- |
| Breakthrough | 64 / 48 | Establish a viable force beyond a dispersed defensive belt, near any usable deep road | 8 fit rifle/MG personnel from 2 formations, local superiority and a road connection sustained for 90 seconds |
| Defend the Line | 48 / 64 | Deny sustained enemy entry into a broad rear boundary | Relief at 20 minutes or an incapable assault sustained for 30 seconds; enemy connected penetration for 90 seconds loses the operation |
| Meeting Engagement | 48 / 48 | Secure key terrain and defeat the opposing force's ability to contest it | Two selected terrain areas held for 90 seconds plus opposing fit combat strength at or below 45% of initial establishment |
| Open Front | 48 / 48 | Sustain access into the opposing rear | Viable connected penetration for 120 seconds; both factions have finite 48-person replacement pools through the existing transport chain |

"Fit" means active rifle/MG personnel with health at least 25, energy at least 15, morale at least 20, suppression below 75, ammunition, and no broken reaction. Other personnel still fight/work under existing simulation rules but do not replace the combat-force threshold. Irrecoverable force/formation losses end finite offensives instead of leaving an unwinnable active mission. No lethal-deprivation setting was enabled.

Roads are alternatives, not mandatory marching paths. Each connection uses the shared road graph and physical collision, water and excavation queries. A credible opposing group can interdict a corridor. At least one clear corridor must connect to the deep force. This is a bounded operational abstraction, not a detailed logistics frontage or line-of-sight interdiction model. Cache transfers, shipments and replacements remain physical and ledger-accounted.

The shipped seed generator selects four cardinal orientations; the geometry helpers support arbitrary unit-vector orientations, including a diagonal regression fixture. Strategic locations are selected from current terrain data. No extra terrain generator or ownership-painting engine was added.

Enemy planning receives own forces, public mission geometry and delivered reports. It never receives objective-evaluator truth, player orders, hidden current positions or hidden casualties. It scouts, commits, retains a reserve, reacts to reported penetration and regroups when ineffective. Existing mortar support requests use reported coordinates and the same finite-ammunition/friendly-fire checks. Regrouping may reassign nearby combat squads to friendly trenches, but cannot overwrite engineer construction orders.

The new runtime lives alongside the existing combat envelope. Legacy `advance`, `defense` and `campaign` saves retain their old objectives and rules; the new menu does not offer those modes. Operations schema version 2 is serialized under the existing 4 km save v3 key. New operations do not overwrite that key until an explicit Save. Unknown/incompatible operational definitions fail validation; no silent conversion or personnel refill occurs.

## Verification — September 24, 2026

- Final `npm test`: **57 files, 380 tests passed**, including 29 new Operations V2 tests. Existing rifle/combat, construction queues, navigation, inventory and save tests remain intact.
- `npm run build`: passed. Final runtime asset `index-DBVV_6Ob.js`; the existing >500 kB bundle warning remains.
- Placement checks: 20 seeds × 4 definitions, bounded road/zone geometry, all four cardinal orientations and varied settlement selection. Full deployment/stock/save checks cover three seeds per operation.
- Focused tests cover brief/unsupported penetration, two alternate road approaches, disrupted access, phase conditions, finite-force defeat, relief and breach outcomes, terrain plus effectiveness victory, optional-cache conservation, physical Open Front replacement delivery, legacy saves and exact fixed-step continuation.
- The information-firewall tests alter hidden player positions, health, orders, flag truth and evaluator state and require identical enemy observations and plans. A separate test requires mortar targeting to use the delivered report, not the target's live position.
- Actual headed Edge controls: all four operation launches, seed change, map open/close, squad selection, a right-drag movement order, save/load, Build inspector, 5× simulation, and a page reload followed by Load. Browser page-error lists were empty.
- Screenshots inspected at 1920×1080; menus checked at 1280×720 and 960×600; gameplay checked at 2560×1440 and 960×600. Small menus scroll without horizontal overflow. Battlefield canvas and HUD stay inside the viewport.
- Final-build live Edge check: 96-person Open Front advanced **93.5 simulation seconds in 18.7074 wall seconds** at 5×, with enemy orders, two support works and outbound trucks. Save/reload restored the exact paused time and commander state. Sampled p95 frame interval was 6.2 ms at 1600×900 Balanced. This is **not** a new 300/1,000-person performance certification; the earlier 300-person 5× limitation remains outside this pass.

### Extended actual-simulation runs

Fixed 0.05 s ticks; no combat/needs overrides. Breakthrough runs received the same two-squad advance on different roads. Meeting Engagement received orders to two terrain areas. The defender/campaign player was left in its initial positions. No later player resupply, rest, rescue or reserve commands were injected.

| Run | Simulation seconds | Result | Shots / hits | Deaths |
| --- | ---: | --- | ---: | ---: |
| Breakthrough, road 0 | 1800 | Active; exhausted force | 351 / 9 | 4 |
| Breakthrough, road 2 | 1800 | Active; exhausted force | 583 / 9 | 2 |
| Defend the Line | 1180.05 | Victory; opposing assault incapable | 390 / 1 | 1 |
| Meeting Engagement | 1800 | Active; exhausted force | 528 / 15 | 8 |
| Open Front | 1800 | Active; engagement | 1223 / 11 | 4 |

These are behavioral evidence, not proof of balance or successful player-led offensives. There were 84 periodic save validations plus validation of all five final states. Maximum inventory-accounting discrepancy was below 1.6e-11. State snapshots are retained for inspection/replay; the two Breakthrough routes produced different movement/contact/casualty outcomes without a scripted combat sequence.

### Failures found and fixed

1. First Save while a menu was already open did not expose Load until reopening. The menu now refreshes after saving and reports success/failure.
2. At 900.05 simulation seconds, a critical casualty that bled out retained `bleedUntil` after becoming fatal; this made a legitimate battle unsaveable. Clear the expired timer at the death transition. Regression verifies fatal save/load and no duplicate death accounting. No damage, accuracy or wound probability changed.
3. Restricted enemy regrouping to combat squads so it cannot steal an engineer construction order. Added a focused regression.

Original failed screenshots and the rejected full state are preserved. No user save or player browser profile was replaced during QA.

## Evidence locations and reproduction

Local, git-ignored evidence: `output/playwright/operations-v2/`.

- `browser-r2.json`: launch/menu/map/drawn order and seed checks; `r2-*.png` screenshots.
- `browser-live-r5.json`: final asset identity, real 5× clock, orders/logistics, exact reload and responsive gameplay; `r5-*.png` screenshots.
- `simulation-r1.json`: initial 600-second cases.
- `simulation-r2-failure-breakthrough-0-failed-save.json`: preserved rejected casualty state.
- `simulation-r4.json` and five `simulation-r4-*.state.json` files: extended runs, periodic snapshots and full final states. `final-state-validation.json` checks all final states against the release parser. These preceded the final combat-only regrouping guard; the guard is covered by the final full regression run.

Reproduce headless evidence with an unused output path:

```powershell
npx tsx scripts/check-operations-v2.ts output/playwright/operations-v2/new-run.json 1800
```

Browser scripts are `scripts/qa-operations-v2.cjs` and `scripts/qa-operations-v2-live.cjs`, run through `scripts/run-browser-probe.mjs` in an isolated headed Edge session. Give captures a new prefix/output path before rerunning; retain earlier evidence.

## Acceptance boundaries / next playtest

The architecture, four launchable operations, intent UI and deterministic rule gates are implemented. Human acceptance of pacing, difficulty and believability remains separate. Browser checks are interactive play slices, **not** complete browser-played victories in all four modes.

Long unsupported advances exhaust troops under the existing 30-minute campaign-day/needs rules. The HUD now explicitly says to rest, resupply and rotate squads. The next balance playtest should complete a supported Breakthrough with forward rest/supply works and reserve rotation, then assess whether march depth versus compressed-day fatigue needs adjustment. No fatigue/combat rewrite or invisible resupply was used to make the test win.

Withdrawal, destroy/neutralize and independently authored delay objectives are extension points, not shipped missions. There is no painted dynamic front, larger map, neural training, new engine, cloud service or restarted automation in this change.
