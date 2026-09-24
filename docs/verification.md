# Rebuild verification — 2026-09-22

Historical record of the first corrective rebuild. The later capacity/path/construction pass is documented in `orders-and-earthworks-verification.md`; the slot model described below has been superseded.

These checks cover the corrective rebuild, not full acceptance of every original milestone requirement.

## Automated checks

- `npm test`: 10 tests passing, including rendered-ground ray casting, deformation restoration, distinct occupancy reservations, engineer retasking, settlement routes, separate squad destinations, serialization validation, and rejection of stale asynchronous route results.
- `npm run build`: TypeScript and production Vite build passing. Move-order navigation is emitted as a separate worker bundle. Vite still reports a main-bundle size advisory.

## Browser checks

Tested locally in Chromium at 1440 × 900 against `http://127.0.0.1:4173`.

- Drew a curved trench through real pointer input with Engineer 1 selected. Construction advanced along the route and completed after the engineers approached the works.
- Ordered two rifle squads into the prepared trench: 20 occupants, 20 distinct slot reservations, all reporting trench cover and in-position actions.
- Used the actual Save and Load buttons. After creating another crater, loading restored the prior state exactly, including crater count and ground height.
- Downward ray casts hit the excavated terrain below its original grade; excavation is not only a visual overlay.
- Browser console after the final reload: zero errors and zero warnings.
- Inspected overview and close-range screenshots in `output/playwright/` (local, untracked evidence).

## Measured performance

300 soldiers, 24 squads moving; 900 animation-frame samples. The measured main-thread time to dispatch the group order decreased from approximately 318 ms with synchronous A* to 1.2 ms with worker routing. All 24 asynchronous routes resolved, with no squad left planning.

The worker run measured mean frame interval 6.08 ms, p95 6.2 ms, and maximum 12.2 ms over that sample. The in-app CPU measurements were approximately 2.51 ms per frame and 0.10 ms for simulation. These are local browser observations, not guaranteed performance on other machines or evidence for thousand-unit scale.

## Remaining scope

Visual terrain LOD exists, but distance-based simulation LOD and connected trench-network routing do not. Trees provide terrain cover/scenery rather than individual trunk navigation obstacles. Combat and vehicle systems remain deliberately absent. See the README for controls and architecture.
