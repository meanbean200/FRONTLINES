# Supplied shovel

**IMPLEMENTED / EDGE AND OFFLINE RENDER VERIFIED / PLAYER ART ACCEPTANCE OPEN.**

Presentation-only continuation of the supplied equipment pipeline. Excavating
and spoil-clearing personnel use this shovel. Construction rates, scheduling,
work faces, tool ownership, supplies, simulation and saves are unchanged.

## Source and preparation

- `Downloads/shovel` is an extensionless OBJ: 22,046 bytes, 352 vertices and
  700 triangles. It has no UVs, normals, materials, rig or animations. The
  original is untouched; `assets/source/shovel.obj` is a byte-identical copy.
- Source SHA-256:
  `a387a7e274f0acae62ab17438837d694ca555e0ed70e0f27987554e11b7afdf0`.
- All triangles are retained. The builder supplies crease-aware normals,
  wooden-handle/dull-steel vertex colours and a grip socket. The source's X-axis
  shaft becomes local +Y, with the blade below the hands. Its 1.05-metre length
  is a game-fit choice, not a historical measurement.
- Combined equipment GLB: **937,312 bytes / 16,450 source triangles**, an increase
  of 28,192 bytes. One shared material; no textures or runtime asset requests.
  Repeated generation produced identical GLB and manifest hashes. Previous
  equipment transforms and sockets are unchanged.

## Presentation

The existing tool instance batch now uses the source geometry at detailed zoom.
The grip follows the lower sampled hand, the shaft passes through the upper
sampled hand, and blade twist follows body facing. These are the same sampled
attachments used by the GPU soldier animation. No model stretching or per-worker
scene graphs/mixers are introduced.

Both `digging` and `clearing spoil` show the shovel and suppress the carried gun.
Inactive soldiers with stale work actions do not retain a working tool. Walking,
sleep, eating, treatment and unrelated support construction do not show one.
The existing distant visibility and failed-load procedural fallback remain.
Fallback soldiers now have separated shaft grips instead of same-height hands.

`tools/weapons-preview.html` adds **Shovel model** and **Inspect digging**.
This is explicitly an isolated art fixture, not a simulated battle or save.

## Verification

- **1,086 tests / 166 files passed**, full regression in 255.83 seconds.
- **25 focused renderer tests / 3 files passed**, including 16 equipment tests.
  Coverage includes source hashes/triangles/scale, finite geometry, both sampled
  hand attachments at four headings and four animation phases, rigid scale,
  paused stability, degenerate-hand stability, digging/spoil visibility, absent
  duplicate rifle, distant/procedural fallback, dead/incapacitated hiding,
  hidden enemies, context reupload, state replacement and no simulation writes.
- Production and single-file builds passed; packaging **5/5 passed**. Standalone
  `FRONTLINES.html` is **4,548,776 bytes / approximately 4,442 KiB**, with two
  embedded workers. Existing large-bundle warning remains.
- Builder/workshop typechecks passed. Asset regeneration is deterministic and
  source-copy hashes match the unchanged Downloads original.
- Installed headed Edge controls inspected the model and animated digging,
  then paused it. WebGL loss/restore returned the tool batch with one shovel
  and **zero console errors**.
- In a fresh Sandbox, actual **Command / Your force / Engineer 1**, **B**, and
  mouse-drag controls ordered a roughly 40-metre trench. Normal requested 5x
  stepping brought the crew to work; a paused 12% construction screenshot shows
  the real crew digging the partially excavated trench. No solved runtime state,
  completed trenches, equipment or supplies were injected. Diagnostics only
  read state/projected coordinates or focused the camera. No save was used.
- `node scripts/qa-shovel-offline.mjs` repeated that control-driven excavation
  in isolated headless Edge from one copied HTML with networking disabled.
  At 20.2 simulation seconds the new trench was 12.41% complete, with eight
  active tool-equipped digging personnel. **Zero page/console errors and zero
  HTTP requests.** This is offline construction/rendering evidence, not full
  battle performance or completion-rate calibration.

Local ignored evidence under `output/playwright/` is preserved:

- `shovel-source.png` (first clipped view), `shovel-source-wide.png`
- `shovel-model.png`, `shovel-digging-first.png`, `shovel-digging.png`
- `shovel-context-restored.png`
- `shovel-engineers-before.png`, `shovel-real-digging.png`, `shovel-real-midwork.png`
- `shovel-offline-1791484349543/` (`offline-digging.png`, `result.json`)

## Limits

Materials are first-pass interpretations of an untextured user-supplied source;
independent asset licensing/provenance is not established. The existing shared
digging clip is retained, not a new digging animation or terrain-aware IK system.
Ground penetration, foot placement and work-face contact may vary with terrain.
The tool does not scoop a simulated load of earth. This does not alter excavator
allocation, delivery, construction timing, trench congestion or other gameplay.

Full-battle performance, physical mobile, long sessions and subjective player
art acceptance remain separate open gates. Overall gameplay/release status stays
**PARTIAL**. No neural training, automation or unrelated systems were started.
