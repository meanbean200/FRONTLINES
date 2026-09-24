# 4 km battlefield rebase — pre-change inventory

Baseline: `7a3b1d2`, 23 September 2026. This inventory was recorded before runtime changes.

| Area | Existing assumption | Required change |
|---|---|---|
| `core/types.ts` | `WORLD_SIZE=8000`; half=4000; chunks=500 | Single 4000 m canonical extent; derived 8×8 topology and versioned world identity |
| `render/TerrainRenderer.ts` | 16×16 eager coarse meshes; repeated 4000/3500/3750 origins, worker requests, cut/vegetation bounds | Derive all origins, centres, limits; keep 500 m LOD/refinement/worker architecture |
| `render/Scenery.ts` | Four ribbons always span −4000…4000, 2000 segments each | Shared in-bounds road/water geometry and metre-based sampling |
| `terrain/WorldFeatures.ts` | Five settlements; La Ferme x=2240 and Bois Noir x=−2520; duplicated road expressions | Denser distributed villages/hamlets/farms, shared road exclusion, no cropped settlements |
| `terrain/TerrainSystem.ts` | Three sparse roads, one river; terrain and forest wavelength/phase constants | Add connected secondary approaches/crossings while preserving shared physical terrain and earthworks |
| `render/StrategyCamera.ts` | Bound uses WORLD_HALF, max zoom=6000, far=14000, pick distance=18000 | Useful close/operational zoom and in-world focus/picking; extent-derived far range |
| `ui/FieldMap.ts` | 8000 theatre span, 8 km label, 1 km scale bar | Shared extent-derived transforms, edge-clamped sector, full 4 km map |
| `ui/TacticalOverlay.ts` | 8000 overview; sector centre initially fixed southwest | Full map transform and current-focus sector, correct edge coverage |
| `garrison/LogisticsSystem.ts` | Rear x=−3100; convoy ±3980; forward clamp ±3900; only one east–west road | Physical edge convoys, rear depots in depth, connected-road routing to nearby forward transfer points |
| `operations/createCampaign.ts` | Player rear=−2300, enemy edge=3980; both armies/objectives clustered far southwest | Opposing rear areas and prepared lines across the new map; preserve mission rules/rosters |
| `operations/createOperation.ts`, `simulation/createBattlefield.ts` | All modes use the same small southwest footprint | Retain sandbox and short-mode distances; move defensive operation to a different settlement/axis |
| `operations/Replacements.ts` | Uses convoy/shuttle positions, no independent entry constant | Verify inherited map-edge arrival and supply chain, no new personnel rules |
| `navigation/SquadNavigation.ts`, `simulation/BattlefieldSimulation.ts` | WORLD_HALF bounds; free-destination radial search can leave bounds | Derived bounds and route safety; full-map traversal regressions |
| `persistence/SaveSystem.ts` | v1/v2/v3 share unversioned generated terrain; no coordinate bounds validation | New storage key/world identity; preserve and clearly reject real legacy 8 km worlds, never clamp-migrate |
| `GroundWorker`, `NavigationWorker`, `WorldOcclusion`, `GroundGeometry`, `TrenchGeometry` | Shared 500 m chunks; workers rebuild sampled world; coarse borders rely on aligned origins | Verify all 64 chunks, workers, border seams, trench/crater restore; keep metre scale |
| Debug/performance | “visible chunks” actually counts detailed chunks; no generation timing | Report generated, detailed and frustum-visible separately, generation and navigation timings |
| Scripts/browser fixtures | `mixed-combat-fixture.ts` has x=−2200, convoy3980, dummy objectives3500/−3000; historical JSON/probes contain old coordinates | Update reusable generators; preserve historical evidence, reject incompatible fixtures explicitly |
| README | Advertises 8×8 km | Update current-world documentation |

Non-bound matches: terrain noise phase `z−4000`, 8000 A* iteration budget,
4096 cache size, 256 shot history/texture dimensions, CSS z-indices, 8-second
browser sample windows, study training sizes and algebraic reservation tests.
These are not map extents. Historical reports/evidence must not be rewritten.

## Composition and compatibility decision

Use 64 × 500 m chunks, distributed settlements and farmland on both sides of a
river/ridge system. Connect rear areas, lateral routes and crossings with shared
roads used by terrain, building placement, maps, rendering and truck navigation.
Campaign lines face east/west with depots in the outer 700 m; the short defensive
scenario uses a north/south approach. These are composition choices, not hidden zones.

Changing generated roads, buildings and terrain makes an exact old-world migration
unsafe. A world-version gate and separate storage key will preserve v1/v2/v3 8 km
saves. A legacy-load attempt must explain incompatibility without touching storage.
Normal 4 km saves retain the existing simulation schema and exact continuation.

## Measurement plan

Record old and new generation/navigation cost and a matched 300-person, four-truck
browser workload at 1×/5×. Keep baseline JSON/screenshots separate from new captures.
Distinguish frustum-visible chunks from detailed/resident geometry. Use actual Edge
controls for menus, map focus, construction, movement and save/load; inspect images.

## Additional findings during verification

- `FrontlinesApp.startGame` had an independent hardcoded launch-focus table.
  After scenario relocation this aimed campaign/defense at their former areas.
  It now uses the current command post or living friendly personnel.
- `GroundGeometry`'s ordinary coarse cells could undersample a narrow physical
  causeway by 1.15 m. Crossing cells now receive the existing local refinement
  treatment at both worker LODs; generated chunk count remains 64.
- The reusable field-map browser probe contained its own `river/8000` transform.
  It now reads world size; visual/combat generators validate world-2 fixtures
  into new paths instead of silently reusing legacy files.
