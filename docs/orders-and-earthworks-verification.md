# Orders and earthworks verification — 2026-09-22

## Results

- `npm test`: 18 passing tests across simulation, orders/construction, terrain geometry and road cuts.
- `npm run build`: passes. Navigation and terrain meshing produce separate worker bundles. The main bundle still triggers Vite's 500 kB advisory; no claim that download size is optimized.
- Browser: local Chromium, 1440 × 900. Final console check: zero errors or warnings.

## Reproduced failures and changes

- Complex digging rebuilt terrain on the UI thread. An eight-second CPU capture showed terrain sampling/meshing dominating active main-thread work, plus repeated layout reads. Terrain meshing now uses transferable worker buffers, local chunk invalidation and coalesced visual updates. Projection uses cached viewport dimensions, markers update at 30 Hz, and balanced shadows refresh at 10 Hz.
- Another trench drawing replaced an engineer's job. Jobs now queue; engineers follow the working face and start the continuation. Hold/movement pauses works; Resume starts at the existing working face. Validation samples entire segments and their smoothed result, not only control points.
- Fixed trench slots have been replaced by capacity of one person per 2.5 usable metres, excluding entrance and end clearance. Reservations are checked before assignment. Personnel spread continuously along the occupied line, and cover is sampled from their physical position. Individual slot markers are gone.
- Right-drag or M/left-drag stores the drawn corridor, preserving meaningful bends. Shift appends; Escape cancels; Hold cancels the order. Squads use separate stopping offsets. Selection tests soldier silhouettes as well as squad centers. Flags no longer swallow drawing gestures.
- Road surfacing is removed across excavations, with restoration after loading a state without the cut. Trees standing inside excavation are visually cleared without recreating the whole forest.

## Browser scenarios

1. Used real mouse input to draw a complex, 64-input-point route: approximately 807 m after picking/smoothing. Drew a 178 m continuation on the same engineer. Confirmed the first job stayed active, the second queued, and both reached exactly 100%/complete. Re-loaded a mid-build save during the run; the queue and working progress survived.
2. Drew a right-button movement corridor. Inspected the saved route and its bends. Exercised M, Escape, a closed loop starting over a squad flag, and Shift-appending; cancellation did not issue an order. The active route is visible over the battlefield.
3. Selected two rifle squads using roster click/Shift-click and clicked the prepared trench's capacity label. All 20 reached in-position actions and physical trench cover, with zero legacy slot assignments. The HUD displayed 20/58 capacity.
4. Used actual Save/Load buttons while paused with a drawn movement order. Created an extra crater, then loaded. The restored serialized battlefield exactly matched the saved snapshot.
5. Used H and R on an active engineer: progress stayed unchanged while held and the construction order resumed. Switched Performance/Balanced rendering through the actual selector.

Screenshots were inspected in `output/playwright/`: `complex-route-preview.png`, `precise-path-orders.png`, and `continuous-trench-capacity.png`. These are local, ignored artifacts.

## Performance observations

Same initial complex digging scenario at 5x simulation speed:

| Measurement | Before | After |
| --- | ---: | ---: |
| Frame rate | ~37 FPS | ~165 FPS |
| p95 frame interval | 73 ms | 6.2 ms |
| CPU frame time | 24.6 ms | 0.82 ms |

Subsequent heavier sample: 300 soldiers, 24 squads following drawn routes, two active complex digs, 1,200 animation frames. Group-order dispatch took 2.5 ms; all route approaches resolved. Mean interval 6.09 ms, p95 6.2 ms, worst frame 36.5 ms; measured CPU frame cost about 1.57 ms. This is a local browser measurement, not a guarantee on other hardware, at other resolutions, or for thousand-unit battles. Occasional hitches remain possible.

## Limits and next work

Capacity is currently per drawn trench line. Intersecting/overlapping lines are not a connected graph and do not deduplicate shared length. Crowd arbitration across intersecting movement corridors and simulation LOD remain future work. Supplies, supply chains, meals, sleep/watch shifts and machine guns were intentionally not implemented. See `next-systems.md` for those boundaries.
