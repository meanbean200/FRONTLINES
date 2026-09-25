# V1 gameplay reset — implementation and acceptance record

## Start HEAD

`e7970766bfc7a5dcd40c5f7700306ad0d8e5d4d0`: local and remote master matched; clean tree before edits. This is a substantial implementation with incomplete acceptance, **not a declaration that V1 is finished or fun**.

## Player-reported failures

Unreliable multi-build construction; mortars and MG positions failing through real controls; a tiny/weak mortar visual; trench occupants shooting into walls; confusing supplies; practically unusable buildings; artificial enemy spotting circles; poor High graphics; and missions needing fresh design. These were observations, not assumed technical causes.

## Reproduction

Production `127.0.0.1:4175`, owned disposable headed Edge, normal menu/buttons/pointer/map/save/refresh. No state injection, extra resources, teleportation or debug time advancement in gameplay runs. Read-only state/projection/diagnostics captured alongside screenshots. No player profile was attached or resized, and no player saves were changed.

Main evidence: `output/playwright/gameplay-reset-1790355360749/`. Earlier failed runner `gameplay-reset-1790355301051/` retained. These outputs stay local, not committed. Injected performance fixtures are separately labelled diagnostics, not gameplay acceptance.

- Eight works: fresh Open Front, seed 1944, medium, Closer approach, 16 tools. Three trenches, two MGs, mortar, store and rest work placed before earlier work completed. Initial failure reproduced; fresh repeat completed all eight and survived mid-build refresh.
- Fresh defense: real mixed-formation MG crew assembled and fired. Another pit was placed, funded, built, crewed and fired with visible impact dust.
- Buildings: eight people entered an upper floor, saved/refreshed and exited. New defense used ground-floor windows in live combat and suffered casualties inside.
- New defense and meeting battles reached legitimate defeat after different doorway failures were reproduced and repaired. A loss demonstrates a terminal path, not good balance.

## Confirmed bugs

1. Automatically filled labor-only jobs never obtained a tool carrier; first jobs hoarded tools.
2. Unskilled assistants could obstruct the connector before a skilled builder.
3. Explicit per-person facility work also entered formation queues, giving overlapping authority.
4. Building orders and construction could reserve the same person. The first repair exposed stale duty references in the same tick and a rejected save; that failed save is retained.
5. Trench watch used a fictitious elevated floor, while body and rendered muzzle stayed lower.
6. Long building approaches could exhaust people without preserving travel through a recovery break.
7. Coarse navigation clipped a house corner. Old/interrupted approaches did not repair that leg.
8. Nearest-person doorway priority oscillated between flank arrivals as one needed to walk away from the door first. The live meeting battle stalled for hundreds of seconds.
9. The new attack evaluator initially treated expected enemy farm occupation as immediate defeat. Recapture now requires prior player occupation.
10. The first new attack layout projected its rear depot across the front onto the wrong road. This was observed in the aborted attack, not assumed from a placement test.
11. Interrupted building arrivals were given an indoor exit leg while still outside. Two saved flank arrivals walked into masonry and blocked the other arrivals. The reduced regression failed before repair.
12. The finite-operation terminal rule counted permanently disabling casualties as potential field strength. Reduced fixtures proved an impossible mission could remain active; temporary exhaustion must remain recoverable.
13. At 821 × 462, order confirmation covered the selected unit. A screenshot review found this despite correct viewport dimensions; a new rectangle-intersection assertion reproduced it.

## Root causes

One tool carrier is distributed before assistants; automatically staffed jobs repair a missing skill when available. Manual choices remain authoritative. Helpers wait clear until the tool carrier has a construction duty. Explicit work has one authority; migration removes redundant queue references without deleting physical work. Building orders are excluded before work and duty scheduling, including people still approaching.

Body, muzzle and shot presentation now use physical geometry. Guards/crews walk to usable banks; queries never levitate them. Explicit suppression may strike distant cover, but cannot fire through its own immediate bank.

Building routes validate individual exterior legs and use a bounded footprint-corner route if coarse navigation clips masonry. Blocked saved approaches are reconsidered at most every three seconds. Exiting/inside passages take priority, then waiting arrivals use stable identity rather than changing distance. The reduced seven-person priority fixture failed before the repair and passed afterward.

Cancelling an exterior building reservation now releases that reservation instead of routing through the interior. It also repairs the impossible first exit leg in earlier saved runs without teleporting people or changing inventory. New mission geography follows the road axis and chooses rear roads behind each force. Earlier geography remains versioned and loadable. Narrow-screen order feedback moves to the lower right, clear of selection.

