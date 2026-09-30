# Direct trench-front controls — 2026-09-29

Scope: the player's inability to choose a **Front direction in trench management**.
Baseline `072bcab`; isolated QA saves only. No simulation rules or campaign saves
were modified outside the explicit test orders.

## Baseline and repair

The baseline accepted keyboard choices while paused and at 5x. Mouse attempts
against the native popup were inconsistent in the CLI Edge session; the exact
original-player failure is not causally proven. `before-popup.png` retains the
old popup, and `before-panel.png` the previous layout.

Source inspection did identify an independent definite defect: strict radians
comparison displayed an unmatched saved heading as South. The new readout handles
equivalent full turns, mixed fronts, and custom bearings without changing saves.

The command now exposes four direct North / East / South / West buttons with
current-facing text, pressed state and confirmation. It reuses the existing
garrison front command, not a new movement or targeting authority. Both the UI
and simulation change; this is not a cosmetic highlight.

## Verification

- `npx vitest run src/ui/FrontDirection.test.ts src/garrison/FrontContinuity.test.ts src/garrison/DefensivePositions.test.ts src/ui/TrenchReadout.test.ts --maxWorkers=1`
  — **16/16**, four files. Includes all cardinal headings, wrapped/custom/mixed
  readouts, physical guard repositioning, and direction persistence through duties
  and save/load.
- `npx playwright test tests/e2e/live-controls.spec.ts tests/e2e/command-surfaces.spec.ts --workers=1 --reporter=line`
  — **10/10**, 2.5 minutes, installed Edge. Direct clicks at pause/5x, keyboard,
  save/Continue, other positions unchanged, touch emulation, pinned controls,
  three panel sizes, town entry points, live readiness select and camera seam.
  Raw output: `output/playwright/front-control-e2e.log`.
- Independent production-preview clicks, not simulation setters: North at
  207.50 s / pi; East at 211.40 s / pi/2; South at 215.30 s / 0; West at 219.40 s /
  -pi/2. Current-facing text and pressed state matched each recorded value.
- `npm run build` and `npm run test:packaging` — PASS / **5/5**. Existing large
  bundle warning remains. Portable file SHA-256:
  `2bad4d37bab0b37c7e9495a235b67b014c69c69ca32a10bf4e374194d91e7efb`.
- `node scripts/qa-file-boot.mjs FRONTLINES.html front-direction-offline isolated`
  — PASS. One copied file, installed Edge, network disabled, no page errors.
  Actual movement, exact Save/Continue and six refresh sizes pass. The offline
  fixture checks packaging/continuation; front-specific acceptance is the Edge
  control suite and independent production-preview run above.

## Reviewed screenshots

- `after-desktop.png` — production build, West chosen at 5x, visible confirmation.
- `after-touch.png` — 390x844 Edge touch emulation, West applied with no squad
  movement order leakage. This is not physical-phone acceptance.
- `after-short.png` — production build, 844x390, scrolled direct controls with
  North chosen; pinned header/tabs/actions remain accessible.
- `before-popup.png`, `before-panel.png` — original control retained as evidence.

Remaining: the player's original-session confirmation and all unrelated PARTIAL
gameplay/release gates. No full 953-test suite rerun is claimed for this UI-only
repair; the focused and browser suites listed above were run on these changes.
