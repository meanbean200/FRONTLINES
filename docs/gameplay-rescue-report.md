# Gameplay rescue — first verified control pass

24 September 2026. **This fixes concrete control/readability problems; it is not a claim that the whole game is fun or finished.**

## Tested identities

- Baseline: `98e838fc0c34d9f71c5258f2700d18d988be753f`, fetched and verified current before work.
- Final gameplay/UI code: `604662f` (the following report/test commits do not change that runtime).
- Combat rules identity: `combat-25-world2`; impossible support requests are rejected before creating missions, and weapon handling runs independently of firing cooldown. Existing save schema, inventories and force identities are retained.
- Final production assets: `index-DyEilkAl.js`, `index-Cq_jAhtw.css`.

## What changed

| Player problem | Focused fix | Verification |
|---|---|---|
| No normal troop-spawn option | **Sandbox → Add troops**. Place 1, 3 or 5 eight-person rifle/engineer squads per click; repeat placement, Esc/right-click finishes. Clear-ground preview, overlap/terrain checks, 300-person limit, finite kit recorded as imports. | Actual Edge placement increased 28 to 52 people; new squads accepted movement. Unit tests cover multi-team IDs, inventory balance, rejected placement, limits and exact save/load. |
| Unclear battle reinforcement policy | **Reserves** in operations explains the fixed roster or displays the actual campaign pool/transit/release schedule. | Real control checks confirm short operations offer no sandbox spawn action. No battle roster expansion or reserve refills. |
| Mortar accepts moving/scattered/unready crew then instantly cancels | Shared readiness checks before acceptance and at launch; correct mortar selected within mixed selections; failed target selection stays active for correction. | Moving team disabled with “Hold [H]”; after Hold, smoke prepares, launches and completes. 6 smoke shells become 5, not an invisible refill. Dynamic cancellation and friendly-danger tests retained. |
| Support feels unresponsive | Actual HE/smoke counts, 15-second preparation and flight countdowns, human-readable mission names, stage/reason in the selection panel. Hold is now a main command. | Edge screenshots of preparation and impact; regression tests for readiness, mixed selection, roofs and clock-derived countdowns. |
| Engineer status says digging before work begins | Distinguish paused plans, approaching work fronts, actual diggers/progress and interrupted work. Build opens the selected/nearby friendly network and explains support assignment steps. | Same defense seed: live two-branch draw shows approach at 0%, then both trenches complete. Existing queue/loop/branch algorithm is unchanged. |
| Gun setup presented as an emergency | Selected machine-gun readout explains travel, 5-second setup, 2-person crew, separation, reload, gunner duty/incapacitation. Routine setup/reload/preparation removed from global warnings. | Unit state-transition checks and real Edge readiness check. Actual pinning, crew-unavailable, casualty and shortage warnings retained. |
| Gun waits before starting setup/reload | Move weapon handling ahead of the firing-cooldown gate. Movement still resets setup, crews still matter, and shots still obey cadence. | Two focused regressions. Matched real Edge 5.8-second stopped window: before, 4 seconds of setup still remained; after, the gun is set and watching. No ammunition spent by setup/reload. |
| Untimed Meeting/Breakthrough falsely called Open Front | Neutral “NO TIME LIMIT” caption. | Production Edge regression checks mission identity and caption. |

Runtime files changed: `src/combat/SupportWeapons.ts`, `src/combat/SmallArmsSystem.ts`, `src/garrison/GarrisonPolicy.ts`, `src/simulation/SandboxDeployment.ts`, `src/input/CommandInput.ts`, `src/app/FrontlinesApp.ts`, `src/construction/ConstructionReadout.ts`, `src/ui/BattlefieldUI.ts`, `src/ui/FieldReadout.ts`, `src/ui/WeaponReadout.ts`, `src/ui/DeploymentPanel.ts`, `src/ui/BuildPanel.ts`, `src/ui/OperationUI.ts`, `src/ui/hud.css`. No world, visibility, damage, speed, objective, casualty or commander rewrite.

## Baseline observations

Full ranked findings and reproduction notes: [current-build audit](gameplay-audit-current.md).

