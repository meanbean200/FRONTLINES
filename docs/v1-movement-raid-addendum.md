# V1 movement / raid addendum — engineering report

Baseline: `961b94421de54f6b03b4f3aa8e20e2256829496d` (the addendum's `4672ddf` predates the preceding repair pass).

## Claims and QA inventory

- USER-REPORTED: large groups jam in forests, villages, and narrow approaches.
- USER-REPORTED: trench raids do not form a coherent playable loop.
- No blanket FIXED or raid acceptance claim yet.

Movement checks: 1/3/5 squads through sparse/dense trees, building gaps and streets; opposing traffic, corners, interruption/resumption, save/load. Use persistent destinations, record individual arrival and collision state, not just squad centres. Compare baseline and repair. Browser inputs: Add troops, formation selection, map/right-click movement, pause/speed, Save/Load. Capture departure, constrained transit, and arrival.

Raid checks: normal scout discovery, remembered target selection, at least three prepared assault squads, distinct staging/entries, support, WAIT, Save/Load, same-tick GO, approach, physical entry, progressive clearing, informed defender response, capture, front/rest/resupply. Also failure/regroup and explicit cancellation. No state injection counts as browser acceptance.

Performance: separate 1/5-squad forest, 5-squad village, raid/support windows; record simulation advancement alongside frame costs. Automated fixtures are not player acceptance. Preserve failing runs.

Implementation sequence: reproduce movement first; repair shared routes/local passage and persistence; integrate persistent raid phases on the same movement authority; focused regressions; actual browser paths; full tests/build/offline checks; report exact remaining gaps.

## Result and claim ceiling

**Partial delivery, not V1 completion.** The reproduced village stranding case is repaired. Five-squad forest travel and mid-route save/load completed without rescue orders. The new raid phases were exercised in a real battle through discovery, three-squad preparation, WAIT/save/reload, GO, physical entry, partial clearing, defender alarm, and failed-raid withdrawal. **The complete successful raid/capture/reorganization sequence has NOT passed browser acceptance. Signal at the Orchard remains an unaccepted mission.**

The playtest skill required ordinary controls and screenshot inspection. This exposed a blocked supply roadhead and a missing field-gun facing control that synthetic raid tests did not catch. No agents, neural training, automation restart, save deletion, or player-profile modification was used.

## USER-REPORTED / REPRODUCED / ROOT CAUSE / FIXED

### Large formations

- USER-REPORTED: large groups get stuck in forests, buildings and narrow gaps.
- REPRODUCED: baseline 3- and 5-squad village regressions stranded followers or marked a squad Hold before every walker arrived. In actual Sandbox controls, five newly placed squads crossed Le Verger from about `(-1220,-1390)` to `(-930,-1390)`. Person 260 stayed at `(-975.514,-1403.540)`, 21.57 m from its formation destination, while every squad reported Hold. Baseline and repaired arrival snapshots/screens are retained.
- ROOT CAUSE: shared waypoint advancement and completion used the squad centre, not individual progress. Wide fixed offsets pushed followers into corners. The old local walker tried only short perpendicular slides and had no persistent individual detour. **The old formation walker did not collide with trunks; it would be false to blame existing tree collision geometry for that baseline failure.**
- FIXED, narrow scope: the same five-squad village route now gets all 40 walkers to their destinations, all five squads Hold, without rescue commands; matching regressions pass. Five-squad forest routes also completed, including save/reload mid-route. The denser return took about 333 simulation seconds, with the last soldier taking a long detour around trees/parked comrades. That delay is still undesirable; this is not a claim that every formation bottleneck is solved.

Implementation: one shared route plus serialized per-person progress; temporary compression and individual final spacing; real building/trunk clearance; right-side local passing/body separation; displacement-based stalled detection; bounded personal replans (two per tick, cooldown, bounded search). Moving orders persist during interruption. Existing drawn-path and engineer walkers remain separate and retain their regressions; trunk collision is not claimed for every legacy movement authority.

### Raid loop

- USER-REPORTED: trench raiding needs a rebuild.
- REPRODUCED before repair: prepared assault was an ordinary move to a target coordinate, with no serialized entry/clearing/regroup phase or progressive search prerequisite for capture.
- ROOT CAUSE: the existing prepared order did not connect open-ground movement, individual trench entry, corridor movement and ownership transition into one persistent operation.
- IMPLEMENTED / PARTIALLY BROWSER VERIFIED: remembered-geometry approach lanes; stable separate entries even when squads are prepared in separate clicks; WAIT persistence; same-tick GO; per-person physical entry; observed-section search; reopened sections on fresh local contact; non-remote capture gate; failed assault regrouping; visible phase/reason. Local confirmed breaches commit defenders' reserve to threatened staffing without reading unseen attackers. Existing defense/withdrawal behavior remains, not a newly proven full counterattack doctrine.
- NOT FIXED / NOT ACCEPTED as a whole: the real battle ended with all three assault squads depleted and withdrawing. Capture and conversion to defensive assignment passed a deterministic fixture, **not the full real-battle acceptance sequence**. That fixture walks attackers from 100 m away; it still does not substitute for the combat acceptance gate or verify the subsequent front/rest/resupply sequence.

### Physical support blockers found during the raid

- REPRODUCED: a new trench crossed its nearest road projection. Shuttle 379 retained 48 materials at the blocked cut; the two placed work orders could not build. The road obstruction was real; the unloading endpoint was wrong.
- ROOT CAUSE: forward roadheads used an unchecked nearest-road point.
- FIXED for the reproduced case: find an accessible nearby apron on the rear-depot side. An empty invalid apron can be changed only without stock, a foot/medical pickup or an unloading truck. The loaded truck reroutes physically. It does not cross the trench, teleport cargo or bypass a severed road elsewhere. Loading the same blocked battle delivered materials and completed MG 460 and field gun 461. Conservation/save-continuation regressions pass.
- REPRODUCED: a finished field gun could not be re-aimed after the defensive front was changed. Added an explicit gun-facing control; crew identities/stocks remain and people must reach new handling points before firing. In the browser, the crew collected shells, became Ready, and a player-ordered HE mission eventually launched, consumed one round and impacted.
- UNRESOLVED: the first accepted HE mission cancelled with `MOVING TO POSITION` shortly after GO. A second normal order completed. A replay from the earlier save did not reproduce the same first cancellation (the gunner was already on a meal trip at the chosen request time). Preserve this failed run; do not claim the support-interruption issue fixed.
- REPRODUCED: the live 5× raid had 273–370 ms hitches. CPU profiling led to external supply pickup searches whose destination was explicitly forbidden trench floor. Saved-state instrumentation measured three futile searches at 171–238 ms.
- FIXED for that search cause: external pickup candidates no longer lie in closed trench banks, and an explicitly forbidden endpoint fails before A*. The same saved diagnostic window went from three slow searches to none (3.74 s to 2.96 s overall on this PC). Browser continuation no longer exhibited those large searches; other causes of frame hitches remain possible.

## Actual browser raid record

Disposable Edge contexts; normal mouse/keyboard/menu/map controls. Diagnostics only read state and timings. Player storage was never accessed. No teleport, enemy reveal, ammunition grant, casualty deletion or attacker placement inside the trench was used.

1. Quick Battle → Signal at the Orchard, medium U.S., seed 1944. 64 friendly and 48 enemy personnel initially.
2. Able advanced as scout; ordinary sight discovered network 251. Three formations were manually staged across frontage. Cover-aware automatic staging is still missing.
3. Formation 8 built a 50 m trench; local personnel constructed and crewed a mounted MG and a field gun using delivered materials. The roadhead failure above was repaired in the saved battle.
4. Baker, Charlie and Dog prepared assaults with distinct entries. WAIT at elapsed 189.7 survived Save/Reload exactly. The MG's formation added a support order. Support construction took long enough that staging under fire incurred losses before GO; this remains a gameplay pacing concern.
5. All four orders released at **777.9999999998402**, the same fixed tick. Movement and normal suppression/covering-fire interruptions continued.
6. A later HE request consumed one physical round and completed at elapsed 891.5. MG installation diagnostics recorded real effective fire; support labels alone were not used as evidence.
7. At elapsed 1055 Dog had two entrants; defenders recorded a local breach, raising required watch to 21. Baker/Charlie had physically regrouped and displayed failed-assault status.
8. Dog reached three entrants and searched sections progressively. The reviewed close screenshot shows **10/38** observed sections searched. Later fresh contacts reopened sections; the final snapshot has seven searched and Dog regrouping after further losses.
9. No remote capture occurred. No successful conversion, front setting or captured-position resupply was demonstrated in this battle.

## Coverage and remaining gates

| Case | Automated | Actual browser |
|---|---|---|
| 1/3/5 squads, village/street | Pass | Five-squad baseline/repaired matched route passes |
| 1/3/5 squads, two tree routes | Pass | Five-squad routes pass; one-squad profiling window only |
| Shared 4 m gap / wall clearance | Pass, explicit synthetic gap | Not yet |
| Opposing 3+3 friendly groups | Pass | Not yet |
| Suppression interruption/resumption | Pass | Raid advances interrupted by real incoming fire; not the full matrix |
| Mid-corner / forest save continuation | Exact fixture continuation | Dense forest route completed after save/load |
| WAIT, distinct entries, same-tick GO | Pass | Three assault + support, saved WAIT verified |
| Physical entry / progressive search | Pass | Three entrants; partial search; local defender breach response |
| Capture / converted defensive orders | Pass fixture | **Not accepted** |
| Failed assault / re-preparation | Pass | Two regrouped, third withdrawing; re-preparation not yet played through |
| Roadhead delivery / stocks retained | Pass | Blocked saved truck delivered; both weapons built |
| Gun facing / physical crew and shells | Pass | Re-aimed, crew arrived, later HE mission completed |

Remaining implementation/acceptance: automatic covered staging; a complete successful supported raid with buildings/constrained approach; stronger bounded recovery for a stuck individual inside a contested passage; newly discovered disconnected branches; explicit local defender fallback/counterattack playtests; re-preparation after a failed live raid; complete 1/3/5 browser obstacle matrix; 300/1,000-person performance and mixed-casualty 72-hour soak. Existing 72-hour logistics soak is not a new combined-combat raid soak. Subjective believability remains the user's decision.

## Performance evidence and limits

Headless Edge, 1600×900, local PC, 8-second windows; simulation advancement recorded. **These are diagnostic windows, not a 300-person release benchmark or physical-display acceptance.** Camera framing and battlefield state differ, so the rows are not a controlled before/after frame-time comparison. Forest/village profiling cameras do not keep the entire moving force centred throughout; screenshots expose that limitation.

| Window | Speed | Simulation seconds advanced | p95 frame interval | Maximum |
|---|---:|---:|---:|---:|
| 1 squad forest, 68 total people | 1× / 5× | 8.0 / 40.05 | 6.2 / 6.2 ms | 12.1 / 6.2 ms |
| 5 squads forest, 68 total people | 1× / 5× | 8.0 / 40.05 | 6.2 / 6.2 ms | 6.4 / 6.3 ms |
| 5 squads village, 68 total people | 1× / 5× | 8.0 / 40.05 | 6.2 / 6.2 ms | 18.3 / 6.3 ms |
| Initial supported raid, 112 total people | 1× / 5× | 8.0 / 30.95 | 12.1 / 24.3 ms | 24.4 / 370.5 ms |
| Later repaired raid, close view | 5× | 40.05 | 12.1 ms | 18.3 ms |

The initial 5× raid failed real-time advancement/frame goals. The later close view is lighter (7 visible trees versus 483); it cannot prove whole-scene performance fixed. The saved navigation diagnostic and CPU profile establish the specific futile-search repair independently. Separately, lazy priority-ordered small-arms sight checks reduced a deterministic replay diagnostic from 21.83 s to 14.23 s while preserving exact save continuation; no accuracy or damage calibration was changed.

## Verification / evidence

Final unit/regression suite: **744/744 tests, 104/104 files passed**, 100.69 seconds, with owned QA browsers closed. Combat-speed replay took 29.18 seconds and the 72-hour supplied loop soak 25.18 seconds. No timeout was increased. Earlier attempts are retained as failures: 733/735 (combat replay and async drawn-route timeout), then 739/739 at an intermediate build; a later 740/742 run timed out in combat-speed and 72-hour tests while multiple QA browsers were active.

Production build and **5/5 packaging tests passed**. The final standalone file embeds two workers and is 1,327,194 bytes. Its SHA-256 is `C695C817A01DF5CDC7FB5E11AC25193AC6EB8FCB1E4FD11C7AFF0D9F0976C8CE`. The Vite large-chunk warning remains; this pass did not change dependencies or bundling strategy.

Isolated offline Edge launch passed: no page errors, no HTTP/network dependencies, normal movement, exact save continuation (both hashes `f90e95627cf874b3f23cda898d9271d597dde53d717629f4d2af2bec3b156096`), and refresh fitting at 1280×720 and 1920×1080 without overflow. Menu and gameplay screenshots were visually reviewed. These launch checks are not full combat acceptance.

Final Edge browser regression suite: **23/23 passed**, 1.6 minutes, one worker. Includes normal spawning, finite-force messaging, MG inspection, mortar roof rejection and no-selection firing, Hold/crew persistence, contacts, command drawers, exact paused save/load, supply decisions, reserves, and eight desktop sizes from 1280×540 through 2560×1440. Fixtures in some support/contact tests isolate UI behavior and do not count as the live raid gate. Machine-readable results are in `docs/evidence/v1-movement-raid/browser-regressions.json`.

Initial failures exposed outdated tests: the meeting mission is now Race for the Hamlet with a phase readout; the old empty-selection box hit the mission HUD; and clicking a roof correctly selects its building, so the intentionally invalid roofed mortar fixture must be inspected through Positions → Weapons. Installing the first fixture consumes its carried weapon, so the separate outdoor fixture now starts a fresh operation instead of assuming the kit remains on the soldier. Only the test setup/interactions/expected mission copy changed; roof rejection, firing readiness, no-selection firing and save assertions remain. Failed runs remain at `output/playwright/movement-raid-final-e2e/`, `movement-raid-ui-final/`, and `movement-raid-roof-fixture/`.

Local raw evidence: `output/playwright/gameplay-reset-1790380485683/`. Retained artifacts include baseline/repaired village transit and arrival, dense forest save/load, WAIT before/after, support blockage, HE cancellation/success trace, CPU profile, partial clearing and failed regroup snapshots. Selected portable evidence is copied into `docs/evidence/v1-movement-raid/`. Those snapshots are evidence/reproduction inputs, not replacement player saves.

Source boundaries: new `FormationWalker` and `TrenchRaidSystem`; simulation owns movement/knowledge/ownership; renderer only displays phase/reason. Save v3 receives validated optional movement/raid/roadhead/breach state. Rules identity is `combat-40-formation-trench-raid-world2`; old saves retain their personnel and inventory, with normal existing compatibility handling. The standalone HTML must be regenerated with the production build. No general physics engine or unrelated major system was added.
