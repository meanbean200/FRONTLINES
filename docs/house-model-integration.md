# Supplied small one-floor house

Follow-up: the separate two-floor asset is documented in
`docs/two-story-house-model-integration.md`. Results below describe this original
one-floor milestone; its source and generated asset remain unchanged.

**ADAPTED SURFACE INTEGRATION IMPLEMENTED / EDGE AND OFFLINE VERIFIED /
PLAYER ART ACCEPTANCE OPEN.**

This is an architectural adaptation, **not a literal replacement with the entire
closed exterior mesh**. The supplied roof courses and carved stone are used on
the game's existing intact, one-floor buildings. Their shared walls, doors,
windows, floor, foundation, chimney and gameplay dimensions remain authoritative.
The complete unmodified source is preserved and viewable in the art workshop.

## Why this adaptation

The source has closed doors and window surfaces in different positions from the
game's entrances and firing apertures. Simply overlaying it would make troops
walk through visible walls and shoot through closed windows. Moving the gameplay
openings instead would change existing orders, occupants and saved buildings.

The asset pipeline therefore extracts a reusable roof surface and rough stone
detail. The roof fits each existing eave and pitch; masonry detail fits within
the real trim volumes. Closed source facades/glass are not rendered across the
usable apertures. This preserves gameplay and gives the model an in-game use
without presenting a mismatched exterior as a complete playable building.

## Source and preparation

- `Downloads/small-one-floor-house`: extensionless OBJ, **526,557 bytes / 7,526
  vertices / 15,100 triangles**. No UVs, materials, rig or animations.
- `assets/source/small-one-floor-house.obj` is a byte-identical copy; Downloads
  original remains untouched. SHA-256:
  `5b43cb65b05728b5796c2bb29fc52813219131880c4b9e01cf3c5ae82be75d54`.
- `npm run assets:house` reproducibly generates `src/assets/house.glb` and
  `assets/house-manifest.json`: **113,336 bytes**, 3,267 roof triangles and a
  79-triangle stone sample. One material, no textures or new dependency.
- Roof X/Z are normalized to the eaves; Y stores metre-scale decorative relief.
  This explicitly parametric surface is fitted once to the building's dimensions.
  Tile relief is bounded to 1.2–14 cm above the solid roof skin; it does not add
  protection. Stone samples remain inside the existing trim envelope, with a
  shallow inset backing to avoid coplanar rendering artifacts.
- Repeated generation produced identical GLB and manifest hashes. Source hash
  matches the original. Existing soldier, vehicle and equipment assets unchanged.

## Runtime and ownership

The loader caches immutable source geometry. Per-building fitted geometry is
owned/disposed with the existing scenery, not stored in simulation state. No
per-frame mesh reconstruction is introduced. The two additional detail batches
per applicable building follow normal frustum culling and distance detail:
180/350/500 metres for low/balanced/high, incorporating camera zoom.

Only intact, one-floor buildings receive this dressing. Two-floor buildings keep
their original presentation. Damage/ruins use the established physical presets,
without an intact overlay covering missing walls or roof. Roof cutaways hide the
new roof at the same layer as the existing attic. Asset failure retains the
procedural buildings; late loading applies to the current world, not an old
captured session. Shared geometry is retained for graphics-context reupload.

No changes to collision, cover, sight, bullet traces, occupancy/capacity, pathing,
orders, capture, damage, populations, simulation timing or save schemas.

## Verification

- **1,091 tests / 167 files passed**, full regression in 211.98 seconds.
- **31 focused tests / 4 files passed**, including five new model tests:
  source hash/triangles/bounds; fitted roof relief for different footprints and
  pitches; clear entrance/window rays; unmodified physical geometry/state;
  one-floor applicability; cutaway/LOD stability; damaged/ruined fallback;
  owned-geometry disposal; source immutability; context reupload and restored
  state producing the same presentation.
- Production/standalone builds and **5/5 packaging tests passed**. HTML is
  **4,702,195 bytes / approximately 4,592 KiB**, with two embedded workers.
  The existing large-bundle warning remains, not a performance acceptance.
- Builder and workshop separately typechecked. No new package dependency.
- Headed Edge controls inspected the adapted house, cutaway, damage, ruins and
  fallback. Graphics-context loss/restore returned the source roof with **zero
  workshop console errors**. These controls manipulate an isolated art fixture,
  not a campaign; their damage buttons are not artillery-playthrough evidence.
- Fresh Sandbox, ordinary **Rifle 01 → building click → Occupy floor → 5x**:
  soldiers physically marched to Farm building 22. The first stationed soldier
  arrived at 254.45 simulation seconds; all eight reserved places were occupied
  by 262.45. Two surplus personnel retained the existing capacity-wait behavior.
  Selected occupants triggered roof cutaway. Zero game console errors. No
  soldier/stock/order injection, save reads or writes; diagnostic actions were
  read-only inspection/projection and camera focus.
- `node scripts/qa-house-offline.mjs` repeated actual building entry in isolated
  headless Edge with one copied HTML and networking disabled. First station at
  254.1 simulation seconds; zero page/console errors and zero HTTP requests.
  This verifies embedded loading and occupation, not a full combat/performance gate.

Ignored evidence under `output/playwright/`:

- `house-source.png`, `house-source-back.png`
- `house-adapted-first.png`, `house-adapted.png`
- `house-cutaway-final.png`, `house-damaged.png`, `house-ruined.png`
- `house-fallback.png`, `house-context-restored.png`, `house-occupied-game.png`
- `house-offline-1791485507470/` (`offline-house.png`,
  `offline-occupied-cutaway.png`, `result.json`)

First-pass evidence is retained. The raw inspection page had a missing favicon
and duplicate-Three import warning; the production workshop did not. The first
new restoration test used a nonexistent fixture method, corrected to construct
the real simulation. A standalone typecheck needed `DOM.Iterable`; the project
build was already green. A stale browser reference failed harmlessly and
`house-cutaway.png` captured the unchanged exterior; the correctly repeated
capture is `house-cutaway-final.png`. An attempted second dev server refused the
occupied port; the existing server was reused and left running.

## Remaining / limits

- The full facade, closed door, window layout and complete original proportions
  are available as reference, not shipped as a literal occupiable-house variant.
  A fully faithful architectural variant requires a shared layout/geometry
  contract and save-compatible variant selection, outside this visual-only pass.
- Existing interiors remain basic. In the live steep-ground fixture, terrain can
  intersect part of the floor; this existing world/foundation limitation was not
  hidden by moving the building or occupants. Ground-floor height and lighting,
  terrain fit, custom damaged meshes and detailed interiors remain separate work.
- Normals/materials are first-pass interpretations of an untextured source.
  Independent licensing/provenance is not established beyond user provision.
- Full-battle performance, physical-phone acceptance, long sessions and subjective
  art approval remain open. Overall gameplay/release remains **PARTIAL**.

The asset-pipeline/Three.js guidance led to reproducible upstream preparation,
bounded distance detail and retaining shared gameplay geometry. No neural
training, automation or unrelated simulation systems were started.
