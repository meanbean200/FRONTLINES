# Supplied submachine gun

**IMPLEMENTED / EDGE AND OFFLINE RENDER VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

This continues the supplied soldier, rifle, MG, field-gun and truck integration.
Only presentation changes: no weapon statistics, ammunition, equipment ownership,
AI, visibility, simulation timing, scenario population or save changes.

## Source and preparation

- The extensionless `Downloads/sub mg` file is an OBJ: 67,174 bytes, 1,048 source
  vertices and 2,100 triangles. It supplies no materials, UVs, rig or animation.
- `assets/source/smg.obj` preserves it byte-for-byte. SHA-256:
  `1b905034524184a6e0d0e167600320f9034b680cd3af83077c78371f747fc200`.
  The Downloads original was not modified.
- `npm run assets:weapons` prepares an approximately 0.82-metre, +Z-forward model
  with wood/steel vertex colours, crease-aware normals, a carrying grip socket
  and the existing SMG muzzle at `[0, 0, 0.29]`. All source triangles survive.
- The shared equipment GLB is now **598,344 bytes / 9,550 triangles**, an increase
  of 118,096 bytes. It still uses one material and no external textures. A repeat
  build produced identical GLB and manifest hashes. Existing rifle/MG/cannon
  transforms and sockets are unchanged.

## Rendering contract

The existing SMG equipment slot selects the model, for either faction. It does
not issue another weapon or replace the rifles of ordinary riflemen. One shared
geometry uses the existing instanced SMG batch; no per-soldier model loading or
animation mixer is added. Distant views and failed asset loads retain the cheaper
procedural fallback.

Carrying follows the animated right-hand grip socket. Aiming and firing retain
the authoritative shot origin and direction, with the mesh muzzle aligned to
that result. Rendering does not bend a shot to match an animation. Context
restoration reuploads the retained geometry. The updated standalone HTML embeds
the model without a companion file or internet request.

## Verification

- Full regression: **1,078 tests / 166 files passed**.
- Focused renderer pass: **25 tests / 3 files passed**. Equipment tests cover
  source integrity, finite attributes, triangle count, scale, shot/muzzle
  equality, carrying-hand attachment, equipment selection, distant/failed-load
  fallback, context reupload and unchanged simulation state.
- Production build, standalone build and packaging **5/5 passed**. Standalone
  size is approximately **3,997 KiB**, with two embedded workers. The existing
  bundle-size warning remains; this is not a loading-performance acceptance.
- Asset builder and workshop separately typechecked.
- Installed Edge through real controls: inspected **SMG model** and **SMG
  handling** in the equipment workshop, paused, lost/restored WebGL context,
  entered Sandbox, selected Rifle 01, zoomed, issued a right-drag route and
  resumed play. The squad physically reached the route; its existing SMG bearer
  retained the SMG. No browser errors. No runtime soldiers/equipment were
  injected into that game check.
- `node scripts/qa-soldier-offline.mjs --weapon=smg` opened a copy of the single
  HTML file in a fresh, network-disabled Edge context, entered Sandbox and
  paused through controls. A camera-only diagnostic focused an actual SMG
  bearer (person 9). **Zero page errors and zero HTTP requests.** This is an
  offline rendering check, not a combat scenario or a frame-rate benchmark.

Local evidence is retained under ignored `output/playwright/`:

- `smg-source.png`, `smg-model.png`, `smg-held-v1.png`, `smg-handling-v2.png`
- `smg-context-restored.png`
- `smg-game-selected.png`, `smg-game-movement.png`
- `smg-offline-1791481216847/offline-smg.png` and `result.json`

The workshop is an isolated art fixture using the production loaders and unit
renderer. It never reads or writes campaign storage. Browser checks used
automated installed Edge, not a physical-phone or subjective player review.

## Remaining limits

Colours and sockets are first-pass preparation of the supplied silhouette, not
an assertion of a precise historical model. Shared infantry clips are retained;
there is no new two-hand IK, animated bolt/magazine/reload mechanism, painted UV
wear, or faction-specific SMG variant. Support-hand contact may still separate
at some aim angles. Player art acceptance remains open.

The existing large-battle performance, long-session, original bug reproduction,
mobile and overall gameplay gates remain **PARTIAL / OPEN**. This asset task
does not claim to resolve them.
