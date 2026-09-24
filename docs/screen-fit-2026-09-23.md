# Responsive screen fit

September 23, 2026, direct-user request. Presentation-only repair; simulation rules remain `deterministic-15`, save version 2. Existing game saves were not replaced. No training, agents or automation restart.

## Reproduced

- At 1024 × 600, the force roster covered the selected-squad card.
- At 600 × 400 and 390 × 844, the trench-command panel intersected the objective HUD, and wrapped instructions intersected the order buttons.
- The layout mostly reacted to width, while fixed top/bottom offsets assumed a tall desktop window. Hidden secondary panels also made squad details/map inaccessible at some widths.
- The renderer used window dimensions rather than measuring its canvas; it now also responds to canvas and visual-viewport resizes.

Baseline screenshots and measured rectangles: `output/playwright/screen-fit-before-2026-09-23.json` and matching `screen-fit-before-WxH-2026-09-23.png` files.

## Changes

The game UI skill's low-chrome guidance informed compact drawers rather than shrinking the whole interface. On windows at or below 1150 CSS pixels wide **or** 720 pixels high, Force, Squad and Map become explicit, mutually exclusive drawers. Opening Trench Command closes them; its header remains a reachable close control. In very short windows an explicitly opened trench inspector may cover part of the objectives, leaving the top session controls and bottom orders accessible. Desktop side panels remain available in spacious windows.

`src/responsive.css` is the final responsive-layout layer. `HudLayout` measures actual objective, session-control, selection, order-bar and instruction sizes with `ResizeObserver`; it batches updates outside the simulation loop. Text wrapping changes reserved space instead of creating overlap. Long panels scroll internally, safe-area margins are respected, and mobile/short-height menus use simpler layouts. The default repeated control hint is omitted in compact play, but drawing/placement instructions remain visible; world labels are **not** hidden, faded or delayed.

The canvas fills the dynamic viewport. Rendering size and camera aspect use its measured rectangle, and quality-dependent pixel-ratio caps survive resizes. These changes do not rescale soldier coordinates or modify campaign state. Small-screen layout support does not add a new touch-command system; the game still primarily uses mouse/keyboard tactics controls.

## Verification

- **272 tests / 42 files pass**, 57.01 seconds. Five new assertions cover wrapped HUD spacing and repeated camera aspect/projection changes. Existing continuous-label, saved-state, input, construction and simulation tests remain green.
- **Production build passes**. Main `index-DNxtrZuF.js`, SHA-256 `b92483e96a62d0656bf6608b6bba4805d536570763810b71cbd4fcb48b5af0ab`; CSS `index-Dk12tFGv.css`. The existing large-chunk warning remains (740.76 kB main, 205.41 kB gzip).
- Headed Edge QA on separate origin 4174, actual buttons, resizing and screenshots. The user-facing 4173 browser/save was not automated. Browser console: **zero errors or warnings**.
- Viewport matrix: **1920×1080, 1440×960, 1366×768, 1151×721, 1150×721, 1280×600, 1024×600, 900×650, 800×600, 700×600, 601×600, 600×400, 844×390, 390×844, 320×568**. Collapsed HUD rectangles do not intersect or escape the viewport; there is no horizontal document overflow; the canvas matches every viewport. The two sides of the compact breakpoint are included.
- At 1024×600, 600×400 and 390×844, actual controls open Force, select engineers, inspect Squad, open/use Map, open Trench Command and reach ammunition construction. Opening a new drawer closes the previous one. Placement instructions/toasts fit above the order bar; Escape cancels placement without opening the menu. Help and menu content remain scrollable and accessible.
- The complete paused battlefield state is byte-identical before/after resize/control checks; the saved string is unchanged. No gameplay time advances during these paused checks. No combat/performance recertification is claimed from UI screenshots.

Final structured evidence: `output/playwright/screen-fit-after-final-r2-2026-09-23.json` and `screen-fit-controls-final-2026-09-23.json`. Final matrix screenshots include `index-DNxtrZuF` in their names; drawer/menu screenshots use `screen-fit-*-final-WxH-2026-09-23.png`. Earlier baseline/intermediate JSON and screenshots are retained. The short-height inspector was enlarged after screenshot review showed its sticky header leaving too little reading room; the final control pass verifies the larger sheet.

This checks effective CSS viewport sizes, including those encountered in split windows or enlarged browser UI. It is not certification of every physical phone, OS scaling mode, or touch interaction. User preference for panel density remains subjective.

23:06 UTC closeout: closed the owned `frontlines-screen-fit` QA browser and verified preview PID 18604 on 4174. User-facing 4173 still returns HTTP 200; its Edge session and saves remain untouched. Final bundle hash rechecked unchanged. The overnight heartbeat remains paused.
