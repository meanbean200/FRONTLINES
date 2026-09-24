# Visual rescue: baseline audit and implementation boundary

Baseline: current `master` plus the preceding uncommitted construction fixes.
Build `index-CWmZikXo.js`. No simulation/product changes before this audit.
All nine baseline screenshots were opened and visually reviewed, not only saved.
They are under `output/playwright/visual-before-*.png`; the frozen fixtures are
`output/visual-rescue/fixtures.json`. Fixtures use actual TypeScript simulation
and real mortar missions, but are explicitly controlled presentation scenes, not
claims of completed player matches. User saves are untouched.

## Ten largest problems, ranked by screenshot impact

1. **Uniform low-contrast illumination.** Everything shares a dull green-grey value
   range. The 660 m shadow projection loses infantry-scale grounding at close zoom.
2. **Ground has no convincing material response.** Smooth fields and excavated
   banks look airbrushed; trenches become black channels. Close roads expose a
   ruler-straight hard seam. Repeated field divisions dominate operational views.
3. **Box-bodied people and stick weapons.** Infantry screenshot shows rectangular
   torsos, static arms and block legs. Pose changes stretch the entire body instead
   of articulating joints. Helmets alone do not make the figures human.
4. **Solid egg-shaped tree crowns.** The previous pass removed polygon clusters,
   but contiguous smooth blobs now look like topiary. There are no branches,
   canopy gaps or distinct tree families. Identical detail persists at distance.
5. **Unfinished-looking trench reinforcement.** Individual floor rectangles and
   isolated posts resemble markers, not a continuous walkway and timber revetment.
   The actual earth cut must remain, with navigable floor and unblocked junctions.
6. **Village is a grid of flat-roof boxes.** Repeated silhouettes, featureless
   plaster and empty window holes. Architecture is constrained by shared collision
   volumes; no new visually solid roof/wall may silently misrepresent shot geometry.
7. **Mortar impact is a tiny cream ellipsoid.** There is no credible earthen burst,
   short-lived dust or debris. Rifle lines read as targeting lasers rather than
   brief fire/impact events. Unseen shooters must remain undisclosed.
8. **Truck is unmistakably a stack of boxes.** Square wheels, no hood, grille,
   wheel arches or useful cargo silhouette. It lacks a believable vehicle profile.
9. **Supply areas lack context.** Crates are uniform boxes; the environment lacks
   restrained fine detail. Any new detail must not imply unmodeled protection or
   inventory. This comes after the first five issues, not before them.
10. **Aftermath is visually weak.** Current HE missions can damage building presets,
    but do NOT create terrain craters. This render-only pass must not fabricate
    crater state, burned trees, hidden casualties or persistent gameplay smoke.

## Art and technical promise

Muted, weathered countryside; earth and foliage carry the scene, people read as
small human silhouettes, and actual fighting leaves only state-backed evidence.
Warm-grey sunlight, cool soft skylight, dirt/khaki/grey-green materials, restrained
distance haze. No bloom, black bars, blur, remote assets, or HUD redesign.

Follow the requested priority: lighting, terrain, soldiers, vegetation, trenches;
then integrate additional architecture/effects/logistics only after those work.
Procedural original geometry/materials remain local. Stable instancing, explicit
visual LOD, pooled effects, current quality presets, shared geometry and exact
simulation/save authority are mandatory. No dependencies or engine change.

## Verification plan

Keep matched screenshots and frozen before/after workloads: normal campaign,
300-person mixed combat/dense trench fixture, trench contact and village combat.
Use real Edge, CPU time, frame cadence, advancement, submitted triangles and draw
counts. Add visible instance/effect diagnostics without changing serialized state.
Inspect close poses, hidden-enemy filtering, floor contact, cutaways, quality
switching and WebGL resource lifetime. Run all Vitest tests and a production build.
Numerical results are separate from visual acceptance.

Baseline probe caveat: direct comparison with some pre-save fixtures reports
`stateUnchanged=false` because normal save parsing initializes/canonicalizes their
state. Later preservation checks must compare the snapshot immediately AFTER
restore, before the render-only interval. No fixture writes localStorage.

Preserved harness failures: first fixture generator did not resume paused input
fixtures; it was corrected before producing the frozen fixture file. First CLI
probe used unsupported dynamic import; corrected to the local Vite fixture URL.
An early stale Playwright element ref was refreshed; no product bug inferred.
