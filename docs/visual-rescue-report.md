# FRONTLINES visual rescue — first delivery

## Scope and verdict

This is a substantial **first presentation pass**, not the complete twelve-phase
art target and not a production-quality claim. The strongest visible changes are
human/equipment silhouettes, useful close shadows, non-solid foliage, material
variation, continuous trench timberwork, a recognizable cargo lorry, and
state-driven smoke/dust. The village still exposes prototype architecture.

The audit and all nine original screenshots preceded these render changes. See
[ranked audit](visual-rescue-audit.md). This pass started on `master` with the
previous construction-access fixes already uncommitted; those are preserved.
No new engine, dependencies, remote assets, downloaded models, combat rules,
save schema, inventory rules, AI changes or training. This pass issued no push,
publishing or automation commands. During verification the checkout advanced
externally to `40eb358` (including the earlier construction and visual work);
that commit was preserved. Final bound/lighting corrections, QA refinements and this
report remain local working-tree changes.
The existing construction changes are documented separately in
[construction verification](construction-visual-pass-2026-09-23.md).

## Implemented presentation

- **Lighting:** ACES output, warm sun/cool skylight, time-of-day exposure context,
  restrained distance haze, zoom-fitted texel-snapped shadows. No bloom, blur,
  black bars or expensive postprocessing. Readable night sky fill without changing
  spotting rules; switching shadows off invalidates cached receiver shaders.
- **Ground:** world-space grass/soil/forest-floor blending; cultivated parcel
  direction; bare mottling; actual excavation mask and slope separate damp floors
  from banks. Procedural close surface normal variation fades with distance.
  Road shoulders dither into the terrain and surfacing is lower; excavation still
  removes intersecting road quads.
- **Infantry:** tapered tunics, shaped heads/helmets, articulated arms, boots,
  webbing, pouches, field gear, shovels and distinguishable rifle/SMG/BAR/MG
  silhouettes. Walking, aiming, digging, eating, treating, lying and carrying
  states use existing actions. Faction clothing is subdued, not team-coloured.
  Near/far bodies stay instanced; operational zoom removes individual geometry.
  Floor contact still samples authoritative terrain/building floors.
- **Vegetation:** three original alpha-leaf variants, branched trunks, different
  crown arrangements and dual visual LOD with a short dither transition. Exact
  tree sites and the existing physical canopy layout remain unchanged. Both
  LODs and trunks clear/restore together with actual excavation.
- **Trenches:** thin continuous duckboard sequences, timber uprights/revetment,
  variable wood tones and open branch mouths. Reinforcement follows built spans;
  unbuilt spans retain the plotted plan. True terrain is still the trench.
- **Buildings:** weathered plaster, exposed masonry patches, timber grain and
  varied roof surfacing on the existing shared volumes. Existing doors, windows,
  damage presets, stairs and cutaway layer ownership are preserved.
- **Logistics:** instanced six-wheel period-style cargo lorry with hood, cab,
  sloped windshield, grille, fenders, running boards and open-ended canvas bed.
  Wheels rotate with actual travelled distance; stationary trucks retain their
  last render heading. Stock pile counts still come from inventory.
- **Effects:** bounded reusable billboard pool, brief event-based flash,
  thrown earth, fading impact dust and state-backed smoke fields. Bullet effects
  use actual obstruction points; muzzle flashes use `ShotEvent.from`, and short
  streaks lie on the resolved ray. Unseen shooters do not acquire visible origin
  flashes or full incoming rays. Dust is cosmetic, not concealment.
  Smoke/dust dim with daylight; only the brief explosive flash stays luminous.

All geometry and foliage texture pixels are original local procedural work.
There are no new third-party asset licences or remote runtime dependencies.

## Files and systems

New rendering modules under `src/render/`:

`EnvironmentLighting.ts`, `VisualQuality.ts`, `TerrainMaterials.ts`,
`ModelGeometry.ts`, `SoldierVisual.ts`, `Vegetation.ts`, `BuildingMaterials.ts`,
`VehicleVisual.ts`, `ParticlePool.ts`, `ImpactEffects.ts`, `VisualRescue.test.ts`.

Integrated through `FrontlinesApp.ts`, `vite-env.d.ts`, `GroundGeometry.ts`,
`TerrainRenderer.ts`, `Scenery.ts`, `TrenchRenderer.ts`, `UnitRenderer.ts`,
`LivingRenderer.ts`, `OperationRenderer.ts`, and `ContextRecovery.ts`.
Graphics context recovery now also releases alpha-tested shadow materials.

