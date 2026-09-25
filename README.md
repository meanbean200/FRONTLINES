# FRONTLINES — Living battlefield

A browser tactics game in TypeScript and Three.js. **Quick Battle** offers Breakthrough, Defend the Line, Meeting Engagement and the saveable, open-ended Open Front. **Operations** introduces these missions, while **Sandbox** is a peaceful living-trench battlefield. New battles span **4 × 4 km (±2000 m)** with **64 × 500 m terrain chunks**, nine settlements and six connected roads. Nearby chunks gain detail while coarse terrain keeps the wider countryside visible.

**Current: local combat-v3 preview, world 2, rules `combat-23-world2`.** Physical rifle shots, suppression and cautious orders, supporting weapons, delayed local reports, smoke/mortars, casualty care, usable building floors, persistent enemy plans and finite campaign replacements are integrated. Read [the 4 km rebase report](docs/world-rebase-report.md) for current geography, save policy and measurements, and [the combat overhaul report](docs/combat-overhaul-progress.md) for the earlier combat acceptance record. **Old 8 km saves are preserved but incompatible with this generated world.** They require their matching older build; no coordinates are silently clamped or migrated. New saves use `frontlines-battlefield-v3-world2-4km`. No neural training or automation was started.

Fresh sandbox games now start with **28 soldiers in three squads**, all assigned to the prepared trench. The original 224-person fixture and existing saves are preserved; larger forces remain available through Developer stress tools. This avoids stranding 196 unassigned reserves without autonomous support in the default experience.

The starting trench now has an autonomous garrison: connected walking routes, temporary watch and rest duties, individual needs, engineer-built dugouts, and physical truck/foot supply chains. Coordination is deterministic; no neural worker is loaded. See [current implementation and acceptance](docs/deterministic-garrisons.md). Deprivation deaths are OFF by default; opt in through Command → Defense status → Support. Exhaustion, inventory use and recovery still operate when deaths are off. Combat deaths are separate and always apply in operations.

## Planned release target

We intend to prepare FRONTLINES for a future **CrazyGames** submission. This is a
roadmap target, not an approved or published release. Keep the desktop-first
field-command presentation, short operations, and persistent campaign.

