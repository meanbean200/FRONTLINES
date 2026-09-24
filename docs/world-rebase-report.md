# FRONTLINES — 4 km battlefield rebase

23–24 September 2026. Baseline: `7a3b1d2`. Existing TypeScript/Three.js engine,
fixed-step simulation and terrain-worker architecture retained. This is a world
rebase, not Operations V2, a combat redesign, or a new art pass.

## World and composition

- New worlds identify themselves as `worldVersion: 2`, `worldSize: 4000`;
  simulation schema remains v3 and rules are `combat-23-world2`.
- Canonical bounds are **x/z −2000…2000 m**, 16 km². Terrain generation creates
  **8 × 8 = 64 actual 500 m chunks**, down from 16 × 16 = 256. Worker origins,
  vegetation, LOD, road cuts, picking and modification bounds use derived origins.
- Nine settlements occupy all quadrants: Saint-Martin, Le Verger, Les Ormes,
  Beaumont, La Ferme, Bois Noir, Le Moulin, La Prairie and Ferme du Val. Seed 1944
  has **81 building sites**, versus 66 across the old 64 km² world. Building
  footprints stay clear of shared roads and riverbanks. Building geometry,
  interiors, damage, seeded woods, hedgerows, fields, ridge and valley remain.
- Six roads form three east/west approaches and three north/south crossings,
  with nine road junctions. Roads are shared by terrain, rendering, building
  placement, truck routes and both maps. Trucks follow the curved road graph
  through junctions; routes are not straight lines across countryside.
- Three **earth causeways**, not decorative bridges, physically raise the river
  channel. Soldiers, trucks and shot/visibility geometry use that same terrain.
  Crossing cells receive local sub-metre mesh refinement at both worker LODs;
  screenshot review caught and fixed a 1.15 m coarse-render mismatch there.
- Campaign fronts sit around x=−520/+520, z=−140, with Saint-Martin between them.
  Depots at x=−1680/+1680 occupy the outer 320 m; convoys enter at ±1980 on the
  central road. Depot-to-forward transport is over 1 km, followed by a short
  physical carrier approach. North/south space remains available for maneuver.
- Village offensive uses Le Verger on the western approach. Defense is relocated
  to Beaumont on a north/south axis. Sandbox remains near the original western
  prepared trench. Rosters, capture conditions, preparation time and durations
  are unchanged. Launch cameras now derive their focus from current troops or
  the campaign command post, not old coordinate tables.

Camera focus/pan stays inside ±1980 m, with a 25–4600 m zoom range and existing
Shift-pan. The operational sheet spans the full 4 km with a 500 m scale bar;
sector sheets clamp at the edges. Minimap and sheet share world transforms.
All four modes remain available. No hidden operational zones were added.

## Save compatibility

The changed generated terrain, roads and building IDs make an exact 8 km save
migration unsafe. New saves use **`frontlines-battlefield-v3-world2-4km`**.
Old `frontlines-battlefield-v1`, `-v2` and `-v3` values are never overwritten or
clamped into this world. The menu identifies a legacy save and explains that it
requires its matching older build. An unsuccessful load leaves both the live
session and original saved string untouched.

Matching world-2 saves preserve exact state/continuation, including coordinates,
people, orders, excavation, inventory and shipments. Physical actors/routes and
worksites are bounds-validated. Shot rays and uncertain report areas may extend
off-map; they are not physical actors. Old-world replay/QA files are preserved
but cannot be loaded into the new world. The changed rules invalidate incompatible
neural policies; no policy training or automation was started.

## Verification

Evidence is local and ignored by Git, under `output/playwright/world-rebase/`.
Production Edge checks use the owned `frontlines-rebase` session, not the player's
profile. The player's saves, tabs and existing servers are not replaced.

- **`npm test`: 351/351 tests, 56/56 files pass**, including the final crossing
  regression (`final-tests-r2.json`, 61.38 s). **`npm run build`: passes**;
  verified production bundle `index-Dh_4GRkC.js`. The existing >500 kB chunk
  warning remains; it is not a compile failure.
- New world tests cover actual mesh count/extents, all quadrants, roads/crossings,
  in-bounds mode spawns, rear depth, cross-map truck delivery and conserved cargo,
  exact delivery continuation, all map transforms, preserved legacy saves and
  trench/crater deformation across a 500 m boundary.
- Two actual ordered walks traverse 3.7 km east/west and 3.6 km north/south.
  Per-tick displacement stays below 0.2 m. This isolated navigation fixture keeps
  the walker rested/fed; it is not a claim that an unsupported march avoids needs.