QA: `scripts/visual-rescue-fixtures.ts`, `qa-visual-rescue.cjs`,
`qa-visual-performance.cjs`, `qa-visual-actions.cjs`, `qa-visual-impact.cjs`.
`qa-build-workflow.cjs` and `qa-build-progress.cjs` now accept unique screenshot
suffixes. The developer diagnostics report triangles, particles, submitted
soldiers, resident trees, and trees intersecting the camera frustum (not an
occlusion-query count). They do not enter campaign saves.

## Quality presets

| Setting | Performance | Balanced | High |
|---|---:|---:|---:|
| Device pixel ratio cap | 1 | 1.25 | 1.65 |
| Shadow texture | Off | 2048 | 3072 |
| Shadow refresh interval | — | 70 ms | 40 ms |
| Detailed foliage range | 300 m | 600 m | 950 m |
| Detailed soldier range | 95 m | 180 m | 280 m |
| Particle capacity | 160 | 480 | 900 |
| Fine ground detail multiplier | 0.45 | 1 | 1.3 |

Pixel ratio is capped by actual device DPR; High does not force supersampling
on a DPR-1 screen. No preset changes simulation tick size, population, needs,
contacts or orders. Foliage range accounts for camera altitude as well as chunk
distance. Operational soldiers and distant trench timber are not drawn.

## Matched performance

Headed Microsoft Edge, 1600×900, same frozen TypeScript states and camera targets.
Eight wall seconds at each requested speed, following 1.6 seconds settling.
Before/after share the exact fixtures in `output/visual-rescue/fixtures.json`.
GL submitted triangle counts below include shadow passes; CPU figures use the
engine's rolling frame samples and are **not** GPU timings. These are short
single-run comparisons, not a long-session/frame-spike guarantee.

| Workload / requested speed | CPU ms before → after | Mean interval ms before → after | p95 ms before → after | Draw calls before → after | Submitted triangles before → after |
|---|---:|---:|---:|---:|---:|
| Campaign 96 / 1× | 1.46 → 1.99 | 6.10 → 6.11 | 6.20 → 6.20 | 68 → 103 | 1,456,583 → 843,382 |
| Campaign 96 / 5× | 1.81 → 2.35 | 6.11 → 6.11 | 6.20 → 6.20 | 69 → 104 | 1,457,353 → 843,883 |
| Mixed 300 / 1× | 2.03 → 2.72 | 6.08 → 6.09 | 6.20 → 6.20 | 63 → 99 | 1,219,540 → 934,944 |
| Mixed 300 / 5× | 3.46 → 4.46 | 6.09 → 6.26 | 6.20 → 6.20 | 63 → 99 | 1,221,953 → 939,754 |
| Trench contact / 1× | 1.53 → 1.99 | 6.09 → 6.09 | 6.20 → 6.20 | 66 → 97 | 1,434,853 → 839,889 |
| Trench contact / 5× | 2.04 → 2.54 | 6.08 → 6.08 | 6.20 → 6.20 | 66 → 99 | 1,435,384 → 842,462 |
| Village / 1× | 1.58 → 2.03 | 6.10 → 6.10 | 6.20 → 6.20 | 92 → 125 | 1,127,505 → 822,993 |
| Village / requested 5×* | 1.51 → 2.11 | 6.10 → 6.11 | 6.20 → 6.20 | 92 → 125 | 1,128,165 → 823,016 |
| Occupied trenches / 1× | 1.34 → 1.80 | 6.08 → 6.08 | 6.20 → 6.20 | 52 → 79 | 1,313,812 → 793,601 |
| Occupied trenches / 5× | 1.63 → 2.11 | 6.08 → 6.08 | 6.20 → 6.20 | 53 → 80 | 1,313,862 → 793,674 |

*Village first contact intentionally returns the game to 1× in BOTH versions:
8.05 simulated seconds in about 8 wall seconds. The naive requested-5×
advancement assertion is therefore false in both preserved reports. This is
not evidence that village combat sustained 5×. All other 5× samples advance
40–40.05 simulation seconds; all 1× samples advance 8 seconds.

Balanced adds CPU work and draw calls, while foliage replacement reduces
submitted triangles. The measured 300-person 5× CPU increase is about 1.00 ms.
No 1,000-person benchmark was run in this pass; no target claim is made.
Individual vegetation/particle counters were added after the baseline, so
before values are recorded as unavailable, not invented zeros.

Current end-of-sample counters (1× / 5×):

| Workload | Active people | Submitted soldier models | Particle instances | Trees in camera frustum |
|---|---:|---:|---:|---:|
| Campaign | 96 / 96 | 48 / 48 | 0 / 0 | 556 / 556 |
| Mixed | 300 / 300 | 154 / 156 | 24 / 15 | 303 / 303 |
| Contact | 96 / 96 | 50 / 49 | 6 / 15 | 114 / 114 |
| Village | 95 / 95 | 56 / 56 | 3 / 3 | 124 / 124 |
| Trenches | 96 / 96 | 48 / 48 | 0 / 0 | 49 / 49 |

