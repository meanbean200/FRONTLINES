# Direct-file launch repair — 2026-09-24

## Cause and delivery

Double-clicking the source `index.html` failed reproducibly in Edge: its module
URL resolved to `file:///C:/src/main.ts`, and the browser blocked the uncompiled
source import. The body was blank; neither worker started.

The repository now includes **FRONTLINES.html**, a generated, self-contained
offline release of the same game. Source `index.html` and `dist/index.html`
redirect disk launches to it. HTTP launches keep the normal split Vite build.
Build asset URLs are relative. There are no simulation/rules changes.

The offline build embeds CSS, the game and both terrain/navigation workers.
Vite bundles the workers as Blob workers; no local-file security flags, server,
network access, installed runtime or companion assets are required to play.
`npm run build` regenerates both delivery formats; `npm run standalone` updates
only the offline HTML. The generated file is tracked so a repository download
has a working disk entry without first building source.

Startup now shows progress and a visible failure/retry message instead of a
blank screen when the runtime fails. It is removed once the game initializes.

## Verification

- `npm run build`: passed. Existing large-game-chunk warning remains.
- `npm run test:packaging`: 5 passed, including script-closing-tag escaping,
  literal replacement tokens, and rejection of unbundled resource references.
- `npm test`: 453 passed across 64 files.
- `npm run test:e2e`: existing 16 Edge checks passed.
- Real Edge, **network disabled**: repository index → menu → Quick Battle →
  briefing → play → select Able → right-click movement. The navigation worker
  returned a route and the formation physically advanced; terrain detail jobs
  also completed. No page/console errors or HTTP requests.
- Paused offline save → refresh → Continue restored the exact full game state,
  excluding save-only policy metadata. Matching state hashes are in each run.
- Copied **only FRONTLINES.html** into a new otherwise empty directory: repeated
  the same offline play/save/load checks successfully.
- `dist/index.html` direct-file launch: passed, without a blocked module request.
- Refresh at 1280×720 and 1920×1080: menu and canvas filled the viewport without
  horizontal overflow. Separate native-sized Edge context (`viewport: null`):
  normal and cache-disabled reloads at two window sizes also fit, without a
  resize after reload.
- Production HTTP preview on 4175: menu and Sandbox playable, zero console
  errors; screenshot inspected. Player sessions were never attached/reloaded.

Final HTML: 1,107,771 bytes; SHA-256
`C73CABAEE52D706032BFDC47F3BADCD84C0CB98CCF60AA9802C925C2514B6FCF`.
Repeated builds produced the same bytes.

## Local evidence (ignored by Git)

- `output/playwright/before-file-launch-1790291415076/`: original blank screen
  and failed source URL.
- `output/playwright/offline-full-1790291591927/`: successful menu, briefing,
  gameplay screenshots and measured worker/movement/save/refresh results.
- `output/playwright/isolated-html-1790291635531/`: single-file copy and successful
  independent offline playthrough.
- `output/playwright/distribution-file-boot-2-1790291632588/`: production index
  direct-file launch.
- `output/playwright/native-file-refresh-1790291755626/`: native-sized reloads.
- `.playwright-cli/page-2026-09-24T23-16-29-709Z.png`: hosted Sandbox screenshot.

Failed intermediate checks remain preserved: first packaging attempt expanded
JavaScript dollar replacement tokens; the first distribution-entry attempt
requested an external module before redirecting. Both causes were fixed and
their corresponding checks rerun successfully.

## Save boundary and remaining limits

Browser saves are origin/location-specific. The offline file does **not**
silently import, overwrite or erase saves at `127.0.0.1:4173`/`:4175`. Return to
the original address/profile for those. Keep the offline file at the same path
and use the same browser to retain its save slot. Cross-origin save transfer is
not part of this repair. File-mode verification was in installed Edge; other
browsers and restricted corporate browser policies are not certified here.

This fixes launching, not outstanding combat balance, animation or gameplay
acceptance. No neural training, automation restart or platform submission.