Times below are **simulation seconds**, sampled every 0.5 wall seconds; first-event timestamps have sampling uncertainty. Pauses, script investigation and desktop occlusion contaminated wall-clock timing, so no wall-clock decision-density claim is made.

| Medium opening | First contact | First shot | Meaningful combat proxy | Friendly casualty | Observation endpoint |
|---|---:|---:|---:|---|---:|
| Breakthrough, seed 252594337 | 554.45 | Not observed | Not observed | Not observed | 560.6 |
| Defend the Line, seed 1944 | 612.45 | 690.8 | 758.3 | Not observed | 792.45 |
| Meeting Engagement, seed 1944 | 431.1 | Not observed during approach | Not observed during approach | Not observed | 449.95 |

Meaningful-combat proxy = at least five shots and a hit or friendly suppression above 10. It is not a subjective fun score. Missing events are censored, not zero. Objective progress was not established in these opening windows. First useful decisions were immediately available (choose approach, reserve disposition, or trench extension); the following travel/wait periods were long.

### Orders and UI friction

- Breakthrough: three infantry-group movement orders (two approaches, then another advance), one mortar relocation, one successful smoke order, one HE danger prompt declined. No measured ignored move. Long pre-contact travel remains.
- Defense: four engineer drawings across repeated test attempts completed by 82.7 s; two were duplicate *test attempts*, not a spontaneous game defect. Stationary mortar smoke completed. A moving-mortar request at 285.7 s gave a false preparing confirmation then cancelled; now it is blocked up front with a remedy.
- Meeting: one initial four-squad map move. Separate command probe then issued Observe, Suppress, Assault and Withdraw. Observe held/faced; Suppress consumed 13 real rounds in 5.5 s; Assault and Withdraw retained their respective intents while moving. These deliberate empty-area shots are **not counted as first enemy combat**. Telemetry was stopped before that probe to avoid mixing the measurements.
- Baseline friction verified: missing spawn control, wrong-role support enabled, hidden shell/readiness state, false mortar acceptance, routine setup warnings, misleading construction state. Some failed probes were our selectors, off-screen coordinates and an extra map-toggle key; those are not scored as player/game failures.

## Before / after limits

| Measure | Before | After |
|---|---|---|
| Normal sandbox troop deployment | Absent | Actual batch placement and subsequent movement verified |
| Moving mortar request | Accepted, then cancelled with stale toast | Disabled/explained before targeting; command boundary also rejects it |
| Support confirmation through impact | Generic confirmation, drawer-only state | Selection countdown, stage and conserved shell count |
| Engineer approach | Labelled Excavating with zero diggers | Labelled Approaching; pause and actual digging separate |
| Connected excavation completion | Working in tested fixture | Still working; no speed or digging-algorithm change |
| MG setup feedback | Global emergency warning | Selected-team readiness, genuine failures still warnings |
| MG handling timing | Setup/reload checks delayed until shot cooldown expires | Setup/reload proceeds during cooldown; only firing waits |
| Contact timing / operation pacing | Long observed waits | **Not tuned; no demonstrated improvement claimed** |
| Overall command corrections / decision density | Not comprehensively counted | **Not established**; completed targeted control loops only |

Targeted before/after support and construction sequences were replayed through controls. A full matched replay of all three operations through casualties/objective resolution remains outstanding. Do not interpret these partial playtests as that gate passing.

## Actual command promises