## Construction reliability

Baseline 233.95 s: mortar/store/rest had materials and assigned laborers, but no tool carrier. A separate headless continuation to 641 s remained stuck (diagnostic, not acceptance). Fresh repeat: **all eight complete by 267.50 s**. Saved/refreshed at **206.10 s** with active work. See `08-*`, `09-*`, `10-completed-build-state.json`, `10-eight-builds-complete.png`.

MultiBuild regressions cover simultaneous work, tool distribution, worker/material uniqueness, cancellation isolation, no-stealing, continuation, queue migration and building-order conflict. In the meeting battle, forward trench work stopped after its tool carriers became casualties; this was a personnel loss, not a disappearing job.

## MG

Fresh defense position **396**, mixed crew **293 / 265**: 16 delivered materials, physical arrival around 221 s, setup by 226, nine shots by 254.55. At 323.20 shot sequence was 26, with 34 loaded rounds. `30-mg-engaged.json` preserves the authoritative ShotEvent, people, ammo and aim. Screens `29-*`–`32-*` inspected.

The first Open Front MG was Ready but had no useful observed target in range: **not counted as engagement**. New defense's rearward MG also fired zero shots; its poor placement behind the village is retained as negative tactical evidence. Diagnostics expose equipment, crew positions, ammo, setup/cooldown, local reports, range, facing/sector, muzzle clearance, suppression and duties.

The integration fixture also builds, walks and supplies a mixed crew, acquires/engages, rejects invalid sectors and stops without ammo. It supplements the real browser engagement.

## Mortar

Fresh defense pit **400**, crew **300 / 304**, mission **410**: requested 961.65, launched 976.65, impact 980.234 at approximately (-468.87, -286.64). One physical HE round consumed. `38-*`/`39-*` retain state; **`41-mortar-impact-dust.png` was opened and visibly shows impact dust**.

Earlier pit 407 missions launched/consumed rounds, but `17-mortar-visible-impact.png` did not establish visible impact at night; its misleading filename is not counted as proof. New-defense pit 393 completed HE and smoke; smoke mission 420 requested 732.30, launched 747.30, impact 752.02. Preparation/flight/consumption/cancellation appear at the selected pit. Readout no longer caps actual crew ammo at a smaller refill target.

The mortar has a metre-scale baseplate, bipod, sight, traversing gear and elevated tube; equipment appears only when physically present. Empty ammunition does not make the weapon vanish.

The attack's later attempt at 1524.60 s was correctly blocked because both crew members were sleeping, not because equipment disappeared. `109-mortar-unavailable.*` records their identities, energy, ammunition and duties. Its generic fire-control explanation was improved to “Mortar gunner resting · recovering energy; equipment remains assigned,” with a separate suppression/casualty reason. A failing-before/passing-after read-only regression and `111-resting-crew-readout.*` verify that message. Readiness rules and inventories are unchanged.

After recovery, the same assigned people physically returned and the pit displayed Ready. A further normal-control HE mission **433** was requested at **1877.55**, launched **1892.55**, impacted **1898.15**, and consumed one round (`114-mortar-after-rest.json`). No equipment/energy/ammo was injected to get it working again.

## Trench firing

Actual body floor, muzzle, shoulder clearance and rendered weapon agree. Fresh squad-local reports can cause a short continuous move to a clear edge; no permanent soldier-owned slots or omniscient facing. Explicit posts, handovers, crews and orders are preserved.

Regressions cover narrow/wide cuts, eight directions, bend, blocked T-junction center and clear outer edge, mounted parapet, suppression into distant cover and barrel/flash alignment. **Live multi-direction junction fighting and a matched supported/unsupported advance remain unaccepted.** Dispersion can still strike earth; a clear aimed ray does not guarantee every miss clears the bank.

## Buildings

Click a house to use the existing contextual inspector: formation, real floor capacities, Occupy, View floor, Exit and Locate. It distinguishes fit firing reservations, actual people inside and wounded occupants. Cutaways show friendly interiors, not hidden enemies.

House 72: all eight Able reached the upper floor, saved/refreshed at 549.35, and physically exited by 636.80. New defense house 48: eight ground-floor occupants fired from real windows (several reached 22–24 shots) and took casualties. The saved masonry-corner failure was repaired; enemy occupation then ended the defense at **1303.05 s**. Meeting exposed the separate changing-priority failure; repairing it allowed occupation and defeat at **1164.05 s**.

