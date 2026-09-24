# Current-build gameplay audit — 24 September 2026

Baseline: `98e838fc0c34d9f71c5258f2700d18d988be753f`, verified equal to fetched `origin/master`. No gameplay changes preceded these checks. Disposable Edge sessions used the production build at port 4175. The player's native window and saved campaign were not used or modified.

## Method and limitations

Real menu, map, selection, drawing and support controls issued every baseline order. Read-only telemetry recorded simulation state; it did not move units, reveal targets for orders, advance ticks or create results. Public objectives and friendly positions guided moves. Screenshots, action scripts, JSON and failed probes remain under `output/playwright/gameplay-rescue/` (local, ignored). Reusable telemetry is in `scripts/qa-gameplay-*.cjs`.

These are bounded opening/command playtests, not completed operations or a claim of enjoyable gameplay. Simulation time is authoritative. Wall-clock times include investigation, pauses and a background-throttled headed window; they are **not valid player pacing measurements**. Subsequent tests use a separate headless Edge renderer to avoid desktop occlusion. Script selector, off-screen target guards and modal-handling failures are preserved, not counted as game failures. Two repeated construction probe attempts produced four legitimate jobs; this is not a duplicate-order game bug.

| Opening | Setup | Useful first decision | Observed result before fixes |
|---|---|---|---|
| Breakthrough | Medium defaults; seed 252594337 | Immediately plan two approaches with four rifle squads | First visible contact at 554.45 simulation seconds. No shots, combat casualties or objective progress by 560.6 s. At 280.55 s the approach was still uneventful. Three infantry group movement orders, one mortar relocation, one successful smoke request and one declined friendly-danger confirmation. |
| Defend the Line | Medium defaults; seed 1944 | Immediately extend the prepared line with engineers | Four queued/connected jobs complete by 82.7 s; at 3.15 s the team is approaching with zero diggers. Stationary mortar smoke launched and completed. A moving mortar accepted a mission at 285.7 s then cancelled on the next tick. No contact, shots or casualties by 461.8 s. |
| Meeting Engagement | Medium defaults; seed 1944 | Immediately choose an approach to public contested ground | One group move for four rifle squads at 0.1 s. Still approaching at 175.25 s with no contact, shots or casualties. River crossing splits the approaches. Longer observation retained separately. |

There is at least one long pre-contact travel period in each opening. Decision density, first casualty and final objective times are not fully measured; absent events are censored, not zero. No pacing/force-size/generator tuning is justified by these three seeds alone. Five seeds per operation remain the gate for that work.

## Ranked player-impact failures