- **Move:** navigate to a clicked destination or follow the drawn corridor, subject to terrain and existing cautious reactions. Building clicks use existing door/interior navigation. No newly guaranteed perfect cohesion.
- **Hold:** stop movement and leave autonomous trench duty. Now visible in the main bar; useful before mortar setup. Does not teleport a dispersed crew together.
- **Observe:** hold and face the selected direction. Does not gain hidden enemy knowledge or an invented spotting bonus. Live facing/order transition checked; under-fire comparative value remains unproven.
- **Suppress:** expend ammunition into the ordered area. Live ammunition expenditure checked; useful pressure still depends on actual shot paths/near misses. No guaranteed suppression from merely selecting the command.
- **Assault:** movement with assault intent and existing reactions/cooperation. The independent probe confirms persistence during travel, not a uniquely convincing assault behavior. This remains a design weakness to investigate.
- **Withdraw:** movement with fall-back intent; existing cooperation code does not wait for covering fire on this intent. Live travel/intent checked, not a full broken-unit withdrawal comparison.
- **Defend:** occupy/defend reachable completed trenches; frontage must be nearby and capacity must permit it. This is not general-area defense on bare ground. Existing validation remains.
- **Build:** draw main trenches; queues and branches remain physical. Support structures still require an assigned engineer, delivered materials, clearance and a 6–40 m rear connector. No instant buildings.
- **Support:** one shell per mission, not a barrage. Mortar range 50–900 m; 2 ready crew near the squad center; stationary and open-air. Grenades have a 30 m throw. HE friendly-danger confirmation and launch-time safety remain. Smoke completed live; HE/grenade protection/accounting are regression-tested, not newly claimed as full live combat acceptance.

## Tests and evidence

- Final `npm test`: **62 files / 439 tests passed**, 87.22 s. Includes existing deterministic save continuation, complex earthworks, physical inventory, replacements, information boundaries and 72-campaign-hour living soak. This is not a new large mixed-combat soak. The earlier pre-handling pass also passed 437 tests.
- `npm run build`: passed. Existing Vite bundle-size warning remains (main JS about 936 kB, 270 kB gzip).
- First development-server UI pass: **15 passed / 1 failed**. During live source edits the 1024×768 case observed a reset main menu and default canvas size. This run was confounded by development reloads; its screenshot/context were preserved under `output/playwright/gameplay-rescue/e2e-first/`.
- Clean production-build Edge pass: **16 / 16 passed**, 1.1 min. Includes 1920×1080, 2560×1440, 1654×910, 1366×768, 1280×720, 1024×768, 2560×1080 and 1280×540. Separate config: `output/playwright/gameplay-rescue/e2e-production.config.ts`.
- Actual CLI-controlled Edge checks, screenshots and detailed JSON: `output/playwright/gameplay-rescue/`. Representative files: `support-after.json`, `support-after-preparing.png`, `support-after-impact.png`, `spawn-after-r2.json`, `spawn-preview.png`, `spawn-placed.png`, `engineering-after.json`, `engineer-after-approach.png`, `engineer-after-complete.png`, `command-baseline.json`, `presentation-final.json`, `presentation-timing-final.json`, `machine-gun-handling-final.png`.
- Prior failing probes retained. Player profile/saves were not touched, resized, reloaded, closed or overwritten. All tests used disposable sessions. No agents, automation restart, training, purchases or publishing/deployment.

## Remaining problems and next gates

1. **Pacing:** run five seeds per operation, with active-wall timing and full outcomes, before changing deployment/preparation/commitment distances. Opening waits of 7–10 simulation minutes deserve work; this pass did not solve them.
2. **Tactical differentiation:** Move versus Assault still lacks demonstrated distinct player value; test under contact, suppression, support interruption and leader loss before changing it.
3. **Crew behavior:** MG handling timing is repaired, but autonomous garrison crew rotations are not redesigned. Mortars still require manual regrouping if separated, and missions are single-round only. No claim of improved MG lethality/coordination.
4. **Construction:** tested queues/branches finish, but the support-building workflow retains prerequisites. More varied blocked/multi-team jobs and a novice playthrough are needed; choosing the first fit engineer may still be suboptimal when no engineer is explicitly selected.
5. **Mode coverage:** Open Front was protected, not substantially replayed/redesigned. Short operations remain finite-force. Direct spawning is intentionally Sandbox-only.
6. **Performance:** no new 300-/1,000-person mixed-combat p95 benchmark in this pass. The 300-person sandbox placement cap is a safety bound, not proof of frame-rate targets.
7. **Acceptance:** no full matched before/after operation replays through victory/defeat, no broad novel combat soak, and no user judgment that the experience is now believable or enjoyable. Those remain separate gates.

To load the update in an already-running player window: save any battle you want to keep, then refresh. The running window was deliberately left alone.
