# Continuous label tracking — 23 September 2026

## Corrected intent

The user explicitly clarified: names and labels must remain visible while the camera moves; the earlier hide-and-fade interpretation was wrong. This supersedes the behavior in `camera-labels-bugpass-2026-09-23.md`, whose evidence remains historical.

Removed the camera-motion visibility debounce, its inert state, the 150 ms return delay and opacity fade. Kept the actual alignment fixes: current camera matrices and independent per-render-frame projection. Label text/network/minimap work stays throttled; screen positions do not. Initial marker content is now created on the first frame, before positioning, instead of waiting for the first 30 Hz content tick. Normal off-screen, zoom-level and enemy-spotting visibility rules remain unchanged.

The obsolete `WorldLabelVisibility` helper and its hide/delay tests were removed. Three replacement tests exercise actual overlay update/projection behavior; the camera regression now checks all 100 intermediate focus/zoom frames at 144 Hz. The read-only `projectWorld` diagnostic accepts an optional height to measure the same anchors used by labels. No simulation, save, inventory or AI changes; rules remain `deterministic-12`.

Three.js guidance preserved the single camera/render frame boundary. Game-playtest and Playwright guidance drove ordinary-control browser checks and mandatory screenshot review.

## Verification

- **226 tests / 33 files pass**, 26.04 seconds with two workers. This replaces three obsolete hiding tests with three continuous-label tests; the count is intentionally unchanged.
- Production build passes. `index-C207BX6I.js`, 714.05 kB / 196.95 kB gzip; SHA-256 `5ed0ad0e4e0eac5908b73568f6d3cd33911eca8a7e689ba072ff152d30d4ecde`. CSS `index-BO5w4NBj.css`. Existing >500 kB advisory remains.
- Isolated headed Edge session `frontlines-label-tracking`, production 4174. Began a real offensive via menu, then paused at 10.50 simulation seconds. No fixture or state mutation used. No Save action or user-tab interaction.
- Actual controls: WASD pan, middle-drag rotation, wheel zoom, Q rotation, roster double-click focus and 1024 × 768 reduced-motion pan.
- **600/600 sampled frames keep the label layer visible and interactive** across six approximately 600 ms traces. 4,124 visible squad/objective/place/trench anchor checks match the current camera projection within **0.000067 CSS pixels**. Labels move hundreds of pixels in the pan/focus traces, so this is not a stationary-camera check. Ordinary off-screen and zoom culling are not counted as failures.
- A separate mouse click changes selection from Able to Baker while the pan key is still held: no inert overlay or delayed return. Camera-only tests preserve the entire paused simulation state and the absent isolated save.
- Three representative screenshots were opened and inspected: panning with labels visible, focused troops, and the smaller reduced-motion view. Browser console: zero errors/warnings.

Artifacts: `output/playwright/continuous-labels-r1.json`, `continuous-labels-selection-r1.json`; screenshots `continuous-labels-pan-r1.png`, `continuous-labels-focused-r1.png`, `continuous-labels-small-r1.png`, `continuous-labels-selection-r1.png`. Sources: `scripts/qa-continuous-labels.cjs` and `scripts/qa-label-selection.cjs`.

## Limits and retained failures

A stale CLI reference (`e32` instead of the post-reload `f1e32`) was rejected before the operation began; a fresh snapshot resolved it. No game error resulted. Earlier build `index-DHVqE69m.js` preceded the optional diagnostic height parameter; final browser traces identify `index-C207BX6I.js`.

These checks establish current-frame DOM/camera alignment and continuous visibility on this PC, not a promise of zero display latency or a new large-camp performance certification. Existing simulation performance limits remain. The player's judgment of smoothness remains separate.

Subsequent heartbeat work remains scoped to bugs/playthroughs, with the original 21:45 UTC stop boundary. Do not reintroduce movement-triggered label hiding.

21:02 UTC cleanup: closed only the owned QA browser and verified preview PID 4860 on 4174. User server 4173 remains healthy (HTTP 200). Final bundle hash rechecked, console still has zero errors/warnings, saves and historical evidence preserved.
