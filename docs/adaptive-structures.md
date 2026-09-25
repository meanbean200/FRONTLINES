# Adaptive building and support-structure presentation

2026-09-24 · starts at `22ab96e` on `master`.

## Direction and changes

The pass treats “buildings” as both town buildings and engineer-built support works. No answer to the optional scope question was needed to start. Art direction: restrained rural masonry/slate/clay buildings and timber-revetted field works, with distinct silhouettes and useful close-up detail rather than noisy cosmetic overlays. The game-art and Three.js workflow keeps actual geometric protection in simulation and batches its presentation separately.

- Town houses retain their existing footprints, door locations, stairs, usable floors and saved identities. Four deterministic styles vary roof pitch, slate/clay tones, plaster/brick/stone treatment and open shutters. Pitched roof panels, gables, chimneys, sills, lintels and foundation masonry are shared finite geometry, not a renderer-only cover illusion.
- Foundation segments extend to the underlying hillside. Roofs and upper-floor details disappear with the existing friendly-interior cutaway. Damaged buildings lose a real section of roof; ruined buildings have no roof. This is still the bounded preset-damage system, not collapsing rooms or new destruction simulation.
- Support bays turn to their actual final connector segment. Revetment boards and posts follow local earth heights rather than sharing one floating slab. Rest bays have cots, pillows and timber headers; meal bays have benches, tables and cups; aid posts have stretchers and markings; stores have shelving and inventory-dependent boxes.
- Support works remain open inspection models. Timber framing is not an added opaque roof or a new ballistic protection bonus. Construction progresses from surveying to framing to installed furnishings. Empty stores are not filled with decorative supplies, and empty weapon positions do not produce a weapon.
- MG/mortar parapets use their exact facing, no 90-degree snapping. The earth-filled geometry and the rendered sandbag courses agree; mortar pits remain open above. Fine support detail reduces at distant zoom while silhouettes remain.
- New rest destinations use the same connector-aligned coordinates as the beds. Ongoing saved personal routes are not rewritten. Inventory, people and weapon ownership are unchanged.

## Architecture and performance bounds

`BuildingGeometry` remains the authority for house solids. Rotated-box ray intersections now support roof pitch and parapet yaw; broad-phase bounds skip irrelevant pieces before detailed intersections. The slab calculation avoids temporary per-axis arrays. Render geometry is merged per material/floor, so individual shutters and stones are not separate draw calls. `SupportAppearance` is a deterministic presentation adapter using the existing instanced box batch and distance-based detail reduction.

Save schema stays 3; rules identity changes to `combat-29-adaptive-structures-world2` because geometric sight/fire and new facility destinations changed. Existing saves migrate copies with the standard revised-rules notice. No new map generation, reassigned building IDs, free resources, neural training or automation.

## Evidence and acceptance

Disposable Edge profile only; player saves/profile untouched. Actual menu, roster, Support/Locate, operational map and zoom controls were used. Existing seed-1944 MG campaign was continued through the migration notice. Read-only diagnostics recorded camera/simulation state. Local screenshots are in ignored `output/playwright/`:

- `building-before-town.png` / `building-after-town.png`: same town, approximately matched camera, before/after silhouettes and details.
- `building-before-support.png` / `building-after-support.png`: existing completed MG nest, rest bay and angled aid connector. The aid entrance now follows that connector.
- `building-final-town.png`: final slate/clay, brick/stone/plaster and shutter palette, checked after a fresh reload. No browser console errors.

New tests cover rendered-vs-physical pitched-roof ray intersections, exact visibility under broad-phase culling, real doorway/window apertures, continuous parapet facing, slope-grounded pegs, unique facility geometry, inventory-dependent furnishing, detail reduction, foundations and interior cutaways. Existing building entry, queues, stairs, casualty exit and save/load tests remain required.

Final verification: **508/508 unit tests**, 71 files, 83.32 s (`building-adaptation-unit-final.json`); **21/21 browser regressions**, 48.2 s; TypeScript/production/portable build successful; **5/5 packaging tests**. Isolated offline single-file launch, embedded workers, movement, exact saved continuation and refresh sizing at 1280×720 / 1920×1080 all passed with no errors or network dependencies. Evidence: `building-adaptation-offline-1790297647829/`. The unchanged combat speed/save test also passed in the final full run at 34.1 s.

### Retained failed checks and limits

- The first presentation test incorrectly assumed different facility shapes must have different *numbers* of parts. Meal/storage counts coincided. It now compares their geometry, not an arbitrary count.
- First full unit run: 506/507; the combat speed/save continuation test exceeded its unchanged 45-second budget (58.4 s) during concurrent browser work. After geometric-query culling/allocation changes, its isolated rerun passed at 31.4 s. The original failure JSON and successful focused report remain: `building-adaptation-unit.json`, `building-adaptation-speed.json`. Timing alone is not a controlled before/after frame benchmark.
- Towns keep their previous grid layout and navigable floor plan to preserve campaign positions and building IDs. New streets, gardens, expanded floor plans and structural collapse are not included in this pass.
- No 300/1,000-person performance or subjective visual acceptance claim is made. Judge the change in game at normal play zoom as well as close up.