1. **No ordinary troop-spawning control.** Confirmed by the player's correction and both menu/HUD inspection. Only Developer / Performance → Spawn 300 exists; `BattlefieldSimulation.spawnStressSoldiers` is not a proper deployment workflow. Smallest scoped addition: explicit sandbox placement of usable squads, with a visible capacity limit and accounted equipment. Do not silently make finite operations unlimited or alter campaign reserve rules. Explain their finite force/reserve policy in the same discoverable panel.
2. **Mortars accept an already impossible order, then contradict the confirmation.** Defend seed 1944: select mortar, issue a move, request smoke 65 m away while still moving. Toast says preparing; next tick mission is cancelled. `SupportWeapons.requestSupport` omits the readiness checks present in `stepSupport`; `FrontlinesApp.onSupport` also uses the first selected squad even if another selected squad is the mortar. Validate readiness before accepting, choose an eligible selected team, preserve ammunition and show exact stage/reason. No movement teleport or automatic cancellation of standing orders.
3. **Support ammunition and progress are hidden/mislabelled.** Mortar selection says Ammo Good based on rifle rounds; no shell counts, crew requirement, range or countdown. Drawer status uses raw `mortarSmoke` IDs and updates only while open. `BattlefieldUI`/`FieldReadout`: add compact role-specific counts/status, actionable unavailable reasons, and a visible Hold action. Normal smoke did work: request 153.3 s, launch 168.3 s, impact 171.84 s in the defense fixture. Do not claim the entire support system is broken.
4. **Weapon setup looks like an emergency and obscures actual problems.** Screenshots show “Setting up BAR” and “Setting up Crew machine gun” in global warning slots before any contact. `renderAlerts` promotes every `combat.pauseReason`; routine reload/setup belongs in selected-unit status. Preserve genuine crew/ammunition/path failure warnings. MG physical crew/cohesion remains a separate behavioral check; setup text alone does not prove the gun is malfunctioning.
5. **Construction state is misleading and context selection is awkward.** At 3.15 s the UI says Excavating while the engineer order reports “0 digging · 2 work fronts · 4 trenches.” All four jobs subsequently finish. `FieldReadout` labels order type, not work progress; `BuildPanel` defaults to the first network instead of selected engineers' network. Show approaching/paused/digging separately, use relevant network context, keep the existing queue/branch algorithm. Do not replace working excavation based on this test.
6. **Some command promises need clearer boundaries.** Defend is specifically an assignment to completed, reachable trench space within 40 m, not arbitrary field defense. Support buttons are enabled for rifle selections. Hold is buried in Details. Give relevant actions, requirements and failures at the point of use. Preserve the existing tactical intent and reaction layering.
7. **Pre-contact pacing is slow, but broader tuning is not yet supported.** The observed approach and defense waits warrant a multi-seed follow-up, not faster soldiers, a smaller world or new omniscient enemy logic. Owners: deployment/operation generation and approach choices. No tuning in the first fixes.
8. **Untimed modes are labelled OPEN FRONT indiscriminately.** `OperationUI.update` uses that text whenever duration is zero, including Breakthrough. Use a neutral no-time-limit label; do not change objectives or mission identity.

## Command coverage and unresolved checks

- Move: real map destination orders advance squads; long routes need broader cohesion/blocked-route testing. Map terrain click closes the map; test scripts must not then toggle it back open.
- Observe / Suppress / Assault / Withdraw: code paths inspected, independent live command transitions and under-fire comparisons still to finish. Do not claim tactical differentiation validated solely from type names.
- Defend: existing prepared-position assignments observed; invalid/general-area expectations need clearer wording. Physical capacity and visibility constraints remain intact.
- Build: real center/branch drawings finish and queues drain. Failed automation guards were off-screen test targets, not failed excavation. Support-facility assignment/cost system must remain physical.
- Support: real smoke completes; friendly explosive danger prompt works; moving-mortar immediate cancellation reproduced. Grenade and HE outcome comparisons remain to test.
- MG: observed gunner on watch and assistants resting nearby; no verified crew-loss firing comparison yet. Do not invent a combat result.

### Extended baseline, still before reloading these sessions

The original-bundle defense session subsequently reached first contact at 612.45 s, first shot at 690.8 s and the combat proxy at 758.3 s; no friendly casualty by 792.45 s. Meeting reached contact at 431.1 s, without shots by 449.95 s. A separate independent command probe then confirmed Observe facing/hold, 13 rounds expended by Suppress, and persistent Assault/Withdraw movement intents. These empty-area test shots are excluded from combat-onset metrics. Details and limitations are in the rescue report.

### Additional root cause found during the readability replay

The now-visible MG status still showed 4 seconds of setup remaining after 5.8 seconds stopped. `SmallArmsSystem` checked the next-shot cooldown **before** calling weapon handling, delaying setup/reload start. The minimal fix moves handling ahead of that gate while retaining firing cadence and all physical readiness checks. A matched fresh-operation Edge check is now set/watching after the same window. Focused regressions cover setup during cooldown, movement restarting setup, and ammunition-conserving reloads. This is a responsiveness repair, not MG lethality tuning.

## Fix boundaries

Implement the evidenced control/readiness/feedback defects first, in separate commits. Sandbox deployment is the player's explicit requested feature; short operations stay finite and Open Front replacements stay on their transport schedule. No changes to world scale, visibility, damage, movement speeds, casualty care, operation objectives or enemy information. Record exact verification and remaining gaps in `gameplay-rescue-report.md`.