The fresh version-two attack exposed a third exterior-exit failure at 1235.20 s. The unchanged saved battle was loaded after repair: by 1335.30, all four surviving Baker soldiers reached upper-floor firing positions, Dog's survivor held the ground floor, and actual house possession was recognized. `104-*` preserves the failure and `105-house-exit-repaired.*` the continuation.

Fourteen building tests cover these failures, two squads/full floor, stairs, exit/entry, casualty rescue, exhaustion, wall/window rays on both floors and save validation. Quiet rest consumes actual personal rations and retains the route, without healing wounds. **An uninstructed independent tester and successful opposed building-to-building assault are still missing.**

## Supply

One inspector answers **Here / Requested / Inbound** using full resource names, separate personal packs and concrete truck/forward/foot-carrier/depot reasons. Demand remains position-owned. Truck inspection lists real cargo, destination, related construction and blockage. No invisible refill.

The meeting run's delayed materials were traced at 978.15: carriers held 7, 10 and 11 construction materials returning from the road. Both positions were paid by 1078.25. Cargo was not lost, but the carry was slow and exposed. The bad new-attack depot projection was then repaired for new sessions. In the fresh version-two attack, a 30 m forward trench completed at 1115.10 and received a real truck unloading at 1163; ammunition/food/water later satisfied the delivery condition. Foot-carry pacing, equipment recovery and more-seed road composition still need work; accounting correctness is not good pacing.

## Contact presentation

Removed uncertain-contact ground rings. Received reports use restrained grouped annotations; sounds remain coarse, anonymous and aged. No hidden live location/identity determines those markers. Explosive danger zones remain distinct. Information-boundary readout tests accompany the change.

## Visual quality

Actual presentation work: grounded duckboards/sloped revetment, junction-aware dressing, shot-aligned guns/hands, substantial mortar equipment, broad warped fields, softer ground relief, worn house thresholds/yards, neutral daylight/readable night fill, and pooled short grass near the camera. Grass stays below cover height and does not change concealment or navigation. No blur or fidelity-number inflation.

Dressing uses revision-cached 32 m tiles and bounded generation. Low omits it; Balanced limits local range; High extends detail. Existing shadow/pixel-ratio presets stay. Completed trenches remain terrain, not plotting overlays.

The matched evening images `96-*` were too dark, especially around the mortar and banks. Night sky fill/exposure was raised without changing daylight or simulation visibility; `99-*` uses the same paused state/camera at all three settings after that repair. All six were opened. The pit and banks are more readable, but the High/Balanced difference remains subtle at this zoom.

Viewed results still have repetitive house layouts and field/tree silhouettes. **Commercial-level art rescue and a convincingly superior High preset are not demonstrated.** Sharper High rendering is not a substitute for stronger environment composition.

## New mission design

New sessions use three real-object situations, not renamed score circles:

| Mission | Immediate problem | Physical success |
| --- | --- | --- |
| The Farm Approach | Enemy trench screens a road-side farm | Three fit people in cleared prepared line, two inside farm, forward truck delivery, open road |
| Road to the Rear | 90 seconds before scouts; choose works around a short communications trench | Occupied/supplied billet, open road, finite attack repelled |
| A Foothold at the Crossroads | Both forces approach an unoccupied hamlet; no prepared lines | Occupied house, 25 m completed trench held by three people, delivery and road |

Briefings explain possession, supplies and failure. HUD reports House / Trench (or Repel attack) / Delivery / Road and a current reason. Map uses real generated houses, trenches and roads. Enemy command uses public terrain/objectives, own forces and received reports, not hidden player progress. No free replacements or scripted casualties.

Old operation runtime geometry/objectives continue loading. New mission-plan version two fixes road-side staging; version-one plans from this pass reconstruct their original geography when loaded. No people, stocks or structures are moved by migration. Optional `houseTaken` preserves earlier states from this pass. Finite-force losses now exclude serious casualties who cannot return: attack/meeting require five field-capable people (two in the building plus three in the line), defense two. Temporary exhaustion alone is not defeat. New combat rules identity invalidates stale neural artifacts, with rule fallback. No training. Open Front remains separate.

This is **implemented content, not three accepted strong missions**. Version-one defense/meeting losses are complete. The corrected version-two attack and winning-path browser status are recorded below. Full defense/meeting reruns on final version-two geography, more seeds and pacing work remain necessary.

## Real browser playtests