Hidden enemy people are simulated but not drawn. These are 300-person simulation
workloads, not 300 simultaneously visible models. The separate mortar sequence
records 40 burst/debris particles, 20 dust particles later, then zero after
settling. The actual smoke throw uses 14 puffs.

Fresh-page preset probes, same 300-person fixture / 1600×900 / DPR 1:

| Preset / speed | Mean interval | p95 | CPU | Draw calls | Submitted triangles | Simulation seconds / ~8 wall seconds |
|---|---:|---:|---:|---:|---:|---:|
| Performance 1× | 6.56 ms | 6.20 ms | 3.15 ms | 93 | 778,712 | 7.65 |
| Performance 5× | 6.27 ms | 6.20 ms | 4.43 ms | 96 | 799,114 | 40.05 |
| High 1× | 6.54 ms | 6.20 ms | 3.37 ms | 100 | 1,007,343 | 7.65 |
| High 5× | 6.23 ms | 6.20 ms | 4.42 ms | 102 | 1,037,042 | 40.00 |

The fresh 1× probes include startup/streaming hitches: **p95 hides a few long
frames**, and 0.35 simulation seconds are lost in these first windows.
Their 90% advancement threshold passes, but this is not exact real-time
continuation or evidence that Performance is slower than High. Profile startup
compilation and warm representative effects before judging steady preset cost.
The earlier `visual-after-*` and `visual-release-*` candidate/preset runs are
retained separately; all rows above use the `visual-verified-*` final build,
including canopy/smoke bounds, quality-switch and night-lighting corrections.

## Evidence and verification

`npm test`: **55 files / 339 tests passed**, including the existing 72-campaign-hour
living-trench soak and exact continuation tests. `npm run build`: passed,
`index-Db_FTaE6.js`, 871.17 kB / 248.24 kB gzip. Vite still warns about a chunk
over 500 kB; bundle splitting/loading remains a release task. `git diff --check`
passes. Existing assertions were not deleted or weakened.

- Nine matched final captures: `output/playwright/visual-verified-{strategic,
  medium,infantry,trench,village,battle,logistics,impact,aftermath}.png`.
  Baselines use the same names with `visual-before-`.
- `visual-verified-audit.json`: no browser/console errors, all paused states
  unchanged after rendering, isolated browser saves untouched.
- `visual-verified-controls.json`: a fresh campaign was started through menus;
  roster selected, smoke ordered through Support & rescue, actual inventory
  consumed exactly one grenade by normal simulation, and the cloud appeared at 1×. Menu quality
  changes left paused state identical. Canvas matched 1920×1080, 2560×1440,
  and 1000×600 viewports. A separate controlled 22:00 snapshot checked night
  readability and non-luminous smoke; this is not a full night playthrough.
- `visual-impact-final.json`: a frozen **real** TypeScript mortar impact then
  followed using actual 1×/pause controls. `visual-impact-{burst,dust,settled}.png`
  show transient aftermath without inserting crater state.
- Matched performance reports: `visual-{before,verified}-{medium,stress300,battle,
  village,trench}-perf.json`.
- `visual-build-final.json` / `visual-build-progress-{200,300}.json`: normal Build
  controls queue a material-paid meal bay, reject an undersized trench, accept
  a valid one and reassign engineers. Three 20-wall-second periods at 5× complete
  the connector and meal bay, with actual inventory conservation throughout.
- New regression contracts cover metre-scaled finite geometry, body LOD cost,
  both canopy LODs clearing/restoring, fixed particle buffers/capacity, paused
  effect aging, restore invalidation, no remote hidden blasts/enemy bodies,
  exact muzzle-flash origins, night particle lighting, cached shadow-program
  invalidation, and context recovery of alpha shadow materials.

Screenshots were opened and visually inspected, not just written. Real-control
smoke/quality checks are distinct from the nine **controlled visual fixtures**;
neither is presented as a completed campaign playthrough.

### Screenshot pairs

