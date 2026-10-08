# Supplied machine-gun mount

**IMPLEMENTED / EDGE AND OFFLINE RENDER VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

Presentation-only continuation of the supplied equipment pipeline. Installed MG
positions pair this mount with the previously supplied machine gun. No changes
to weapon ownership, construction cost, crew requirements, ammunition, firing,
visibility, damage, navigation, simulation time or saved campaigns.

## Source and preparation

- `Downloads/mg MOUNT` is an extensionless OBJ: 137,404 bytes, 2,016 vertices,
  4,100 triangles, with no UVs, materials, rig or animations. The original is
  unchanged; `assets/source/mg-mount.obj` is an exact copy.
- SHA-256:
  `3c12eab521450d16f78561053071df5b91acf50172b3845996c319604e604d88`.
- The supplied geometry is the base and cradle, not another gun. The reproducible
  builder retains every triangle, splits lower base from upper cradle, applies
  muted painted-steel vertex colours and crease-aware normals, and normalizes
  the footprint to 1.4 metres. This is a game-fit scale, not a historical claim.
- Neck sockets join the two parts. A procedural adjustable riser bridges the
  source's low mount to the game's existing firing height; the whole source mesh
  is not stretched, and the authoritative muzzle is not moved to fit the art.
- Combined equipment GLB: **909,120 bytes / 15,750 source triangles**, up 206,580
  bytes. One shared material, no textures or external runtime asset dependency.
  Repeated generation produced identical GLB and manifest hashes. Previous
  equipment geometry, transforms and sockets are unchanged.

## Runtime

Three shared instance batches render bases, cradles and risers, each bounded at
256 entries. Installed positions use the existing visibility/frustum gates;
distant views and asset-load failure retain the procedural support. This is not
an individual scene graph or animation mixer per gun.

Feet remain at the installed post with its fixed facing. The upper cradle follows
the gun's traverse/elevation and actual shot direction. Both riser endpoints stay
attached. The existing gun muzzle remains exactly aligned with `ShotEvent`.
No extra held weapon is drawn on the operator. Empty ammunition or absent crews
do not remove the installed hardware. Incomplete/uninstalled positions do not
show it. The new visual parts provide no additional protection or capacity.

## Verification

- **1,084 tests / 166 files passed** (full regression, 257.55 seconds).
- **25 focused renderer tests / 3 files passed**, including 14 equipment tests.
  Added source triangle/scale checks, stationary feet through traverse, elevation,
  crew movement and shot error; exact muzzle and riser endpoints; empty stock and
  crews; distance fallback; incomplete/uninstalled and hidden enemy suppression;
  no duplicate operator weapon; context reupload; stale-instance cleanup; and
  byte-identical simulation state before/after presentation updates.
- Production and standalone builds passed. Packaging **5/5 passed**. The single
  HTML is approximately **4,405 KiB**, with two embedded workers. The existing
  large-bundle warning remains; this is not loading-performance approval.
- Builder and workshop separately typechecked; asset generation is reproducible.
- Installed Edge controls inspected source geometry, **Inspect MG mount**,
  **Traverse MG**, **Elevate MG** and pause. WebGL loss/restore returned all three
  mount batches with zero console errors. The workshop uses production assets
  and presentation but is explicitly an art fixture, not combat evidence.
- In a fresh Sandbox, actual **Command / Positions / Build MG** controls placed
  an inline trench post and chose its facing. At normal requested 5x advancement,
  workers physically delivered **16 materials** and completed the installed
  `crew-mg` position. It remained visible without assigned crew or ammunition.
  Real middle-drag inspected the other side. Diagnostics only read state or
  focused the camera; no runtime soldiers, supplies or completed works were
  injected, and no campaign save was read or overwritten.
- `node scripts/qa-mg-mount-offline.mjs` opened one copied standalone HTML with
  networking disabled. The actual published title battle's installed MG was
  inspected with camera-only focus, then real controls entered and paused
  Sandbox. **Zero page/console errors and zero HTTP requests.** This verifies
  embedded loading and session entry, not a crewed firing or frame-time gate.

Local ignored evidence under `output/playwright/`:

- `mg-mount-source.png`, `mg-mount-source-axes.png`
- `mg-mount-installed-first.png`, `mg-mount-installed.png`
- `mg-mount-traversed.png`, `mg-mount-context-restored.png`
- `mg-mount-build-placement.png`, `mg-mount-build-target.png`
- `mg-mount-player-built.png`, `mg-mount-player-built-other-side.png`
- `mg-mount-offline-1791483411657/` screenshots and `result.json`

First-pass evidence remains preserved. The first new alignment test lacked its
fixture's combat state; initializing that fixture fixed the test, without a
simulation change. An unsupported CLI key-command attempt did nothing; the
subsequent camera/control sequence completed the placement normally.

## Limits

The painted material and mechanical split are interpretations of an untextured
source. Shared infantry animation remains unchanged: no new operator-specific
two-hand IK, per-foot terrain articulation, folding/setup animation, mechanical
reload or separate national mount variants. Hands can miss the grip at some
angles; feet can intersect steep ground around existing inline positions.
Support revetments and the installed post's firing geometry were not redesigned.
The added riser is a presentation adaptation, not supplied historical hardware.
Model provenance beyond the user-supplied file is not independently verified.

Full-combat performance, original reproductions, long sessions, physical mobile,
crewed firing/relief acceptance and subjective player review remain separate
open gates. Overall gameplay/release status remains **PARTIAL**. No neural
training, automation or unrelated systems were started.