| Run | Result |
| --- | --- |
| Eight concurrent works | Fresh repeat passed, all eight complete, mid-build refresh exact; initial failure preserved |
| MG | Built, supplied, mixed crew arrived and fired; distant/backline placements did not engage |
| Mortar | HE full cycle and visible dust; smoke separately consumed a round; night attempt insufficient |
| Building use | Upper-floor entry/save/exit passed; occupied window combat observed; three live building/doorway failures repaired |
| Road to the Rear, mission-plan v1 | **Loss**, 1303.05 s, 22/48 fit. House mattered; rear MG ineffective; corner failure delayed enemy occupation |
| A Foothold at the Crossroads, mission-plan v1 | **Loss**, 1164.05 s. Unsupported Able/Baker advance disabled both leads; rear trench/delivery worked, support too late; priority deadlock initially prevented conclusion |
| The Farm Approach, mission-plan v1 | **Aborted at 147.70 s**, bad depot/front geography. Saved state retained; not a completed battle |
| The Farm Approach, mission-plan v2 | Fresh 48 versus 32, Closer/1944; built line, MG and mortar, HE missions, flank maneuver, farm occupation, forward line and physical shipment. MG carrier wounded before crew assignment; explicit no-gunner reason, not counted as MG engagement. **Suspended/saved at 1910.15 s, not a completed mission:** 15 active, 18 incapacitated, 15 dead. Farm/delivery/road secured, enemy line still not cleared. Costly, ammunition-starved trench assault withdrawn. This is negative pacing/balance evidence, not a win or an accepted start-to-finish attack |

Acceptance questions, without pretending to be an independent player:

- **Confusion:** click-house/selected-pit usable by this tester. Marker/inspector overlap still needs careful clicks; no uninstructed acceptance.
- **Waiting:** too much on long equipment walks and the meeting supply carry. A completed work is not necessarily a useful position.
- **Stupid behavior:** doorway oscillation, corner clipping and exterior-to-interior exit routing were real failures, now repaired. Exposed unsupported advances suffered losses, but planning support needs clarity.
- **Weapon failures:** required MG/mortar paths work in measured runs; poor placement/dead equipment carriers still lead to bad outcomes.
- **Construction:** eight works repeat predictably; combat and tool loss still delay them.
- **Supplies:** physically traceable now; awkward staging/walking remains negative.
- **Buildings/trenches:** useful real windows, casualties, physical defensive works observed; not every angle/town accepted.
- **Looks, distinctness, fun:** three situations differ mechanically; two complete losses do not prove replay value. Visuals remain procedural. User acceptance remains separate.

## Screenshot review

Opened construction baseline/completion, MG position/engagement, mortar attempts and real dust, occupied/casualty cutaways, work/supply inspectors and outcomes.

Useful reviewed main-directory images: `10-eight-builds-complete.png`, `30-mg-engaged.png`, `33-building-occupied.png`, `41-mortar-impact-dust.png`, `45-*` matched wide qualities (before final dressing), `51-*` trench/MG, `58-*` terrain/yards, `68-house-close.png`, `71-defense-door-recovery.png`, `82-meeting-after-door-priority.png`.

Also opened `91-*` completed support, `93-*` attack and mortar order, `94-*` house fight, all `96-*`/`99-*` matched quality images, `105-house-exit-repaired.png` and `106-attack-line-move.png`. Opened the 300 High 5× and 1000 Balanced 5× diagnostic images: actual combat, but the camera exposes the world boundary, so these are not art-composition evidence. The 821-pixel iframe screenshot initially revealed overlapping feedback; the corrected `viewport-1790363858046/iframe-gameplay-821.png` was opened and shows the toast clear of selection. Latest final-build viewport results are below.

Opened `112-upper-trench-advance.png` (real assault, casualties and tracer), `115-attack-final-suspended.png` (completed mortar/connected works in daylight), and `viewport-1790364631797/production-gameplay-1920.png`. `111-*` is readout evidence only: it caught a blank view during the immediate reload/camera transition, not an accepted battlefield image; `112-*` confirms the populated scene afterward. The final transition smoke screenshot also caught this transient despite a nonzero triangle count, so a triangle-count readiness check alone is insufficient. Its exact cause was not isolated; do not describe it as a proven viewport or worker defect.

An image is not reviewed merely because saved. `17-mortar-visible-impact.png` is rejected as visual proof. The paused MG still is not proof of a millisecond flash; real shot state is retained.

## Test results