| View | Baseline | Current |
|---|---|---|
| Strategic | [Before](../output/playwright/visual-before-strategic.png) | [After](../output/playwright/visual-verified-strategic.png) |
| Medium | [Before](../output/playwright/visual-before-medium.png) | [After](../output/playwright/visual-verified-medium.png) |
| Infantry | [Before](../output/playwright/visual-before-infantry.png) | [After](../output/playwright/visual-verified-infantry.png) |
| Trench | [Before](../output/playwright/visual-before-trench.png) | [After](../output/playwright/visual-verified-trench.png) |
| Village | [Before](../output/playwright/visual-before-village.png) | [After](../output/playwright/visual-verified-village.png) |
| Battle | [Before](../output/playwright/visual-before-battle.png) | [After](../output/playwright/visual-verified-battle.png) |
| Truck | [Before](../output/playwright/visual-before-logistics.png) | [After](../output/playwright/visual-verified-logistics.png) |
| Mortar instant | [Before](../output/playwright/visual-before-impact.png) | [After](../output/playwright/visual-verified-impact.png) |
| Aftermath | [Before](../output/playwright/visual-before-aftermath.png) | [After](../output/playwright/visual-verified-aftermath.png) |

Also inspect [smoke ordered through the UI](../output/playwright/visual-verified-controls-smoke.png),
[controlled night view](../output/playwright/visual-verified-controls-night.png),
[impact dust](../output/playwright/visual-impact-dust.png),
and [completed construction](../output/playwright/build-progress-visual-rescue-300.png).

## Retained failures and corrections

- First render candidate had a terrain GLSL reserved identifier (`patch`) and
  reversed helmet winding. R1 screenshots/console report are preserved; fixed
  before later captures. Foliage normals and leaf scale were refined after R2.
- One early final candidate capture was a cold-start gray frame despite no
  console error. `visual-after-strategic.png` remains as failed visual evidence.
  The capture harness now waits for real world draw calls; the corrected
  `visual-final-strategic.png` was reviewed. Cold compilation hitch risk remains.
- New wheel-bounds test caught tread blocks extending below the intended wheel
  diameter. Geometry was corrected; the assertion was not weakened.
- Final geometry review clamped both canopy LODs inside their physical unit
  ellipsoid and tightened smoke puff placement inside its existing radius.
  This avoids suggesting extra concealment. It did not change simulation rules.
- Final image review caught a large stale shadow after switching Balanced to
  Performance, despite the state-preservation test passing. Three's cached lit
  materials still sampled a released map. Disabling the light's shadow and
  invalidating receiver programs fixes it; the corrected actual-menu screenshot
  is `visual-verified-controls-low.png`. The failed `visual-release-controls-low.png`
  remains. Complementary near/far foliage dithering also avoids discarding both
  LODs at the same pixel during the transition.
- The first controlled night image had nearly black terrain and self-lit smoke.
  Moon/sky fill is now more readable; smoke/dust use ambient attenuation while
  short flashes remain luminous. The earlier night screenshot remains for comparison.
- Earlier fixture/probe setup failures are preserved and described in the audit.
- A construction progression probe reused `build-progress-100.png`, overwriting
  the prior intermediate 100-second image before the omission was caught. Its
  replacement is copied to `build-progress-visual-rescue-100.png`; the old JSON
  report and 200/300-second screenshots survive, but the original 100-second
  image was not recovered. Both construction probes now use unique suffixes.
  This is an evidence loss, not a save or gameplay-state loss.

## Still prototype / next milestone

1. **Buildings remain flat-roofed boxes.** Surface treatment does not satisfy the
   requested pitched-roof farmhouse/barn/workshop architecture. Existing shared
   roof volumes are flat; silently adding pitched solid roofs would lie about
   bullet protection and cutaways. Next milestone should explicitly approve a
   narrow shared building-geometry upgrade, then make both render and queries
   consume it. No renderer-only fake solid architecture was added here.
2. Foliage is much less solid than the baseline blobs, but still reveals cards
   and regular crown arrangements close up. Fine leaves/LOD transitions can
   shimmer. Trunks need better bark and silhouette diversity.
3. Infantry is still procedural, with limited joint animation rather than a
   rigged human library. Kneeling, casualty carrying and feet across steep banks
   need further close-camera art review. No claim of full animation acceptance.
4. Field grids, river banks and road intersections still reveal procedural
   repetition. The river ribbon edge is particularly crude at strategic scale.
5. Supply crates, dugout fixtures and settlement surroundings remain sparse.
   No unrelated fake cover walls, hedges, sandbags or inventory props were added.
6. Mortar effects are now short soil/dust bursts, but not yet the exceptional
   artillery signature requested. The current simulation does **not** create
   mortar craters, persistent burn scars or damaged trees. No fake persistent
   devastation was substituted. Only actual terrain edits/building presets,
   casualties and extant smoke survive as aftermath.
7. Cold shader compilation, long-session resource growth, 1,000-person stress,
   and full playthrough performance at 2560×1440 remain unmeasured release risks.

The art-direction, Three.js-runtime and browser-playtest skills guided original
local assets, separated render authority, bounded instancing/LOD, and mandatory
image review. User judgment of visual quality remains the acceptance step.
