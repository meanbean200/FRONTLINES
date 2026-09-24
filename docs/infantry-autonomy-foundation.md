# Infantry autonomy and equipment-driven foundation

## Scope and identity

Implemented on current `master`, starting from verified clean/fetched HEAD `7309d60f5ef7eed15f05afbba9dfb670bf5ed49b`. Implementation HEAD: `9c4e8fb854e6a8d62aac961cfd22d7c85e73b56f` (the following report commit changes documentation and evidence helpers only). Rules: `combat-26-autonomy-world2`; save key remains `frontlines-battlefield-v3-world2-4km`.

This is a foundation correction, **not a claim that combat is finished or subjectively accepted**. The 4 × 4 km world, Operations V2, fixed ticks, visibility/report firewall, finite supplies, casualties, earthworks and old roster compatibility remain. No neural training, automation restart, or new specialist classes.

The work was committed in sequence: diagnostics (`27087ee`), posture/protection (`5a45a9b`), capability migration (`a554b66`), mixed generation/manual support (`5fc9df0`), then simpler controls/building coordination (`9c4e8fb`). Controls were demoted only after automatic behavior tests and a real Medium contact playtest.

## Causes found and repairs

1. **Pinned meant an early return with reaction ownership, without an independent posture.** Soldiers now become prone, shelter where they are, or crawl to substantially better reachable protection within 5 m. They do not sprint through suppression. Broken morale still overrides normal movement and withdraws toward a rally location.
2. **Cooperation could stop both groups indefinitely when no effective support fire existed.** Ordinary Move now has a bounded initial hesitation; one moving group proceeds cautiously after that interval without pretending it has covering fire. Real effective-fire evidence still improves the coordination decision. Pinned/incapacitated soldiers cannot be forced through it.
3. **Local protection was too limited.** Reviews test at most 48 candidates, with a 12 m normal radius and 5 m pinned radius. Candidates combine local trench projections, exterior building corners and radial terrain samples. Actual solid interception, concealment, depressions/craters, distance, route clearance and allied occupancy/reservations contribute. Incoming direction is a stored bearing, not hidden attacker coordinates. Searches are staggered and trips retained instead of constantly reassigned.
4. **A real multi-formation move silently cancelled Able's route near the village.** The 60 m coarse grid could not enter the final cell despite a clear final approach between buildings. It now accepts a fully checked visible final leg. A genuinely failed route keeps its destination and displays a blocked-route explanation rather than changing to Hold or walking through an obstruction.
5. **Mixed construction would leave everyone without tools at deployment.** Only equipped tool carriers dig; the remainder accompany the shared approach and cover the work site. Existing center-out, branch-splitting work parties and queues are preserved.

Standing/crouched/prone are serialized simulation state. Posture changes hit volumes, observation/exposure, travel speed and the soldier rendering. Prone weapons remain horizontal and actual prone shots can render muzzle flashes. This remains simple procedural animation, not a new animation asset set.

Normal Hold already uses local observation and automatic small arms. It now also seeks useful nearby protection. Move retains its order through short cover responses and suppression. No Observe/Suppress/Assault/Defend button is required for this basic behavior. Explicit tactical intentions remain under **Options → Optional tactical orders**; normal commands are **Move, Hold, Build, Support**, with existing Map and contextual trench/building entry.

## Equipment and compatibility

Each soldier has a small versioned kit: personal weapon ID, tools, mortar equipment and medical kit. Ammunition, shells, smoke and medical consumables remain in the existing physical inventory and ledger. Equipment does not refill because a squad changes its label.

Migrated gates include weapon assignment, medical small-arms eligibility, automatic/crew weapon readouts, mortar readiness, active support crew selection, trench workers, construction/resume UI, garrison construction and medical advantages. Operation effectiveness and campaign selection no longer exclude fit armed personnel merely because their legacy kind was engineer/medical/mortar. Support readiness checks available equipment, nearby crew, rounds, posture/condition, movement, roofs and range. Only the assigned support personnel prepare a mission; the rest of their formation are not frozen by it.

New Operations V2 battles create ordinary formations with distributed finite kit, not mandatory separate machine-gun/mortar/medical/engineer squads. Standard Medium Meeting has 48 people per side in six formations: eight tool sets, one mortar, one crew MG, four squad automatic weapons and two medical kits per side. The existing force settings determine the loadout and total personnel deterministically. These are game scenario forces, not historical establishment tables.

