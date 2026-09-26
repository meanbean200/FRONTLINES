# DEV + living home corrective evidence — September 26, 2026

Baseline `7179b8a667e34a1e997217af645722ae2a8e410e`. **PARTIAL; USER ACCEPTED
pending.** Earlier E/F mechanical checks did not establish usability acceptance;
the user rejected that editor. This directory preserves the new measurements and
failed attempts. Normal-control playthroughs below did not inject runtime states.

## Reproduced authoring failures and corrective checks

- `dev-idle-before.json`: 137 overlay mutations in five idle seconds.
  `dev-edit-baseline.json`: one ordinary edit created/disposed a production session.
  `dev-before.png` records the earlier editor. This reproduces the expensive work,
  not a claim that every machine's perceived lag has one cause.
- `dev-perf-timed-after.json`: 10/25/50/100 entities, created through formation,
  objective and trench tools. Five-second idle/pan/formation/node samples, real
  pointer drags with source unchanged until release. All idle samples: zero
  authored-DOM mutations. Every drag: zero scenario/session/terrain rebuilds,
  zero explicit preflight runs, one release-time document validation/undo commit.
- Each sample's p95 RAF interval was about **6.2 ms** on this desktop's 165-Hz
  browser run. This is editor scheduling evidence, not 512-person combat FPS or
  physical-phone acceptance. Mean dirty overlay work rose from 0.12–0.35 ms at
  ten entities to 0.36–0.53 ms at 100; document validation at release 0–0.3 ms.
  Explicit 100-entity geometry preflight took 3.4 ms. Browser timer resolution
  explains zero-duration readings; they do not mean literally free operations.
- `dev-title-perf-timed-after.json`: same idle/pan/two drags on the actual
  25-entity title preset, source exactly restored by Undo, no production rebuilds.
  Initial publication/Play counts are cumulative; compare before/after deltas.
- `dev-100-authoring.png`, `dev-responsive-after.json`, and
  `dev-responsive-390.png`: actual layout/control checks, scrollable contextual
  inspector, 44-pixel primary controls. The portrait check is browser emulation,
  not a physical touch device or a certified mobile-authoring workflow.
- `dev-failed-overlapping-selection.json`: the first gun drag selected its
  overlapping crew. The selected marker now takes precedence. `dev-invalid-post.png`
  and `dev-explicit-snap.json` show a genuinely off-floor post, named error,
  explicit Snap, and Undo. No silent placement repair.
- `dev-playtest-final.json`: real production Play/Reset/Stop, source equality,
  zero remaining session/planner after Stop, explicit invalid-post repair.
  `orchard-editor-review.json` is the control-authored Duplicate used by this QA,
  not a new default title or a campaign save. Play state never overwrote it.

## Authored people and menu

- `dev-intentions-browser.json`, `dev-three-intents-setup.png` and
  `dev-three-intents-play.png`: a tiny control-authored setup after 35.05 real
  simulation seconds. Advance was moving toward the objective; Guard had reached
  nearby cover and held; Remain still held its starting area with no commander
  movement plan. No enemies in this isolation fixture; separate title-play
  evidence exercises real contact, reactions and finite ammunition.
- Old attack/probe, defend/support, hold/reserve are compatible aliases, not six
  claimed behaviors. Six focused unit tests cover the author boundary, aggregate
  preflight, history immutability and production commander alias equivalence.
- `dev-live-behavior.json` records the earlier 84.35-second/323-shot production
  title playthrough with actual Guard reactions. `dev-title-final-live.png` shows
  the final lower/closer camera in production Play Test. Both factions continue
  using ordinary observation; no fake fire or artificial contacts were introduced.
- Camera iteration and final publication used Set opening view → Save → Load →
  Play Test → Stop → Use for title screen. Active snapshot:
  **`orchard-approach-8e4800f6033d`**. Only camera initial conditions changed; old
  `ed826cec964a` and intermediate `a52b355e404c` snapshots remain intact. No
  special camera override was added to player code. Subjective framing is pending.

## Viewport, isolation and failures

- **USER-REPORTED home fill failure: not reproduced in this pass; cause unknown.**
  Do not label it fixed. Existing automated success does not invalidate the
  user's screenshot. The opt-in diagnostic now records client/body/app/CSS canvas,
  backing buffer, renderer size, aspect, CSS game variables and computed constraints.
- `home-layout-and-transitions.json`: cold-refresh visible bounds at 1920×1080,
  1600×900, 1536×864, 1366×768, 1280×720, 844×390, 390×844; Settings/home and
  30 actual Sandbox/home transitions. Campaign storage unchanged; one active
  attract session/planner, 64 initial people, stable immediate GPU counts after
  each return. Ten natural attract resets and long-run GPU growth were not
  repeated here. This predates the final camera-only publication.
- `home-native-before.json`: native Edge resize/maximize/restore/refresh bounds.
  Its keyboard Ctrl-minus attempt did **not** change DPR and is not zoom evidence.
  The dedicated native harness subsequently used the owned disposable profile's
  test extension to set actual 80/125/150% browser zoom, checked DPR and refresh,
  and measured full visible coverage (production and offline).
- `native-capture-failed.json`: first screenshot helper grabbed a different
  foreground Edge window. Its bounds samples are useful, but its OS images are
  **not viewport evidence** and remain local rather than publishing unrelated tabs.
  `native-scale-failed.json`: Playwright CSS screenshot scaling double-scaled
  native 80% zoom (2619 image pixels versus 2095 CSS pixels). This was a test
  capture failure, not a demonstrated game fill failure. The repaired harness
  captures the exact owned page through Chromium, verifies image extent against
  DPR and visible bounds, and retains screenshots for inspection.
- `native-final.json`: all 42 production/offline native samples passed on the
  final camera package; measured app/canvas origins are (0,0), not just correct
  widths. `home-native-final-125.png` and `home-offline-final-fullscreen.png`
  are images of the tested tab, not unrelated foreground windows.
- `e2e-first-run.json`, `e2e-grouped-contact-failed.png`/`.md`: 26/27 maintained
  Edge checks passed; the grouped-contact **synthetic fixture** supplied commander
  contacts but omitted selected-squad delivered intelligence. Depending on whether
  pause preceded tick one, suppression was correctly disabled. The fixture now
  supplies both kinds of knowledge; production observation rules were not weakened.
  `e2e-final.json`: 27/27 passed after the fixture correction.
- `unit-first-run.json`: 888/890 tests passed during concurrent browser work.
  Two long existing tests exceeded their 40/45-second limits (46.8/50.1 seconds).
  Unchanged isolated rerun: 32/32 tests in those two files passed, including the
  supplied 72-hour loop soak and combat speed/save continuity. This limited soak
  does not clear the broader integrated combat/supply-interruption release gate.
- `unit-final.json`: the complete rerun passed **890/890 tests in 129 files**,
  without changing test timeouts or weakening simulation assertions.

See the ledger's frozen verification entry for final builds, package hash and
the final suite result. Offline normal/Endless reports distinguish exact paused
save continuation and explicit termination from merely seeing a launch screen.
No automation, training, platform publication, player-save overwrite, or Endless
rollback occurred. DEV remains generated-terrain authoring, not a terrain editor.
