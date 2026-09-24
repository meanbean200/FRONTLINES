# Camera label settling — 23 September 2026

## Requested fix

The user reported names/labels glitching as the view moves and suggested a short hiding delay. This change is presentation-only: no simulation rules, orders, logistics, saves or policy changes. Rules stay `deterministic-9`.

Two causes were found: world-label positioning was limited to the 30 Hz content refresh, while the camera renders each frame; and projection ran before the renderer refreshed the camera matrix after rotation. The rotation regression reproduced a label X coordinate of 457.261 before rendering versus 546.279 after matrix refresh, approximately **89 pixels** apart.

## Changes

- Refresh the camera world/inverse matrices after each camera update, before labels or picking use them.
- Separate lightweight per-frame label projection from the existing throttled content/network/minimap work.
- Hide squad, place, objective and trench-capacity labels immediately during camera movement. Hidden labels are also inert, so they cannot intercept clicks or keyboard focus.
- Wait **150 ms after camera damping settles**, then fade labels in over **120 ms**. This is not a promise of returning 150 ms after releasing a key: the camera can still be easing into position. Sub-pixel damping tails do not keep labels hidden forever.
- Leave the fixed HUD, roster, menus and minimap visible. Reduced-motion preferences remove the opacity animation.

The Three.js guidance kept this in the camera/presentation boundary. The playtest skill required actual controls and screenshot review, not only DOM assertions.

## Verification

- **178 tests / 28 files pass**, 17.96 seconds, two workers. Five new tests cover fresh camera projection, focus/zoom settling, initial delay, renewed movement and prolonged idle/movement. The camera tests failed before the fix; the projection assertion remains exact.
- Production build passes: `dist/assets/index-BsUCQVTw.js`, 689.72 kB / 188.16 kB gzip, SHA-256 `473ad406a2c7464b84623764632ece113d1c27691ec49118eb911cd3cd35c826`. Existing >500 kB advisory remains. This is not a new large-camp performance certification.
- Isolated headed Edge, production preview on 4174, 1440×900: real WASD pan, middle-drag rotation, Q rotation, wheel zoom, minimap click, roster double-click focus and a subsequent world-marker selection all work. Hidden labels are inert; the fixed HUD stays visible.
- Final foreground pan trace: **51/51 sampled frames hidden and inert**. The release trace first becomes visible at **668.3 ms**, including camera easing and the explicit 150 ms delay; it ends at full opacity. Readable squad/place/objective positions were inspected in screenshots.
- 1024×768 and reduced motion: labels remain visible and selectable after settling, with computed transition duration **0s**. Final ordinary-motion screenshot also inspected.
- Final console: **0 errors / 0 warnings**. The operation remains paused at 1.10 simulation seconds through camera-only checks. No Save action was used; the isolated profile's save remained absent, and real user saves were not accessed.

Final machine-readable artifact: `output/playwright/labels-camera-r2.json`. Reviewed screenshots: `labels-final-moving-r2.png`, `labels-final-settled-r2.png`, `labels-final-small-reduced-motion-r1.png`, `labels-final-squad-r2.png` in the same directory. The pre-change screenshot and all earlier attempts remain intact.

## Retained diagnostic limitations

The first browser probes ran with a throttled/occluded QA surface and sampled only about one frame per second. Their apparent long delay is not used as the final timing result; bringing the owned QA tab forward restored approximately 6.1 ms cadence. The first final-focus screenshot also caught an in-progress focus move because a wait checked the old visible state before the next frame. The corrected check explicitly waits for hidden, then visible; both artifacts remain and the earlier `checks.final` entry is not relabeled as successful. A guessed test-file path was corrected through file discovery.

Subjective timing remains adjustable after player feedback. Existing 1,000-soldier performance limits and browser-worker simulation timing are unchanged and outside this requested label fix.

Cleanup: closed only owned QA session `frontlines-labels` and verified preview PID 27652 on port 4174. Its deliberate stop ends the preview session with code 1. User Vite PID 35696 on port 4173 remains healthy (HTTP 200). No source changes followed the passing build; saves and prior evidence remain intact.