`SquadKind` remains for old saves, legacy scenario factories, sandbox presets, naming and visual compatibility. A single adapter initializes missing legacy equipment once; old people, injuries, ammunition and roster identities are not replaced. Current-rules saves missing equipment/posture are rejected, not silently regenerated. Fresh replacement arrivals bring one ordinary rifle, not a duplicate of a dead person's heavy kit; returning casualties retain their own kit.

**Limit:** equipment remains personal. Picking up, recovering or reallocating a dead carrier's heavy weapon/tools is not implemented. Losing that carrier can remove the formation's capability. This is finite and explicit, but still a gameplay limitation for prolonged campaigns.

## Support ownership

Automatic support call sites were found in `OperationSystem` and legacy `CampaignCommander`. They now identify `ENEMY_AI` and `CAMPAIGN_AI`; the UI identifies `PLAYER`. Friendly support rejects non-player sources by default. Enemy support requires a recent delivered report, real carried mortar equipment, ammunition and fit nearby crew. The rear reserve carrying a mortar may now approach a reported area until within range instead of permanently sitting beyond engagement range.

Debug diagnostics expose posture, reaction, action owner, pause reason, bearing, cover destination/search budget, equipment and weapon state. Support diagnostics include side, requester, source, target, crew IDs, consumed rounds and a bounded acceptance/rejection history. Legacy mission origin is marked `LEGACY_UNKNOWN`, not invented. This is not normal HUD clutter. The Support drawer lists which friendly formations carry the equipment and explains readiness failures.

**Fragmentation grenades: deferred.** Existing finite smoke grenades remain. No grenade mode or real-world employment procedures were added.

## Buildings

Entry now has a physical, deterministic doorway queue; arrivals spread beside the approach and yield to departures. Firing reservations count live allies, not hidden enemy assignments or dead owners. A full requested floor clearly keeps surplus soldiers outside; it does not teleport or overfill. Existing stairs, temporary firing positions, roof cutaway, casualty movement and continuous exit paths remain. Waiting owns the building action so ordinary Hold cannot overwrite its explanation. Queue, exit and work-escort activity names count as movement for rendering, needs and weapon handling.

Tests cover two formations competing for eight ground-floor positions, physical exit followed by entry, individual spacing, save on stairs, casualty exit/re-entry and sub-tick movement bounds. The real Medium playtest placed all eight Able soldiers inside building 0 from one map order, in eight distinct stations. Soldier 256 fired six ordinary rifle shots from that position. A subsequent Hold order led all eight outside through the door.

## Verification and retained evidence

Production bundle: `dist/assets/index-BRbdyDxz.js`, SHA-256 `6fe7dd7055d8e0321412ccbe1c182fe005a4a501de3fd2b66af1ff47f399945b`. TypeScript and production build pass; Vite still reports the existing large-chunk warning (~948 kB main JS / 275 kB gzip).

- **453 / 453 unit/regression tests pass**, including posture/cover determinism, hidden-enemy independence, persistent orders, equipment migration/corruption, finite support and inventory balance, engineer queues, building flow, saves and operation outcomes. Release output: `output/playwright/autonomy/tests-release.json`.
- **16 / 16 actual Edge UI tests pass**, including sandbox spawning, finite operation reserves, mixed-equipment support selection, crew readout, four-command dock, optional orders, build access, pause/save/load and eight viewport sizes from 1280 × 540 through 2560 × 1440. The initial two UI failures were stale specialist-name expectations; their screenshots/errors are preserved under `e2e-first-failures`.
- The initial full regression failure report is retained as `tests-first-full.json`. Later migration and release results are separate; no failed evidence was overwritten.
- Owned, isolated Edge sessions used real clicks, map orders, wheel zoom, menus and refresh. Read-only state/diagnostics were used for verification, not debug teleporting, spawning an artificial combat fixture, or setting suppression. The user's `frontlines-player-native` window and saves were untouched.

All following paths are below `output/playwright/autonomy/` (local evidence, intentionally ignored by Git; reproducible QA scripts are tracked):

