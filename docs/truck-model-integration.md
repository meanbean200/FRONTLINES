# Supplied cargo truck

**IMPLEMENTED / EDGE AND OFFLINE RENDER VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

The user's `Downloads/truck` is now the close-view logistics lorry. This is a
presentation-only change, following the supplied soldier and weapon integrations.
No cargo, fuel, capacity, route, ownership, visibility rule, soldier roster,
delivery schedule, save schema, damage or simulation timing was changed.

## Asset preparation

- Original preserved byte-for-byte at `assets/source/truck.obj`; Downloads untouched.
- SHA-256: `56a00fc3db0fc07c91653a1f71ec3cea1e6a253751f49e29a297e214a0c6d767`.
- Source is one connected OBJ mesh: 7,460 vertices, 15,100 triangles, no UVs,
  material definitions, named moving parts or animation.
- All 15,100 triangles retained. Prepared as a 6.5-metre lorry, +Z forward,
  ground-level base, one body and six individually pivoted source road wheels.
- Muted olive paint, khaki canvas, dark rubber and dull glazing use vertex
  colours and one shared material; no external texture files.
- Crease-aware normals; glTF Transform welding, deduplication and pruning.
- `npm run assets:truck` regenerates `src/assets/truck.glb` and
  `assets/truck-manifest.json`. The **751,520-byte** GLB rebuilt identically:
  `2d5d42f0fb9c1cd2ee547d0054956505907148cdec155efacef92eec0579ff5f`.

These are first-pass material regions and part boundaries on the supplied mesh,
not a historically identified vehicle or newly UV-painted asset. The original
soft/faceted surface detail is preserved. No asset licence was supplied; retain
provenance and confirm distribution rights before any commercial submission.

## Runtime

`TruckAssets` loads one cached embedded GLB. `LivingRenderer` uses one instanced
body batch and six wheel batches, bounded to the existing 64 visible-truck limit.
Four detailed trucks therefore use the same seven vehicle draws as one, rather
than a separate set of meshes/materials per truck. One workshop truck submitted
15,390 triangles including its floor and background stock; four submitted 60,690.

Wheel rotation follows bounded measured physical displacement and stops when
the truck stops. Body and wheel transforms refresh between the existing 80-ms
facility-detail rebuilds. The body follows route direction. Installed source
wheels retain their individual geometry and measured axle offsets. The covered
body hides the old proxy passenger heads; actual passenger/cargo state is untouched.

The existing cheaper procedural lorry remains the distant/load-failure fallback.
Zoom hysteresis (205/235 metres) prevents oscillation at a single threshold. The
distant representation uses two vehicle draws; no source and fallback wheels are
displayed together. Visibility/frustum filtering still precedes presentation.
State replacement resets transient wheel history; removed trucks are pruned.

`FRONTLINES.html` embeds the model, with no companion files or network requirement.
Final standalone size is approximately **3,843 KiB**, with two embedded workers.
The existing large-bundle build warning remains. Workshop controls and source OBJ
are not part of the production entry.

## Verification

- **1,076 tests / 166 files passed**, including five new truck tests.
- Focused truck/weapon/visual suite: **22/22 passed**. Covers triangle conservation,
  source hash, finite attributes, dimensions, six-wheel placement, moving/parked
  transforms, inter-frame updates, LOD exclusivity, enemy visibility, bounded
  counts, removal, context-resource release, state replacement and no state writes.
- Production and standalone builds passed; packaging **5/5 passed**.
- Build and preview TypeScript separately typechecked.
- Installed Edge controls: open Sandbox, pause, Command → Positions → Supplies →
  Delivery truck Locate, close panel, wheel zoom, resume and pause again. The
  supplied lorries were visible on their actual generated road routes. No page
  console errors. No truck or solved logistics state was injected.
- Edge workshop: front/rear/side views, wheel-motion control, distant fallback,
  WebGL context loss and restoration. This is explicitly an **art fixture**,
  not a delivery/combat acceptance scenario.
- `node scripts/qa-truck-offline.mjs`: copy the HTML alone into a fresh evidence
  directory; launch Edge with networking disabled; use the same player controls
  to locate a real loading truck. **No page errors or HTTP requests**; screenshot
  confirms the supplied model. No campaign save was written.

Preserved local evidence under ignored `output/playwright/`:

- `truck-source.png`
- `truck-front-v1.png` (earlier material pass), `truck-front-v2.png`
- `truck-side-moving-v1.png`, `truck-rear.png`, `truck-lod.png`
- `truck-game-located.png`, `truck-game-moving.png`
- `truck-context-restored-final.png` (successful loss/restore)
- `truck-offline-1791436948125/offline-truck.png` and `result.json`

Earlier CLI reference/evaluation errors remain in `.playwright-cli/`; the initial
`truck-context-restored.png` is **not** restoration evidence because that attempt
did not execute loss/restore successfully. The later `-final` capture did.

## Inspection and remaining limits

Run the Vite server and open `/tools/truck-preview.html` for orbit/zoom, alternate
views, wheel movement and a distant-model comparison. This workshop uses the
production loader/renderer but never reads or writes campaign storage.

No opening doors, steering linkage, suspension rig, cab driver, damage-specific
wreck mesh, or separately modelled covered passengers were added. Both factions
use the supplied generic transport appearance. Full-battle 512-person/5×/mobile
performance and subjective art acceptance remain open; the regression suite and
small art inspection do not close those gates. Overall project status is PARTIAL.
