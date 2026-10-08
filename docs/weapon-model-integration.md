# Supplied rifle, machine gun and artillery

**IMPLEMENTED / focused renderer and Edge inspection verified / player art acceptance OPEN.**

This is a presentation-only continuation of the supplied soldier integration.
It does not change accuracy, damage, cadence, ammunition, equipment ownership,
crew rules, visibility, navigation, saves, or scenario populations. Overall
gameplay/release status remains PARTIAL; the full-combat performance gate stays open.

## Sources and repeatable preparation

The user's extensionless Downloads files are preserved byte-for-byte as
`assets/source/rifle.obj`, `mg.obj` and `cannon.obj`. SHA-256 values are recorded
in `assets/weapons-manifest.json` and checked in tests. Originals are untouched.

| Supplied model | Source triangles | Prepared presentation |
| --- | ---: | --- |
| Rifle | 850 | 1.10 m, wood stock/fore-end, dark steel, grip and muzzle sockets |
| MG | 2,500 | 1.23 m, steel/wood, separate bipods folded for carrying/mounting and deployed when prone |
| Cannon | 4,100 | 6.4 m overall, carriage/shield/wheels, pivoted elevating and recoiling barrel |

Run `npm run assets:weapons` to regenerate `src/assets/weapons.glb` and its
manifest. All 7,450 triangles are retained. Crease-aware normals smooth broad
surfaces without rounding every edge. Colour regions use one shared material,
no bitmap textures, and stable named meshes/sockets. Final GLB is **480,248 bytes**.
The cannon has a portable `cannon_discharge` animation; production instances
evaluate their poses from real simulation discharges rather than independent mixers.

The source meshes have no authored materials, UVs, rig, or moving-part labels.
Part assignment and colours are first-pass preparation, not claims of exact
historical identification. Both factions use the supplied rifle/MG for their
corresponding visual classes; SMG/BAR/mortar models remain the existing versions.

## Runtime contract

- `WeaponAssets` loads and validates one embedded GLB. Geometry is cached once;
  no OBJ parsing, external textures, per-person model loading or per-gun mixer.
- Handheld rifles and MGs use the existing instanced weapon batches and animated
  soldier hand socket. Distant soldiers retain the cheaper procedural weapons.
  Prone MGs share one additional instanced batch for deployed bipods.
- Mounted MGs remain at the physical post even with missing crew or ammunition.
  Their new model ends exactly at `mountedGeometry`'s muzzle; a real fresh shot
  takes precedence for barrel/flash alignment. No second carried gun is added.
- Field guns retain two instanced draws: fixed carriage/wheels and moving barrel.
  Barrel elevation follows the requested target area, never the secret resolved
  impact. Recoil requires an ammunition-consuming launched mission. It uses
  simulation time and freezes on pause. Gun transforms update every render frame,
  independently of the existing slower facility-detail rebuild.
- `FieldGunPresentation` provides the same barrel pose/muzzle to geometry and
  discharge dust. It does not resolve damage or authorize fire.
- Existing procedural assets remain available on load failure. Original saves
  keep their state and simply render with the new assets. Visibility gates are
  unchanged. Context recovery reuploads retained CPU geometry.
- `FRONTLINES.html` embeds both the soldier and equipment GLBs; no companion
  model files or network connection are required by the offline package.

## Inspection and evidence

`tools/weapons-preview.html` is a development-only workshop using production
loaders, `UnitRenderer`, `LivingRenderer` and gun-pose code. It has orbit/zoom,
close views, alternate side, elevation, recoil and pause controls. The recoil
button creates an explicitly labelled **art fixture**, not a real battle or an
ammunition/construction acceptance test. It never accesses campaign storage.

Edge checks performed:

- Open Front setup and Begin through real buttons; Able selection, camera zoom,
  and a right-drag movement order. Readback showed `following drawn path` and
  screenshots show the supplied rifle carried by the animated soldiers.
- Workshop front/reverse/close inspection of all three supplied models, folding
  corrections, elevation and recoil controls, pause, WebGL context loss/restore.
- A fresh Edge context with network disabled opened a copy of the standalone
  HTML alone, entered Sandbox, paused and focused troops. **No page errors or
  HTTP requests.** This verifies offline launch and the held-rifle presentation;
  it is not an offline artillery combat playthrough.

Local screenshots remain under ignored `output/playwright/`:

- `weapons-source-v2.png` (source inspection)
- `weapons-held-final.png`, `weapons-cannon-final.png`
- `weapons-cannon-elevated-v1.png`, `weapons-context-restored.png`
- `weapons-open-front-v1.png`, `weapons-game-walking.png`
- `soldier-offline-1791436090876/offline-soldiers.png` and `result.json`
- `soldier-offline-1791436296819/` (final repeat after skipping empty gun-animation work)

Earlier failed source/workshop screenshots and console output are retained,
including initial preview import/setup errors and the first incorrect bipod fold.
Final workshop rebuild/typecheck and offline check passed.

## Verification

- Full regression run: **1,070 tests / 165 files passed**.
- Final renderer pass after the deployed-bipod addition: **29 tests / 5 files
  passed**, including six new equipment tests. Covers source hashes, triangle
  counts, finite geometry, scale, folded/deployed bipods, muzzle equality,
  mounted visibility without crew, LOD fallback, no simulation mutation,
  pause/recoil, unknown-impact independence, save-derived continuation, and
  context reupload.
- Production/standalone build and packaging **5/5 passed**. Final standalone is
  approximately **2,862 KiB** with two embedded workers. The existing large-bundle
  warning remains; assets are intentionally embedded for offline delivery.
- Build/preview scripts separately typechecked. No gameplay or save migration changes.

### Render-only samples, not full-battle acceptance

Installed Edge, headless, 1280 × 720, four-second warm samples in the existing
soldier gallery. Both comparison render layers stay resident; only one is visible.
The baseline is the original procedural soldier **and** original equipment, not
an isolated weapon-only comparison. The fixture does not run AI/combat/logistics.

| Layer | People | Draw calls | Rendered triangles | Unit-update p95 | RAF interval p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Supplied soldier + rifle | 512 | 4 | 1,203,682 | 2.1 ms | 6.2 ms |
| Original procedural models | 512 | 8 | 1,269,986 | 2.2 ms | 6.2 ms |
| Supplied models | 300 | 4 | 705,252 | 1.1 ms | 6.2 ms |
| Supplied models, stress | 1,000 | 4 | 2,350,942 | 2.5 ms | 6.2 ms |

These samples do not close 512-person combat, achieved 5×, long-session, mobile,
or player-believability gates. They are not directly comparable to the prior
1680 × 1000 soldier-only sample.

## Remaining limitations

- First-pass colours and moving-part splits; source proportions/silhouettes are
  preserved. No UV-painted wear, interchangeable historical national variants,
  or independently animated bolt/magazine/ejection mechanism was supplied.
- Rifle/MG handling uses the existing shared infantry clips. There is no new
  target-specific two-hand IK; support-hand separation can remain at steep aim
  angles. The real shot is never bent to hide an animation mismatch.
- Artillery articulation and mounted MG alignment are covered by renderer tests
  and the workshop. A complete player-built cannon firing/crew-relief battle and
  subjective player art review remain separate checks, not claimed here.