| Check | Evidence and observation |
|---|---|
| Instrumented baseline | `baseline-*`: before behavior changes, including the cancelled Able route. Not a causal combat-balance comparison. |
| Medium ordinary contact | `after-contact-observation.json`: 713 shots, 12 hits, three dead/seven incapacitated; sampled pinned soldier 264 is prone, not standing. Under-fire reactions and cover decisions are recorded. |
| Automatic weapons | In that same ordinary Move/Hold playthrough, the BAR carrier fired 60 rounds and two enemy MG42 carriers fired 60 each. No special suppress/assault order was issued. |
| Both formations keep movement | `final-first-observation.json`: Able and Baker both physically advanced toward the village with their destinations intact. |
| Automatic building occupation/fire | `final-building-observation.json`, `final-interior-close.png`: all eight inside; ordinary fire from a valid position. |
| Manual support and physical exit | `final-support-request-retry.json`, `final-support-exit-observation.json`: PLAYER smoke mission; samples record preparation, flight and completion with one consumed shell; all eight Able soldiers exit. |
| Enemy support in real battle | `large-contact-observation.json`: three ENEMY_AI HE missions with crew IDs and one consumed shell each, two completed and one in flight; 160 people, 683 small-arms shots/eight hits, one dead/22 incapacitated. |
| Save/refresh/continue | `final-save-resume-retry.json`, `large-save-resume-retry.json`, `large-release-resume.json`: exact state restored through real menu/save/reload controls. |

Probe failures from ambiguous selectors, an off-screen click target and the main-menu Continue selector are retained with `.failure.txt` files. Corrected runs use new filenames. They are harness failures, not silently counted as successful game checks. The first combat-view capture retained the map after selecting a friendly marker; `large-combat-view-corrected` closes it and captures the actual battlefield.

## Performance and acceptance limits

Normal Large Meeting: **160 people**, seed 1944, Edge, 1600 × 900, Balanced rendering. Marching samples over 20 wall seconds measured RAF p95 6.2 ms at both 1× and 5×, with 20.00 and 100.05 simulation seconds advanced respectively. These are marching measurements, not a worst-case claim. Active firefight measurements are recorded separately below.

| Active Large firefight | Wall time | Simulation advance | RAF p95 | CPU-frame p95 | Simulation CPU p95 |
|---|---:|---:|---:|---:|---:|
| 1× (`large-combat-performance-1x.json`) | 20.00 s | 20.00 s | 6.2 ms | 3.26 ms | 0.56 ms |
| 5× (`large-combat-performance-5x-short.json`) | 10.00 s | 50.05 s | 6.2 ms | 4.95 ms | 2.43 ms |

Both active samples met the 16.7 ms target at this measured resolution and maintained requested simulation speed. The in-game CPU figures are rolling measurements; RAF is measured independently. These were hardware-accelerated headless Edge sessions using actual UI input, not a guarantee for every native window, resolution, machine or sustained campaign. The corrected combat view submitted 90 soldiers and 173 draw calls; the complete battle had 160 people.

The first 20-second 5× combat attempt reached defeat at simulation time **835.05 s**, and the measurement helper incorrectly tried to click the now-disabled Pause control. Its failure is retained, not counted as performance evidence. The corrected helper tolerates terminal results; the shorter benchmark reloads the earlier battle through the real Load button and ends while still active. `large-outcome.json/.png` preserves the defeat: 847 small-arms shots, 11 hits, two dead and 48 incapacitated across both sides. The player's unsupported mass advance into the village lost. Automatic protection is not invulnerability, and this run also exposes a need for broader mortar/casualty-balance evaluation; it is not proof that current balance is good.

Remaining acceptance gaps:

- Broken withdrawal passes deterministic regression tests, but a naturally broken unit was **not observed** in the Medium live pass. Do not call that live gate passed.
- Local cover is bounded protection-seeking, not a global tactical solver. Soldiers may remain prone when no reachable improvement exists. Failed global routes visibly require a new approach; they are not guaranteed to recover from every future terrain change automatically.
- Door flow and individual positions are functional, but animations, formation spacing and fighting style still need the user's believability review. No claim that these screenshots look commercially finished.
- No equipment recovery/redistribution, no fragmentation grenades, no fresh 72-hour soak, and no new 1,000-person certification in this pass. Long-session balance and casualty accumulation remain separate work.
- The baseline and final playthroughs are not matched causal experiments: force organization, routes and player orders differ. Shot/casualty totals document what happened, not a claimed percentage improvement.

The game-foundations and Three.js skills kept simulation authoritative; game-UI guidance kept the battlefield unobstructed; game-playtest and Playwright guidance required real controls, screenshots and retained failures. Numerical success is not subjective acceptance.
