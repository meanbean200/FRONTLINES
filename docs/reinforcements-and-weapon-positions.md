# Reinforcement transport and physical weapon positions

2026-09-24 · starts at `b41e21b` on `master`.

## Player controls

- **Open Front → Reinforcements**: choose an occupied friendly trench with room, then **Request rifle squad · 8 personnel**. Follow the passenger stages and use **Locate truck**. Personnel board the next available convoy, transfer at the rear depot, take a shuttle to the trench's roadhead, and join on foot. They are not on the battlefield before unloading.
- The configured finite reserve pool (0, 24 or 48) is shared with automatic casualty replacement. At most eight new personnel dispatch per 24 campaign hours. Returning evacuated people retain their identities and do not spend that reserve. Short operations remain finite-force; Sandbox retains direct Add troops.
- **Select an equipped formation → Support → Build weapon positions** exposes **MG nest** and **Mortar pit** first. Place a valid short connector off a completed friendly trench. Delivered materials and actual construction are required: 16 materials for a nest, 12 for a mortar pit. These structures do not create weapons.
- Once finished, select the formation carrying the weapon and use **Crew MG nest** or **Crew Mortar pit** in Support. The operator and a helper walk into the excavated position. Other members continue area duties. Move/Hold releases the position; Observe/Suppress preserves it. Personal overrides, ongoing loaded deliveries, care tasks and critical needs are not silently cancelled.
- Heavy MGs (crew MG and MG42) require the mounted position and two ready crew; BARs remain portable. MGs engage observed targets and can receive a Suppress order. Player mortars require a crewed pit, ammunition and an explicit **Mortar HE / Mortar smoke** target, 50–900 m away, with 15 seconds' preparation. Crew loss interrupts preparation without inventing a shot. Both factions use these physical checks.

Support now identifies eligible equipment, offers position assignment/location controls, and explains the actual reason a weapon cannot fire. Detailed transport and weapon controls remain on-demand, rather than expanding the permanent HUD. Construction priority retains fit tool carriers at funded works when local basic supplies permit; other personnel can carry materials. Existing loaded trips finish normally.

## Simulation and persistence

- Shared `WeaponPositions` checks govern simulation, readiness text and rendering; geometry and inventory, not a visual tag, decide readiness. The renderer adds truck passengers and completed mortar equipment only from real state.
- Save schema remains 3; rules identity is `combat-28-crewed-positions-world2`. Optional position assignments and daily dispatch cooldowns are validated and serialized. Earlier dispatch ledgers also enforce the cooldown after migration.
- Old people, equipment and inventory are preserved. There are no free positions or ammunition refills on load. Old heavy weapons need a valid position under the revised rules. Exact continuation is required within the same rules version, not across this rules change.
- Pending squads reserve trench capacity but do not display phantom map units or accept normal movement before arrival. Passenger-only convoys do not import extra supplies/fuel or alter scheduled resource replenishment.
- Enemy prepared defensive areas construct positions through the same material/work system. The commander retains prepared support details and only orders mortar fire when physically ready. No new general-purpose enemy trench-building planner was added: unprepared meeting-engagement forces cannot use heavy weapons until a valid position exists.

## Verification

All player-facing checks used a disposable headed Edge profile and production preview, not the player's browser saves. Inputs were actual UI/mouse controls; simulation access was read-only diagnostics, not injected positions, progress, inventory or missions.

- **502/502 unit tests**, 70 files, including existing soak/regressions plus physical positions, real crew travel, construction accounting, interruption, save/load, both-faction requirements, portable BAR, dispatch/capacity limits and complete reinforcement journeys.
- **21/21 existing browser regressions**, final full run 46.9 seconds: menu/control paths, eight viewport sizes down to 1280×540, mixed equipment, mortar availability, saved reserves and pause/save continuation.
- Production TypeScript/Vite/portable build, **5/5 packaging tests**, and direct `index.html` → `FRONTLINES.html` offline launch passed. Offline checks included embedded workers, troop movement, exact saved continuation, refresh sizing at 1280×720 and 1920×1080, and no browser errors.
- Open Front, seed 1944: requested eight riflemen with population unchanged during transit, saved/reloaded mid-shuttle, and observed all eight unload. Reserve 48 → 40; population 96 → 104 only after arrival. Actual dispatch at campaign hour 8.002, arrival 15.595 (about 9.5 minutes at 1× on this route).
- Fresh same-seed game: built a mortar pit using delivered materials and work; two crew walked inside. Player mission 410 prepared, launched and impacted; exactly one HE shell consumed (12 → 11). Enemy MG and mortar positions also completed through real construction.
- Fresh MG case: built/paid nest 385 and its connector, ordered Easy to crew it. Operator 296 and helper 295 arrived inside trench geometry. The MG naturally engaged observed enemies from the nest: 26 rounds fired, ammunition 60 → 34, crew 2/2. No forced targets or shot state.

Local evidence remains under ignored `output/playwright/`: `weapons-transport-request.png`, `weapons-transport-convoy.png`, `weapons-transport-arrived-storage.json`, `weapons-transport-prioritized-build.png`, `weapons-transport-mortar-target.png`, `weapons-transport-mortar-fired.png`, `weapons-transport-fired-storage.json`, `weapons-transport-mg-mounted.png`, `weapons-transport-mg-storage.json`, and the corresponding CLI scripts. Offline evidence: `file-boot-1790296748619/`.

## Failed probes and limits

- An initial live build stalled while both tool carriers were on long pre-existing supply runs. The corrected allocation keeps available builders on funded works; it deliberately does not teleport those old carriers or discard their cargo. The delayed first-run save is retained. Long physical roadhead/foot routes can still be slow.
- Early unit failures exposed old tests that assumed unsupported heavy weapons could fire, plus a marker fixture lacking `soldierIds`. Fixtures now explicitly prepare physical positions where that is the test precondition; separate new tests enforce real construction and travel. Production code does not import the fixture helper.
- An early 20/21 browser run found the short-window test on the main menu while development files were changing. HMR is a possible cause, not established. Failure evidence is retained in `weapons-transport-first-e2e-short-window/`; two subsequent frozen-source full runs passed 21/21.
- One mortar target probe stopped before clicking because its projected point was outside the viewport; the successful shot used visible ground. These safeguards were not bypassed.
- Vite's existing large-bundle warning remains. No new 300/1,000-person frame-time benchmark or specialized 72-hour weapon-position campaign soak was performed. Existing suite success does not establish subjective combat quality or preferred transport pace; those still need player review.
