# Supplied soldier model — 7 October 2026

## Delivered

The user-supplied extensionless `troops` OBJ is now the near-view infantry model.
Its silhouette and 1,700 triangles are preserved. The source is copied, not changed;
its SHA-256 is `e76aa501aa434a052a5696c922e09ecedb0d72eab0eec5300486b0411be0a07b`.
`.gitattributes` preserves the source bytes across checkouts.

- Normalized to 1.8 metres, feet at zero, +Z forward.
- Vertex-colour cloth, helmet, webbing, leather, and skin; no external bitmap textures.
- Seventeen weighted joints and seventeen editable glTF animation clips: idle,
  unarmed, walk, aim, crouch, crouch-walk, crouch-aim, dig, field rest, eating,
  treatment, carrying, prone, crawl, sleep, wounded and dead.
- One shared body material; US, German and engineer cloth variants.
- Rifle/shovel attachment follows the animated hands. Resolved shots retain their
  authoritative muzzle and direction; the rig never changes ballistics.
- Separate sleeping, field-rest, wounded and dead poses. Dead clips do not breathe.
- Source geometry, GLB, rig/colour generation code and development preview are retained.

The model is provided by the user; no claim is made about original authorship or
third-party redistribution rights. These remain relevant before public release.

## Files and reproduction

| Purpose | Path |
| --- | --- |
| Unmodified source | `assets/source/troops.obj` |
| Runtime and Blender-compatible rig/animations | `src/assets/soldier.glb` |
| Build manifest | `assets/soldier-manifest.json` |
| Colour assignment, weights, glTF export | `scripts/build-soldier.ts` |
| Joint landmarks, IK and animation authoring | `scripts/assets/soldier-rig.ts` |
| Interactive development gallery | `/tools/soldier-preview.html` on the Vite server |
| Runtime adapter | `src/render/RiggedSoldiers.ts` |

Run `npm run assets:soldier` to regenerate the GLB and manifest; then `npm run build`
to update the player and standalone game. No Blender installation is needed for
this build, but the standard GLB can be opened in a DCC for manual refinement.
The development gallery is not part of the shipped player entry or offline build.

glTF Transform welds, resamples, deduplicates and prunes the export. No Draco,
Meshopt decoder or texture decoder is shipped for this small mesh. The final GLB
is 465,056 bytes. The portable HTML embeds it, so the soldier requires no server,
network access or companion asset file.

## Rendering boundary

Production GLTFLoader loads the rig. Its clips are sampled once into a shared
bone-matrix texture. One instanced body mesh reads that palette; there is no
per-person AnimationMixer, skeleton update or individual character draw call.
The same deformation is used for shadow depth, and held equipment samples the
same matrices. Activity changes blend over 0.16 simulation seconds. Pause and
saved time therefore control animation without changing deterministic game state.

The original cheaper distant representations remain beyond the existing quality
detail distances (95/180/280 metres of camera zoom). They also remain the load-failure
fallback, which logs the failure. This is an art/presentation change only: no new
simulation rules, hitboxes, saves, rosters or inventory were introduced.

## Verification and evidence

- Full suite: **1,065 tests across 164 files passed**. Following the final shovel
  reach adjustment, all **25 targeted renderer/model tests passed again**.
- Production and standalone builds pass; offline packaging **5/5** passes.
- Installed Edge: actual Sandbox selection and right-drag movement order;
  personnel observed `following drawn path` without state injection.
- Installed Edge: Engineer → Manage → Build → Trench; actual pointer-drawn work
  reached 78% with people `digging`. The new model was visible in excavation.
- Gallery: visual weight correction (earlier elbow-spike screenshots retained),
  action states, faction colours, weapon attachments and animated shadows reviewed.
- Gallery context loss/restoration returned to four draw calls without errors.
- Original source hash matches the file in Downloads. Campaign/player saves were
  not overwritten; browser checks used isolated automation profiles.
- Offline copied-file, network-disabled near-view verification is recorded by
  `scripts/qa-soldier-offline.mjs` in `output/playwright/soldier-offline-*`.

Local screenshot evidence (intentionally outside the release commit):

- `output/playwright/soldier-in-game-ready.png`
- `output/playwright/soldier-in-game-walk.png`
- `output/playwright/soldier-in-game-dig.png`
- `output/playwright/soldier-gallery-complete.png`
- `output/playwright/soldier-context-restored.png`

### Warm render-layer comparison, not whole-battle performance

Installed headless Edge, 1680 × 1000, same lighting, shadow settings, mixed actions
and 512 people. Both layers were resident; the selected layer alone was displayed.
Each 512-person sample lasted six seconds. Other sizes sampled four seconds.

| Render layer | People | Main-pass draws | Submitted triangles | Unit update p95 | RAF interval p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original close soldiers | 512 | 8 | 1,269,986 | 1.5 ms | 6.2 ms |
| Supplied rig | 512 | 4 | 915,682 | 0.9 ms | 6.2 ms |
| Supplied rig | 300 | 4 | 536,502 | 0.6 ms | 6.2 ms |
| Supplied rig | 1,000 | 4 | 1,788,442 | 1.4 ms | 6.2 ms |

These samples isolate character rendering and include floor/weapons/tools; they
do not run combat, logistics or AI. Frame timing is display/browser constrained.
The final shovel-pose refinement leaves geometry/batching unchanged, but these
timings were captured before that small adjustment. They do **not** close the
existing 512-person full-battle performance gate or physical-phone acceptance.

## Remaining artistic acceptance

This is a functional first-pass rig, not motion capture or a hand-painted texture
set. Extreme aiming slopes can still separate the support hand slightly from a
weapon because the shot remains authoritative and arm clips are bounded. Advanced
per-target IK, turn-in-place clips and high-detail face/finger animation are not
part of this pass. Player judgment of the result remains open.

Reference implementation guidance: [Three.js skinning](https://threejs.org/docs/pages/SkinnedMesh.html)
and [glTF Transform IO](https://gltf-transform.dev/modules/core/classes/NodeIO).