Before submission, address relative bundle paths, skippable in-game onboarding,
CrazyGames' embedded desktop sizes, Chrome and lower-powered hardware testing,
and its content requirements. SDK and save integration must match the chosen
launch stage; the SDK is optional for Basic Launch, not Full Launch. Follow the
[quality guidelines](https://docs.crazygames.com/requirements/quality/),
[technical requirements](https://docs.crazygames.com/requirements/technical/), and
[gameplay requirements](https://docs.crazygames.com/requirements/gameplay/).
No platform submission, monetization, or external account integration is enabled.

## Run

**Double-click `FRONTLINES.html` to play.** It is the complete offline game: no
server, terminal, installation or internet connection is needed. Opening the
repository's `index.html` also takes you there. Use an up-to-date Edge or Chrome
with graphics acceleration enabled. `dist/index.html` supports disk launches too.

Offline saves belong to that file location and browser. Keep the file in the
same place to resume them. Saves from `http://127.0.0.1:4175` remain untouched and
are still available at that address in the original browser profile; browsers
do not share saves between HTTP and local files.

For development:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

`npm run build` regenerates the hosted build in `dist/` **and** the tracked
`FRONTLINES.html` offline release. `npm run standalone` rebuilds just the offline
release. Do not hand-edit the generated HTML. `npm run test:launch` verifies a
real file launch in a separate, offline Edge context, preserving player profiles.
See [direct-file launch verification](docs/offline-launch.md) for checks and save boundaries.

For the separate player-facing Edge preview, `scripts/edge-player.config.json` uses `viewport: null` **at browser creation**, so the game follows the real window, including after refresh. With the production preview running at port 4175:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=frontlines-player-native open http://127.0.0.1:4175/ --browser=msedge --headed --config=scripts/edge-player.config.json --profile=output/playwright/edge-player-native-profile
```

The persistent player profile is ignored by Git. The older `output/playwright/edge-player-profile` is preserved separately; never erase or overwrite a profile to repair sizing. Do not run fixed-viewport probes in any `frontlines-player*` session. Use a disposable QA session with a positive emulated viewport instead.

Responsive CLI probes run through `scripts/run-browser-probe.mjs`, which restores their original positive viewport in `finally`, including failed probes. It refuses emulation on native-sized pages and in named player sessions. **Zero width/height is not a native-viewport reset:** it can appear fixed after resizing, then shrink again on refresh. `scripts/qa-native-window.cjs` checks actual window resizing; `scripts/qa-native-refresh.cjs` checks repeated normal/cache-disabled reloads in disposable native contexts without reloading the player's unsaved world. A handoff must pass both; fixed-size screenshots alone are insufficient.

## Current interface

The [cinematic UI redesign report](docs/cinematic-ui-redesign.md) documents the replacement menu/HUD architecture, real-browser screenshots, accessibility checks and remaining UX limits. It supersedes the older paper/folio UI documents. Main menu → Quick Battle → generated-sector preview → Begin is now the primary entry flow.

## Controls

- Normal play keeps only the objective, clock/speed, Menu, Map and Command access on screen. Select a formation to reveal compact status and its order bar. **Details** opens collapsible condition, supply and activity sections. **Command → Forces / Defense status / Build** opens optional tools. No permanent minimap or inspector; resizing changes presentation only.
- `WASD` or arrow keys: pan; hold `Shift` for operational-scale movement
- Mouse wheel: zoom from strategic to troop scale
- Middle-drag: rotate and change camera pitch
- Left-click / left-drag: select one or multiple squads
- Shift-click: add a squad; double-click a flag or roster row to focus it
- `F`: focus the selected squad; `Q` / `E`: rotate
- World labels stay visible during camera movement and follow the current rendered camera every frame, with no hide/fade delay.
- Right-drag: draw a movement corridor; troops follow its bends in columns. `V` / Move uses left-drag instead. Shift-drag appends. A short right-click still gives a destination order.
- **Build** (selected order bar or Command → Build) opens Trench, Support structures and Worksites. **Trench [B]** immediately selects a fit friendly engineer team and enters drawing; drag at least **10 metres** and release. Engineers split into crews, start at the middle or a completed junction, and dig outward. Connected branches receive a crew when their junction is excavated. Short or blocked plans explain rejection.
- Trench labels distinguish personnel physically **inside** cover (including digging engineers) from garrison troops **assigned** to that network. Assignment alone does not grant protection. Engineers' selection panel shows their actual shelter count.
- `R`: resume nearby unfinished works and the selected engineer's remaining jobs. `H` / a new movement order pauses every working front. Existing partly dug saves retain their original excavation.
- **Defend Area [T]** draws a frontage near completed trenches; choose facing in the inspector. For quick assignment, select squads and click a trench's capacity label. Soldiers enter nearby reachable cover, rotate watch, rest, eat and carry supplies. Capacity uses deduplicated usable floor, with no permanent soldier positions. Move / Hold [H] leaves the routine.
- Primary orders: **Move, Defend, Observe, Suppress, Assault, Withdraw, Build, Support**. Draw movement/assault/withdrawal routes; cautious troops use nearby protection and resume when safe. Hold [H], Resume works [R] and contextual Push through remain in Details. Push through cannot override pinning or incapacitation. Actual pause reasons are displayed.
- **Support** opens Support & rescue, which orders smoke grenades and mortar HE/smoke, displays explosive danger and blocked-rescue decisions. Explosives can injure allies; small arms cannot. First aid and evacuation consume supplies, time and transport capacity. Build reachable aid posts to handle serious wounds.
- Click a building with a Move order to use its doors and interior; choose an available floor in the squad inspector. Friendly roof cutaways do not reveal hidden enemies.
- `Esc`: cancel the current drawing, otherwise open/close the paused command menu; `H`: hold and release trench reservations
- `C`: create a persistent test crater in the sandbox; also available in Developer
- `Space`: pause/resume; the HUD also exposes pause, 1×, 2×, and 5×
- **Menu → Settings → Graphics**: Balanced, Performance (no shadows), or High rendering. Audio, Controls and Interface are separate tabs. The optional field manual and Developer tools are under Interface.
- **Command → Defense status**: readiness and facing, then separate Supplies, Personnel, Facilities and Support tabs. Supply and casualty emergencies still surface when action is needed.
- **Build → Support structures → facility**: choose a site **6–40 m behind** a completed connected trench. The footprint/connector preview shows actual clearance, materials and rejection reasons. Rest dugouts, meal bays, supply stores, ammunition dugouts, aid posts and weapon emplacements require assigned engineers, delivered materials, and a physically excavated connector. If the team has left to dig main trenches, **Assign engineers to this network** returns them explicitly; unfinished earthworks remain. An emplacement supplies protection, not a free weapon or crew. Right-click or Esc cancels placement. The work list shows delivery/construction progress; click a job to focus it. Plans can be placed while paused, but **Space / 1×** starts the crews. Defense status → Facilities also exposes existing support requests.
- The peaceful sandbox's initial garrison contains 28 troops. Assign reserves to additional supplied trench networks with `T`; holding in the open is not an autonomous camp, and personal packs are finite.
- Menu → Settings → Interface → Developer tools → Review matched replays: compare local recorded runs without replacing your campaign or saved slot. The report links matched exposed/supported combat clips; these are not pre-overhaul recordings.

- **M** (or G): open/close the operational map. Select friendly symbols, Shift-add, right-click to move selected squads, or click terrain to focus the battlefield. Only known enemy contacts appear. The map pauses play without changing the saved speed.

## Architecture

- `simulation/`: fixed-step, serializable soldier/squad state and orders
- `terrain/`: seeded countryside, building footprints, spatially indexed excavation, navigation costs and cover
- `navigation/`: squad-level A* on a worker for move orders, finer searches near settlements, footprint-checked path simplification, and stale-result rejection when orders change
- `construction/`: stable engineer work parties, branching player-directed queues and physically gated, two-front excavation
- `garrison/`: connected navigation, needs, temporary assignments, support construction and physical logistics
- `operations/`: scenarios, objectives, finite town caches, persistent reported-information command planning and scheduled physical replacements
- `combat/`: deterministic shots, weapons, reactions, cooperation, local knowledge/report queues, support missions and casualty care
- `learning/`: retained historical study code, not imported by the game
- `core/Polyline.ts`: cached arc-length metrics and pointer-jitter simplification; bends remain part of movement orders
- `core/TrenchGeometry.ts`: shared completed-ground intervals for construction, navigation, cover and rendering
- `render/`: worker-generated terrain LOD with sub-meter excavation cells and localized refresh, instanced soldier parts, timber supports, road cuts, vegetation clearance, camera and debug views
- `input/` and `ui/`: command mapping and low-chrome DOM interface
- `persistence/`: schema-versioned battlefield snapshots stored in local storage

The simulation owns truth; Three.js visualizes it. Renderer objects are never serialized.

## Verification

Current world rebase: [4 km verification, measurements and limitations](docs/world-rebase-report.md). The pre-change [8 km assumption inventory](docs/world-rebase-audit.md) records scope. Historical performance claims below do not certify the current denser world or every 300-person workload.

Latest presentation pass: [field-command UI and verification](docs/field-command-ui-verification.md).
Paper briefing menu, compact edge HUD and expandable unit reports, consistent
tactical symbols, live trench plotting, and a paused operational map on **G**.
**325 tests pass**; production build, seven layout sizes, and actual Edge window
resizing were checked. Saves and simulation rules are unchanged. The
[visual system](docs/field-command-ui.md) records the palette and component rules.
Screenshots, browser profiles, saves, and generated test evidence stay local in
ignored directories; reports distinguish verified behavior from remaining limits.

Latest menu/window repair: [native Edge sizing and clear mode selection](docs/menu-window-2026-09-23.md). Replaced the fixed-size test session with a native-sized persistent Edge session while preserving its state and saves. Verified actual native window resizing, centered menus, distinct keyboard focus/selection and larger menu text. No gameplay rules changed.

Latest UI-only pass: [clean battlefield HUD](docs/clean-hud-2026-09-23.md). Removed the persistent left cards, raised/simplified objectives and fixed right-side tab overlap. Actual Edge checks cover nine window sizes, all four modes, opt-in controls and unchanged campaign/save data. CSS-only implementation, with no combat or campaign rule changes.

Latest: [combat-v3 implementation and verification](docs/combat-overhaul-progress.md). **320 tests pass**, production build passes, 300,000 seeded calibration shots, matched squad encounters, a controlled 72-campaign-hour persistence/logistics soak and actual Edge combat/control/save checks. Final 300-person scenes meet the p95 target at 1× and real 5×; the 1,000-person stress scenes do not. User judgment of combat feel remains a separate acceptance step. Rules are `combat-22`.

The following records are historical snapshots, not claims about the current test count or rules:

Previous UI repair: [responsive screen fit](docs/screen-fit-2026-09-23.md). **272 tests passed**, production build and actual Edge checks across 15 viewport sizes. Compact drawers keep controls reachable; HUD spacing follows wrapped content, and rendering follows the canvas size. Resizing/inspection preserved the paused campaign and saved string exactly. Simulation rules were `deterministic-15`.

Latest direct-request implementation: [open-ended trench campaign, environmental cover and verification](docs/trench-campaign-2026-09-23.md). **267 tests pass**, rules `deterministic-15`. Two prepared fronts, separate depots, limited enemy raids and returns, player-placed support works, direction-aware dispersed watch posts, shared physical vegetation/building cover, and saved continuation. A 72-campaign-hour run conserves supplies and survives exact save/load. See the report for browser evidence, performance scope and remaining limitations.

Previous direct-request fix: [engineer floor contact and truthful occupancy](docs/engineer-grounding-2026-09-23.md). **250 tests passed**. Fixed migrating entrance ramps, stale stationary cover, floating feet, and assignment-only trench counts. Actual Edge play verifies both digging faces, completed excavation, and a mid-dig save/load. Rules were `deterministic-14`.

Previous bug pass: [engineer transitions and trench reassignment](docs/engineer-transition-bugpass-2026-09-23.md). **241 tests passed**. Resume chooses the closest reachable unfinished face, travelling engineers animate and spend travel energy, and explicit transfers between separate trenches now walk out and enter physically. Real-browser construction, reassignment, mid-trip save/load and supplies pass. Travellers display Relocating; labels stay visible.

Latest presentation correction: [continuous label tracking](docs/continuous-label-tracking-2026-09-23.md). Labels remain visible during camera movement with no fade/delay; 600 sampled browser frames and 4,124 anchor checks verify current-frame alignment. **226 tests pass**; simulation rules and saves are unchanged.

Latest direct-request pass: [smarter engineer work parties](docs/engineer-work-parties-2026-09-23.md). **226 tests pass**; crews dig outward from a middle/junction start, split onto connected branches and return to unfinished fronts. A real-control browser T-shaped network finishes completely, with working Hold/Resume and exact save restoration. Earlier [tactical enemy AI](docs/enemy-ai-2026-09-23.md) and [combat/visibility verification](docs/combat-visibility-bugpass-2026-09-23.md) cover the opponent, nearby trench entry, alarms, casualties and spotting. Difficulty and believability remain open for player review.

Latest reliability pass: [playthroughs, fixed bugs and verification](docs/bugpass-2026-09-23.md). Both operation modes were completed with ordinary mouse/keyboard controls. The pass fixes casualty-related movement stalls, slow garrison assignment, keyboard focus, temporary under-fire readiness, post-result commands, small-window layout, failed-load feedback and recoverable graphics loss.

```powershell
npm test
npm run build
npm run test:e2e -- --workers=1
```

Developer exposes actual frame cadence, CPU frame cost, p95 frame interval, simulation cost and draw calls. `window.__FRONTLINES__` exposes repeatable probes, including a downward ray cast against the rendered terrain. Regression tests cover complex queued construction through save/load, pause/resume, capacity reservation/release, physical cover, drawn route bends/append/cancellation, separate squad destinations, obstacle validation, road excavation/restoration and save validation. Current checks are in [the deterministic acceptance record](docs/deterministic-garrisons.md) and [current frame-time measurements](docs/deterministic-performance.md). Earlier movement and neural-study documents are historical evidence, not current certification.

## Current limits

This remains a stylized local preview, not a complete military simulation. Terrain itself is known; enemy contacts are local, delayed and uncertain, and stale reports never follow hidden movement. Difficulty, campaign balance and believability need player review. Trucks are logistics actors, not armor. Buildings use shared simple geometry and damage presets, not individual bricks, collapsing floors or room-clearing AI. Trees are not individual navigation obstacles. Defend Area currently needs nearby completed trenches; it is not an arbitrary open-field deployment painter. General rigid-body physics, armor, aircraft, extensive mines, surrender and a trained opponent remain outside scope. Capacity uses a conservative half-metre approximation. The 1,000-person stress workload cannot sustain the requested performance. New saves use the separate world-2 browser-local key, preserving original 8 km v1/v2/v3 data. Starting a fresh operation never overwrites a saved campaign.

Previous performance measurements describe older revisions, not current certification. See the current acceptance record for results and outstanding failures.

## Retired study artifacts

Earlier checkpoints, source snapshots, failed runs and development replays remain in `study-runs/` and `output/`. These are incomplete historical evidence, not adopted models. Rules are now `combat-23-world2`; no new policy has been trained or adopted. Incompatible neural policies fall back to rules; old-world replay snapshots require their older build. The local continuation window and later interactive work are recorded in [overnight development](docs/overnight-development.md). The overnight heartbeat remains paused.

## Legacy operations and combat

The following three legacy missions remain loadable in matching world-2 saves. New battles use the four Operations V2 missions described in [Operations V2](docs/operations-v2.md) and [Quick Battle](docs/quick-battle.md).

- **Trench war:** open-ended campaign with 48 troops per side in opposing prepared trenches. New rosters comprise four eight-person rifle squads, eight engineers, three MG crew, three mortar crew and two medical personnel. Save and resume at any time. Secure and hold both command posts A + C for 120 seconds to win; no match countdown. Both sides have scheduled convoys and truck/foot deliveries. Replacements fill losses from a finite 48-person reserve, at most eight every 24 campaign hours, through the physical rear chain. Returning evacuees retain identity and do not consume a replacement. An unattended campaign is not guaranteed to resolve itself.
- **Village offensive:** 48 friendly troops against 24 defenders; take Le Verger (B) plus A or C on the western approach. Hold two objectives for 180 control points within 10 minutes. Three able troops capture a neutral point in 35 seconds; taking an enemy-owned point takes 70 seconds. Mixed forces halt capture; hostile presence denies scoring.
- **Hold the crossroads:** 48 against a finite 48-person assault at Beaumont, on a north/south axis. A 90-second preparation phase allows repositioning and excavation. Keep B until 15 minutes, or stop the entire assault. Losing B is a defeat.
- **Combat:** 360 m ordinary-rifle ceiling; physical shot paths, exposure and aiming error replace independent hit rolls. Riflemen miss frequently, especially at range or when moving/tired/suppressed. A full-energy hit can immediately incapacitate or kill, but not every wound is fatal. Small arms cannot injure allies; explosives can. Earth, substantial trunks and masonry protect; foliage and smoke conceal. Finite town caches transfer stock only to stopped troops within 12 m. No supply is created by capture.
- **Visibility:** environmental line traces, continuous distance/contrast effects, target posture/movement/fire, facing, fatigue, suppression and day/night lighting determine acquisition. Strong contacts are immediate; weak glimpses accumulate. The 800 m daylight / 350 m night bounds limit search cost, not guaranteed visibility. A recognized enemy retains its actual observer and can remain tracked through weaker signals for up to six simulation seconds in clear open space; weak tracking cannot refresh that deadline. Buildings, trunks and terrain block sight; dense foliage and smoke still break tracking. Sleeping or incapacitated troops cannot maintain it. Team spotting does not improve rifle accuracy or permit shooting through an obstruction. Nearby observed enemies share compact contact diamonds instead of changing individual headcounts. Dashed last-known areas expire after 18 seconds without following hidden movement. See [steady spotting and grouped contacts](docs/steady-spotting.md).
- **Under fire:** credible nearby shots, impacts and explosions create suppression and sector alarms, not an unconditional radius around the intended target. Threatened sectors get reinforcements while other observation, shelter and reserves remain staffed when possible. Watch relief remains physical. First confirmed contact or incoming fire of a new engagement reduces fast-forward to 1× once; manual pause is preserved.
- **Enemy commander:** scouts, prepares support, commits, reassesses, consolidates or withdraws based on reported contacts, own forces and public objectives. It keeps reserves when possible and aborts exhausted or unsupported attacks rather than using hidden coordinates or accuracy bonuses. Plans survive save/load. This is deterministic tactical AI, not neural learning; the peaceful sandbox still has no opponent.
- **Session flow:** pause freely with Space or MENU, save/load operations, inspect the frozen battlefield after victory/defeat, or start a new mode. Rendering quality is also in the menu.

Run `npx tsx scripts/verify-operations.ts output/your-new-result.json` for repeated-seed, actual-simulation probes with intermediate save/load. Prior outputs are never overwritten. See [operations verification](docs/operations-verification.md).

The [latest reliability follow-up](docs/bugpass-followup-2026-09-23.md) covers casualty reservation/capacity release, multi-garrison emergency pauses, synchronized rendering settings, and a real garrison-defense playthrough. Supply emergencies cannot be bypassed with speed controls; all outstanding decisions must be resolved before the previous speed resumes.

The [load and recovery follow-up](docs/recovery-load-bugpass-2026-09-23.md) fixes stale asynchronous routes, pending-order restoration, retained drawing input after loading, and narrow inspector overflow. Physical crate recovery and withdrawal were checked through save/load in headless regressions and the production browser using explicitly synthetic shortage fixtures; 122 tests pass.

The [recovery-target follow-up](docs/recovery-targets-bugpass-2026-09-23.md) prevents impossible pickups across disconnected trenches, tries reachable alternatives in nearest-first order, and releases empty blocked pickup assignments from older saves. An exact corridor spatial index reduces a profiled large-camp CPU hotspot without changing the matched continuation state. 131 tests pass; mature 1,000-person browser performance remains below the required speed.

The [emergency-review follow-up](docs/emergency-review-bugpass-2026-09-23.md) lets you revisit Hold or Recover through **Review supply response** in the garrison panel. Review pauses existing trips and preserves your previous speed, including pause, through save/load. Withdrawal uses timed half-rations without early arrivals stockpiling supplies needed by the rest of the column. 142 tests pass; failed long return-route searches remain a large-camp follow-up.

The [carrier-return and withdrawal-readout follow-up](docs/return-routes-bugpass-2026-09-23.md) lets loaded carriers reuse their validated outward approach to return, rejecting traces blocked by new geometry. Withdrawal panels now show supply-point stocks and physical arrivals. **149 tests pass**; scoped aged 300-person browser checks meet the target, but the 1,000-person workload still lags and a bounded long-return diagnostic remains incomplete.

The [visible-approach follow-up](docs/visible-approach-bugpass-2026-09-23.md) fixes a replacement return search exhausting its budget despite a reachable entrance. It validates a visible final approach and avoids repeated terrain-cost calculations within each search. The reproduced carrier completes physical delivery with conserved cargo; **152 tests pass**. Scoped 300-person checks pass, while 1,000-person performance remains below target.

The [simulation-speed follow-up](docs/simulation-speed-bugpass-2026-09-23.md) fixes fast-forward changing the simulation's step size and even flipping a matched battle's winner. Three actual-simulation scenarios now have identical full final states at 1×/2×/5×, normalizing only the speed setting; **158 tests pass**. Browser asynchronous navigation remains a separate timing limitation. Scoped 300-person performance still passes, but corrected 1,000-person 5× stepping currently performs worse (p95 315.9 ms) and remains unsupported by the target.

The [queue-performance and load-view follow-up](docs/queue-performance-bugpass-2026-09-23.md) removes repeated distant-camp distance checks from supply waiting-point queries, preserving the matched full simulation state. Load now brings friendly troops back into view instead of leaving the camera over unrelated ground. **167 tests pass**. Final 300-person checks meet the target; 1,000-person 5× improves to p95 115.4 ms but still fails, with long hitches up to 741.2 ms. Rules remain `deterministic-9`.

The [forward-pickup hitch follow-up](docs/pickup-hitches-bugpass-2026-09-23.md) removes a second repeated full-camp distance scan while preserving an entire matched 100-second continuation. **169 tests pass**. Browser sandbox carriers complete physical deliveries with balanced inventory; both operation-entry transitions preserve the saved campaign. The scoped 300-person target passes; 1,000-person 5× still fails (p95 127.6 ms, worst 473.8 ms). Capacity rebuilds and repeated failed routes remain measured follow-ups. Rules stay `deterministic-9`.

The [capacity-rebuild and night-routine follow-up](docs/capacity-hitches-bugpass-2026-09-23.md) reduces floor-cell allocation without changing capacity arithmetic or the matched complete simulation state. **173 tests pass**. Real-browser construction completes the rest dugout and meal bay; night sleep, an alert drill, routine recovery and mid-construction save/load are checked with balanced inventory. Scoped 300-person checks pass; **1,000 still fails** (p95 103.2 ms, worst 419.1 ms). Rules remain `deterministic-9`; no neural training.