- Existing regressions retain complex engineer queues, interrupted works, watch
  relief, casualty/replacement conservation, building navigation, speed invariance
  and the supplied 72-campaign-hour loop-network soak.
- `controls-r4.json`: actual menu launch of all four modes, current launch focus,
  full-map and minimap clicks, held edge pan, exact paused save restoration,
  visible legacy rejection with unchanged original, and full canvas sizing at
  1920×1080, 2560×1440 and 1000×600. All checks pass; no console/page errors.
- `build-controls-r2.json`: actual UI facility placement, rejected 5 m trench,
  accepted 15 m trench, and explicit engineer reassignment. All checks pass.
  `build-progress-r1/r2/r3.json` records three real 20-second 5× runs: material
  delivery, connector excavation and completed meal bay by about 300 simulation
  seconds, with conserved inventory. No simulation advance hook or free materials.
- `geography-r2.json` and screenshots inspect the campaign, complete map,
  Saint-Martin and a physical river crossing through actual map/zoom controls.
- Updated combat, mixed-300 and visual-rescue fixture generators were executed
  into new evidence files, not over historical inputs. The repository's e2e
  config has no current spec files; verification uses its existing Edge CLI
  probe workflow rather than claiming an empty e2e suite passed.

### Retained failures and corrections

Early regressions exposed off-map test fixtures and a real edge destination
stall. Formation targets and returned route endpoints are now bounded. Fixtures
which needed a valid world were translated without changing their geometry.
A relocation test now records each soldier's physical arrival instead of
incorrectly banning a later hauling duty after quicker supply delivery.

The first map probe had an ambiguous selector; the second found stale launch
camera coordinates. Its minimap assertion also sampled before camera damping
settled, and its save comparator removed metadata on only one side. These probe
errors were corrected; complete state comparison now passes. The first build
probe dragged beneath the HUD with the old camera framing; the corrected
campaign view and repeat completed the real workflow.

`after-browser.json` accidentally measured a stale 8 km runtime after hash-only
navigation. It is **excluded** from comparisons and retained with
`after-stale-runtime-300.png`. The probe now reloads, records the bundle name and
requires 64 real rendered chunks. Earlier successful and failed captures remain.

## Measurements

Baseline and candidate use the same seeded 300-person/four-truck open-combat
layout, camera (−650,−1400), 740 m zoom, 1600×900 headed Edge and Balanced quality.
Both samples restore the fixture independently for 1× and 5×, warm for 3.5 s,
then sample 8 s. No other benchmark/test process runs during the timed samples.
These are short **instrumented workload samples**, not a hardware-wide guarantee.
The read-only visual diagnostic runs each sampled frame; include that overhead
when interpreting times. Terrain/building identity and depot positions necessarily
differ. This is not a byte-identical combat replay across world versions.

The old debug `chunks` value counted detailed chunks, not actual frustum-visible
chunks. The new diagnostic distinguishes generated, detailed and frustum-visible.
Old actual visibility was not instrumented; it must not be invented from that
counter. Worker times are cumulative completed generation work, not frame time;
restoring a world regenerates its chunk meshes.

Evidence: `before-world.json`, `before-browser.json`, `final-r2-world.json`,
`final-r2-browser.json`; the latter records the verified post-refinement bundle.
Earlier `after-browser-r2.json` and `final-browser.json` are retained candidate
runs, not substituted for the final measurements.

| Measurement | Old 8 km | New 4 km |
|---|---:|---:|
| Generated chunks | 256 | 64 |
| Detailed chunks in the test view | 14 | 11 |
| Actual frustum-visible chunks | Not instrumented | 10 |
| Node coarse geometry generation, all chunks | 2174.3 ms | 575.1 ms |
| Browser coarse geometry generation | Not instrumented | 685.2 ms |
| Average draw calls, 1× / 5× | 189.0 / 189.5 | 117.0 / 117.5 |
| Frame p95, 1× / 5× | 12.2 / 24.3 ms | 12.2 / 24.3 ms |
| Worst sampled frame, 1× / 5× | 425.3 / 546.8 ms | 121.5 / 401.0 ms |
| Mean CPU frame, 1× / 5× | 3.53 / 11.33 ms | 3.33 / 11.46 ms |
| Mean simulation cost, 1× / 5× | 1.48 / 8.99 ms | 1.53 / 9.42 ms |
| Simulation seconds per ~8 wall seconds, 1× / 5× | 7.65 / 24.10 | 7.95 / 25.45 |
| Long east/west northern route search | 602.9 ms | 289.4 ms |
| Long north/south western route search | 511.8 ms | 155.6 ms |
| Long east/west southern route search | 516.6 ms | 205.9 ms |
| Diagonal search | 1087.3 ms | 418.8 ms |