Final full suite: **85 files / 655 tests**, all passing. Includes existing 72-campaign-hour stock/congestion soak, fixed-step parity and save continuation. Focused new coverage includes 14 building, 13 mission and 8 multi-build tests. Tests do not substitute for play.

TypeScript/Vite production and portable HTML build pass, about **1215 KiB**, two embedded workers. Final production entry `main-DtgCKy1R.js`. Existing chunk-size warning remains. Final scope review also restored the untouched legacy constructor's 45 m row spacing; compact 35 m rows apply only to the new missions.

Final-build viewport regression: **58 samples / 51 checks / zero recorded page exceptions**, production, standalone, actual iframe, size/DPR/reload, pointer/label alignment and unobscured order feedback. Latest evidence `output/playwright/viewport-1790364944153/`. Failed toast-overlap run `viewport-1790363796356/` is retained. Host authority unchanged; no player browser attached. Five packaging checks passed.

Five real save/refresh pairs match every captured field except explicit save-layer `policySchema` metadata: mid-build, upper floor, defense setup, active battle, meeting construction. `save-comparison.json` preserves results. Earlier rejected save not counted.

### Performance

Real 112-person defense: about **6.2 ms p95** at 1×/5×; ~5/~25 simulation seconds advanced over five wall seconds.

Initial injected 300/1000-person runs produced **zero shots** and were rejected as combat evidence. Preserved. Final firing benchmark: `output/playwright/gameplay-reset-final-performance-1790364734263/`, disposable Edge, 1616×888 CSS pixels, DPR 1, six-second measured samples after warmup. Main acceptance tab parked, no heavy test run concurrently. Same fixture each condition; four trucks and multiple trench networks. The earlier valid benchmark `gameplay-reset-performance-1790362126384/` is also retained.

| People / quality / speed | p95 ms | Simulation seconds / wall seconds | Actual shots |
| --- | ---: | --- | ---: |
| 300 Balanced 1× | 6.2 | 6.00 / 6.00 | 49 |
| 300 Balanced 5× | 6.2 | 30.05 / 6.00 | 345 |
| 300 High 1× | 6.2 | 6.00 / 6.00 | 49 |
| 300 High 5× | 6.2 | 30.05 / 6.00 | 342 |
| 1000 Balanced 1× | 30.4 | 6.00 / 6.01 | 151 |
| 1000 Balanced 5× | 36.5 | 9.35 / 6.01 | 225 |

300 meets this short sampled target; **1000 fails frame target and 5× time advancement**. The test used production entry `main-BUvpyGSs.js`, including the final lighting, building and support-readout repairs. The sole later runtime edit restores old non-mission constructor spacing; injected saved fixtures retain their supplied coordinates. These are diagnostic loads, not normal-control mission acceptance or a universal performance guarantee. Both final 5× screenshots were opened; large-force optimization remains.

The performance harness recorded zero page exceptions or console errors. The original long interactive session recorded **one unclassified `TypeError: Cannot read properties of undefined (reading 'blastEvents')`** without a time/stack. Its source was not established: current game access sites are guarded, but that alone does not prove it came from a diagnostic callback. The error is retained in `page-errors.json`, not labelled fixed or erased. Interactive QA now records timestamps, URL, stack and console errors for future reproduction; final fresh-transition checks are separate below.

Final disposable production smoke (`gameplay-reset-1790364954385/`): Sandbox → menu → fresh version-two meeting → 40.10 seconds of ordinary simulation → normal save/reload at the same elapsed time → Sandbox. **No recorded page or console errors.** This short smoke does not replace the missing complete final-layout meeting battle or disprove the older unclassified exception.

## Remaining problems

**Not V1 complete.** Winning-path browser acceptance, final-geography defense/meeting full reruns, all three missions' quality judgments, uninstructed building discovery, opposed building assault, actual multi-direction junction battle, matched supported advances, longer supply disruptions, more-seed staging checks, more substantial art and large-force headroom remain. Local implementation is not CrazyGames approval/deployment. No neural training, cloud spend, recurring work or restart of the expired heartbeat.

Next priorities: (1) shorten and clarify the forward ammunition/support cycle using the preserved attack, then prove a normal-control victory; (2) complete the final-layout defense and fluid battles and compare supported versus unsupported advances; (3) independent click-house and trench-facing acceptance; (4) stronger environment composition and meaningful High/Balanced visual separation; (5) profile 1000-person simulation cost. Investigate the blank reload transition and retain the unclassified exception for reproduction with the improved logger. Do not trade physical stock, information boundaries or existing saves for a quicker demo.
