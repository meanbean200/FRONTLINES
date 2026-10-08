# Supplied BAR automatic rifle

**IMPLEMENTED / EDGE AND OFFLINE RENDER VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

Presentation-only continuation of the supplied equipment pipeline. Existing BAR
equipment selects the new model. Weapon statistics, ammunition, ownership,
suppression, accuracy, visibility, AI, scenario forces and saves are unchanged.

## Preserved source and preparation

- `Downloads/bar` is a 67,227-byte OBJ with 1,046 vertices and 2,100 triangles,
  without UVs, materials or animation. The original is unchanged;
  `assets/source/bar.obj` is an exact copy.
- Source SHA-256:
  `9c0de41cbef0dc065c80e91d7ed75c9f3ba119b53c5dcffb5625c96617b9726a`.
- `npm run assets:weapons` retains every triangle, normalizes the source's -Z
  barrel direction to +Z, and fits it to a 1.20-metre game scale. Wood/steel
  vertex colours, crease-aware normals, a carrying grip and the existing
  `[0, 0, 0.6]` muzzle contract are baked into the asset.
- The source bipod is split into two named legs. The loader prepares shared
  folded and deployed geometry once; it does not create a mixer per soldier.
- Combined equipment GLB: **702,540 bytes / 11,650 source triangles**, an increase
  of 104,196 bytes. One material, no textures or external runtime dependencies.
  Repeated generation produced identical GLB and manifest hashes. Other supplied
  weapons retain their original transforms, sockets and geometry.

## Runtime behavior

The existing automatic-rifle instance batch carries the BAR. Active, stationary
prone bearers use one additional shared deployed-bipod batch. Standing, walking,
crawling, sleeping and incapacitated bearers do not deploy it. No second gun is
drawn on the same person. Distant and failed-load views retain procedural assets.

Carrying uses the animated right-hand grip; aim and muzzle flash use the actual
shot origin and direction. No ballistic result is changed to fit the mesh.
The updated standalone HTML includes the model, and context restoration retains
the geometry. No campaign migration or equipment refill is required.

## Verification and evidence

- **28 focused renderer tests / 3 files passed**, including 11 equipment tests:
  source hashes, triangles, finite attributes, scale, muzzle equality, animated
  hand attachment, correct equipment slot, folded/deployed transitions, no
  duplicate gun, crawling/sleeping/incapacitation, LOD, failed-load fallback,
  context reupload and unchanged simulation state.
- Full regression: **1,081 tests / 166 files passed**.
- Production/standalone build and packaging **5/5 passed**. The single HTML is
  approximately **4,134 KiB**, with two embedded workers. The pre-existing large
  bundle warning remains; this does not constitute loading-performance approval.
- Builder and workshop separately typechecked. Asset regeneration is repeatable.
- Installed Edge controls inspected the raw source, **BAR model**, **Toggle BAR
  bipod**, **BAR handling** and **BAR prone**; pause and WebGL loss/restore passed
  with no console errors. The workshop is an art fixture using the production
  loader/renderer, not a new battle or a combat acceptance test.
- Sandbox was entered through real controls; Rifle 01 was selected and zoomed,
  and a right-drag route issued. Its existing BAR bearer (person 3) followed the
  drawn path while retaining the actual BAR equipment. No soldiers, equipment
  or solved runtime state were injected into this check.
- `node scripts/qa-soldier-offline.mjs --weapon=bar` opened a copy of the standalone
  file alone with networking disabled. Real Sandbox/pause controls and camera-only
  diagnostic focus found the existing BAR bearer. **Zero page errors and zero
  HTTP requests.** This is a render/launch check, not a frame-time benchmark.

Local evidence under ignored `output/playwright/`:

- `bar-source.png`
- `bar-model-folded-v1.png`, `bar-model-deployed-v1.png`
- `bar-handling-v1.png`, `bar-prone-v1.png`, `bar-context-restored.png`
- `bar-game-selected.png`, `bar-game-walking.png`
- `bar-offline-1791481901995/offline-bar.png` and `result.json`

An asset-regeneration hot reload invalidated one CLI element reference; taking a
fresh snapshot resolved it. That attempt and the first-pass screenshots remain
preserved. Browser checks used automated installed Edge, not physical-phone or
subjective player acceptance. The art workshop never touches campaign storage.

## Limits

Materials and mechanical-part separation are first-pass interpretation of the
supplied mesh. Shared infantry animation is retained; there is no new two-hand
IK, terrain-conforming bipod placement, bolt/magazine animation, or detailed
reload mechanism. Hand/stock contact can be imperfect in some poses. Bipod pose
switching does not add a gameplay accuracy bonus or authorize firing.

Overall status remains **PARTIAL**. Full-combat performance, original bug
reproductions, long sessions, physical mobile and player-believability gates
remain separate open work. This integration does not claim to close them.
