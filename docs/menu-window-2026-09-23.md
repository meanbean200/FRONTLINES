# Native Edge sizing and menu repair

## Fixed

The user's screenshot showed gray browser space to the right/bottom and an off-center menu. The old `frontlines-combat-v3` Playwright session had been left with a fixed 1654×910 viewport. Maximizing the native Edge window did not resize that emulated area. This was a test-session handoff error, not evidence that the game needed a fixed full-screen CSS width.

A live attempt to clear the metrics override through another debugging connection did not release it. That failed check is retained in `output/playwright/edge-viewport-released.json`. The game state and origin storage were then captured in `edge-player-preserved.json`, copied into a new persistent Edge player session, and verified exactly in `edge-player-restored.json` before closing the old test session. No source save was deleted. The 4173 browser/storage was not changed.

The replacement `frontlines-player` session uses `scripts/edge-player.config.json` with `viewport: null`. It follows native window resizing and is left maximized at `http://127.0.0.1:4175/`. Its local profile lives in the ignored `output/playwright/edge-player-profile` directory. `run-browser-probe.mjs` rejects fixed-viewport probes in this player session; disposable QA sessions should be used for device emulation.

Menu CSS changes:

- The selected mode has a filled paper-colored background and an explicit **SELECTED** badge. Keyboard focus is a separate thin dashed indicator, so focusing another option does not imply that it has been selected.
- The decorative map takes 26% instead of 38% of the desktop menu. It folds away on narrow/short windows.
- Increased mode labels, descriptions, settings and secondary-action text. Small windows scroll the menu without horizontal overflow.
- Preserved every existing mode, description, action, save key and simulation rule. Changes to the game itself are CSS-only.

## Evidence

- `output/playwright/menu-native-r2.json`: all checks pass. Actual native window resize calls, **not device emulation**, cover maximized, 1280×850, 960×720, 650×620 and a requested 430×760 window. Edge clamps the last to its native minimum width; the report records actual dimensions, rather than claiming a 430-pixel content test.
- At handoff, browser content, app, canvas CSS extent and page scroll extent are **1912×901**, with no gray unused content area. The menu is centered at x=406, width=1100, height≈876.9. `output/playwright/menu-window-final.png` was visually reviewed.
- All four mode selections, description matching, single pressed state, selected badge, keyboard focus and Enter activation checked using actual UI controls. Paused game state and stored values remain identical through these checks; no page errors.
- The first native-run report is retained. Its only failed assertion incorrectly expected “15 minutes” in the defense description; the actual timer is on the mode card. The second run checks the correct existing description instead of altering game copy to satisfy the test.
- Final production build passes: `index-BrbMi7UE.js` / `index-hF_p8yph.css`, with the existing bundle-size warning. Full regression: **320/320 tests**, `output/menu-window-regression-r1.json`.

The game-ui-frontend skill guided hierarchy, readable text and differentiated interaction states. The game-playtest and Playwright skills guided native-window checks and screenshot review. Do not again hand the player a browser session with an emulated viewport pinned to a test size.
