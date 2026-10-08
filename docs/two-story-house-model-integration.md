# Supplied two-story house

**ADAPTED SURFACE INTEGRATION IMPLEMENTED / EDGE ART AND OFFLINE OCCUPATION
VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

This follows the one-floor-house approach: the source's roof, stone sill and
shutter surfaces dress intact production two-floor houses. It is **not a literal
replacement of the entire closed exterior**. The complete original is preserved
and available beside the adapted building in `/tools/house-preview.html?floors=2`.

The original has closed windows/doors and a different aperture layout. Placing
that shell over the playable house would visibly block working entrances and
firing windows. Instead, the shared walls, openings, two floors, stairwell,
foundations, chimney, physical cover and saved building dimensions stay unchanged.
No source glass/door faces are placed over usable openings.

## Source and reproducible preparation

- `Downloads/2-story-house`: extensionless OBJ, **450,233 bytes**, 6,392 vertices,
  13,100 triangles; no supplied UVs, materials, textures, skeleton or animations.
- `assets/source/2-story-house.obj` is byte-identical. Original untouched. SHA-256:
  `7a87738d4faaea9a3b10f03d0234efccd48d50eb36fa4cd6080e0eecdf32c5ce`.
- `npm run assets:house-two` produces `src/assets/two-story-house.glb` and
  `assets/two-story-house-manifest.json`. **85,840 bytes**, one material, no textures:
  2,516 roof triangles, a 39-triangle stone sample and a 16-triangle shutter sample.
- Repeated generation produced identical GLB bytes, SHA-256:
  `1330474a02343c3f86df6aaf27f1fbc420ac83b6188c80e8a354b6ab568b50e0`.
- Roof X/Z fit production eaves; Y is bounded 1.2–14 cm decorative relief outside
  the physical roof skin. Trim fits existing solid volumes. Its shallow backing
  avoids coplanar artifacts. Detail adds no protection, capacity or collision.
- Palette/material interpretation uses existing weathered plaster, timber,
  masonry and roofing shaders. The untextured source has no authoritative color.

## Runtime boundaries

The one-floor asset and its generated files remain unchanged. Independent cached
loaders allow either kit to fail without hiding the other house type. Loader
validation rejects mismatched source/version; failed parsing disposes resources.
Immutable source meshes stay cached; fitted geometry belongs to the scenery and
is disposed on replacement. Late assets are consumed by the current world, not
attached to a captured obsolete session.

At most five added batches per intact two-floor building: roof plus masonry and
shutters per floor. Buildings without shutters use fewer. Detail follows existing
180/350/500-metre low/balanced/high distance thresholds with camera zoom. No
per-frame geometry allocation is introduced. The existing building-group rebuild
on structural changes is unchanged; this is not a claim of per-building rebuilds.

Ground-floor cutaway hides the upper storey and roof; upper-floor cutaway hides
the roof while retaining upper trim. Damaged and ruined buildings use production
physical presets, with no intact supplied skin covering the breach. No gameplay,
navigation, soldier scale, inventory, damage, saved-layout or save-schema changes.

## Verification

- **1,098 tests / 168 files passed**, full run 229.01 seconds.
- **38 focused tests / five files passed**, including seven new checks for asset
  identity/bounds, incompatible assets, varied roof footprints, both floors'
  apertures, stairs/shared-geometry immutability, trim-volume bounds, independent
  cutaways/fallbacks, bounded batching, distance detail, disposal, context reupload
  and deterministic presentation from restored state.
- Production and offline builds passed; **5/5 packaging checks** passed.
  Standalone HTML: **4,817,530 bytes / approximately 4,705 KiB**, two embedded
  workers. Existing large-bundle warning remains. No dependency added.
- Builder/workshop TypeScript checks and `git diff --check` passed.
- Actual headed Edge workshop controls: original front/rear, adapted exterior,
  upper/ground cutaways, damaged, ruined and fallback. Context loss/restore
  returned a visible roof with `isContextLost() === false`. Damage buttons are
  isolated art-fixture controls, not evidence of an artillery playthrough.
- Fresh game controls selected Rifle 01 and ordered the existing Large house 17
  upper floor. No entity, geometry, stock or order injection. Diagnostics were
  limited to state reads, projection and camera focus.
- The separate headed live occupation did **not** complete its 55-second wait.
  It scheduled approximately one frame/second and achieved 0.50x while requesting
  5x, although profiled active work was roughly 6–9 ms/frame and visibility was
  reported as visible. Root cause is not established; do not count this as a
  headed occupation or performance pass. Zero game console errors. That owned
  session was paused and closed; incomplete-state and timing evidence retained.
- `node scripts/qa-house-offline.mjs --two-story`: isolated **headless Edge**, one
  copied HTML, networking disabled. Eight soldiers marched through the real
  doorway and stair route and occupied upper-floor stations by **285.4 simulation
  seconds**. Eight places remained finite; no extra berths created. Zero page or
  console errors, zero HTTP requests. Screenshot shows eight people upstairs and
  the automatic cutaway. This is browser verification, not physical-device or
  full-battle performance acceptance.
- Repeated the one-floor offline path after shared renderer changes: all eight
  stations occupied by 262.0 simulation seconds; zero errors or HTTP requests.
  Evidence: `output/playwright/house-offline-1791486472129/`.

Local ignored evidence is retained under `output/` and `output/playwright/`:

- `house-two-regression.txt`, `house-two-build.txt`, `house-two-offline.txt`
- `house-two-source-front.png`, `house-two-source-rear.png`
- `house-two-adapted-first.png`, `house-two-upper-cutaway.png`,
  `house-two-ground-cutaway.png`, `house-two-damaged.png`, `house-two-ruined.png`,
  `house-two-fallback.png`, `house-two-context-restored.png`
- `house-two-live-exterior.png`
- `house-two-headed-incomplete.png`, `house-two-headed-scheduling.json`
- `house-two-offline-1791486269547/`: copied HTML, screenshots and `result.json`

First-pass failures are not hidden: live editing briefly loaded the new workshop
script against the old HTML, causing a missing-description error until reload.
The first aperture test incorrectly traced into the actual solid staircase;
it now stops just inside the wall. A moving-label click timed out; the stable
Forces drawer selected the squad successfully. Floor selection replaced an
automation reference, and regenerating the GLB restarted the unsaved dev session;
the controls were repeated afterward. None required changing gameplay rules.

## Remaining

The complete original facade/proportions are reference, not an occupiable source
variant. A faithful whole-house variant needs a save-compatible shared layout
contract, not a renderer-only shell. Interiors remain basic; custom destruction,
terrain/foundation fit and detailed furnishing are separate work. Licensing is
not independently established beyond user provision.

Full-battle performance, physical-phone testing, long sessions and subjective art
approval remain open. Overall release status stays **PARTIAL**. The asset/Three.js
guidance drove upstream optimization, shared physical geometry and browser checks;
no neural training, automation or unrelated systems were introduced.