Directions in the route table refer to world coordinates (negative z is north):
the first east/west route is at z=−1750 and the other at z=1600. Each uses the
same endpoints in both worlds, with 30/30/31/34 waypoints and successful arrival.
Coarse generation excludes scenery and asynchronous refinement. Final worker
totals are 1607.4 ms over 68 jobs after the first restored sample, and 2905.0 ms
over 132 after the second; these include separate restored-world generations.

The map reduces generated chunks by **75%**, coarse generation cost by **73.5%**,
and sampled draw calls by **38%**. All four route searches are faster. Measured
p95 is unchanged, not worse, and advancement/hitch maxima improve. **Not every
CPU metric improves**: simulation cost is slightly higher, and the denser world
does not remove combat's CPU limits.

**The heavy 300-person scene still fails the 16.7 ms p95 / real 5× target** in both
old and new worlds. New requested 5× advances 25.45 seconds in 8 wall seconds,
not 40. First-contact slow-down is disabled identically by an established
engagement in this fixture; final requested speed is still 5. No timings or
checks are hidden to call that a pass. In contrast, the ordinary 96-person
campaign construction check advances about 100 seconds per 20 wall seconds at
5×. No 1,000-person benchmark was run in this rebase.

## Remaining limits and old assumptions

The pre-change [assumption inventory](world-rebase-audit.md) covers all searched
8 km dependencies. No hardcoded ±4000 origin, 8000 map span or 16×16 chunk loop
remains in normal new-game creation, navigation, camera, logistics or maps.
The retained terrain expression `z - 4000` is a **noise phase**, not a bound;
the navigation `8000` value is a search-iteration budget. Numeric off-map inputs
remain in isolated pure-query/occlusion/legacy-rejection tests, not world spawns.
Historical evidence, reports and retired study inputs are deliberately unchanged.

This is still a procedural, stylized landscape: regular building grids and simple
river materials remain, and the physical causeways are not modeled bridge assets.
The cut edge of the finite world can be visible at very wide/edge camera angles.
Mission balance on relocated terrain still needs player review. Dense 5× combat
and occasional loading hitches remain performance work; no 1,000-person or
CrazyGames-readiness claim is made here. The existing large-bundle build warning
remains. Unrelated simulation and UI design have not been rewritten.

## Changed files

The audit/report and README accompany these scoped changes:

- World: `src/core/types.ts`, `src/terrain/{WorldLayout,WorldFeatures,TerrainSystem,WorldOcclusion}.ts`, `src/simulation/createBattlefield.ts`.
- Rendering/camera: `src/render/{TerrainRenderer,GroundWorker,GroundGeometry,Scenery,StrategyCamera}.ts`.
- Movement/logistics/scenarios: `src/navigation/SquadNavigation.ts`, `src/simulation/BattlefieldSimulation.ts`, `src/garrison/{LogisticsSystem,GarrisonPolicy}.ts`, `src/operations/{createCampaign,createOperation,types}.ts`, `src/construction/ConstructionReadout.ts`.
- Persistence/UI/debug: `src/persistence/SaveSystem.ts`, `src/app/FrontlinesApp.ts`, `src/vite-env.d.ts`, `src/ui/{FieldMap,TacticalOverlay,OperationUI}.ts`.
- Tests: `src/terrain/WorldRebase.test.ts`, `src/render/{GroundGeometry,StrategyCamera}.test.ts`, `src/construction/ConstructionReadout.test.ts`, `src/navigation/SquadNavigation.test.ts`, `src/garrison/{DeterministicGarrison,GarrisonRelocation,LivingTransitions,NearestEntry}.test.ts`, `src/combat/Casualties.test.ts`, `src/operations/{LocalIntelligence,Visibility}.test.ts`, `src/simulation/Buildings.test.ts`.
- New probes: `scripts/benchmark-world.ts`, `scripts/qa-world-{controls,geography,performance}.cjs`.
- Updated reusable probes: `scripts/{combat-qa-fixtures,mixed-combat-fixture,prepare-combat-fixture,verify-combat-balance,visual-rescue-fixtures}.ts`, `scripts/qa-{build-workflow,field-interactions,visual-impact,visual-performance,visual-rescue}.cjs`.

The game-foundations and Three.js separation guided the shared geography and
simulation-owned crossings; the playtest workflow required real controls and
screenshot inspection in addition to numerical tests.
