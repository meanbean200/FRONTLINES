# Focused support/reserve bug fixes

Date: 2026-09-24. Branch: `master`.

## HEAD

- Starting commit: `7277ce5f18b1924904d4590f7d1115e5e7572602` (verified clean). The handoff's `36b903d` was no longer HEAD.
- Ending implementation commit: `7ced63858492c47052ec0a0408efeedccd173c6f`. This report is delivered in a subsequent documentation-only commit.
- Implementation commits: `5676b75` (readiness), `7128f23` (reserve capacity), `7ced638` (audit ownership).
- All three reported bugs were still present; none was already resolved. Combat rules remain `combat-26-autonomy-world2`, save schema remains 3. No combat balance, Operations V2 behavior, infantry autonomy, UI layout, or new systems were changed.

## Bug 1: mortar readiness

**Reproduction:** deterministic Meeting Engagement, seed 1944; a holding, mortar-equipped formation with ammunition and enough crew placed beneath an actual generated intact roof through the validated test restore API. The old UI enabled HE/smoke and reported available crew, although command validation rejected the roof. The new E2E failed on that enabled button before the fix.

**Root cause:** support-team selection, button readiness, status, and compact selection readout omitted the real terrain context.

**Fix:** `FrontlinesApp` supplies its existing terrain instance to `BattlefieldUI`. Every affected UI query calls the existing terrain-aware `selectedSupportTeam` / `supportReadiness`; no duplicate roof, ammunition, crew, movement, or range rules. The simulation updates this same terrain object when replacing worlds, so the reference remains current after restore. Range, friendly danger, and report restrictions remain target-time checks.

**Coverage:** `src/ui/SupportReadiness.test.ts` checks both mortar types, read-only presentation, outside readiness, short-range rejection, and a valid mission. `tests/e2e/gameplay-controls.spec.ts` checks both disabled controls, the roof explanation in both readouts, unchanged selection mode, then enabled outdoor controls and an accepted PLAYER mission issued with a real canvas click.

## Bug 2: configured reserve capacity

**Reproduction:** Quick Battle > Open Front > advanced reserves 0 or 24. Before the fix, the new browser tests observed `Reserve 0/48` and `Reserve 24/48` and failed.

**Root cause:** HUD denominator was literal 48, independently of the configured initial pool.

**Fix:** option B: `initialReserveCapacity(state)` derives capacity from `operation.setup.advanced.reserves`. Initialization, conservation validation, and HUD now use that same helper. Capacity is not derived from remaining reserves. Setup validation already enforces the allowed configurations.

**Save/legacy:** configured setup persists through existing save/load. Legacy campaigns and direct operational-factory states can lack setup; these historically initialized 48, so the helper explicitly falls back to 48. Tests exercise both missing-setup forms, including a depleted legacy pool. No new serialized field, migration, refill, or unrelated regeneration was introduced.

**Coverage:** five `src/operations/ReserveCapacity.test.ts` cases cover 0/24/48, actual replacement release, save/load, and both legacy forms. Three browser tests in `tests/e2e/support-reserves.spec.ts` use the actual setup menu and verify `0/0`, `24/24`, and `48/48`. The 24 case releases eight replacements through `stepReplacements`, verifies `16/24`, then uses menu Save, reload, Continue, and verifies `16/24` again.

## Bug 3: truthful audit ownership

**Reproduction:** `requestSupport` with a nonexistent squad rejected the command but mutated audit history with invented PLAYER ownership. Current-rules saves also accepted nonexistent requester IDs, wrong sides, and incompatible normal sources. Before implementation, the 17-case audit probe had 12 failures and five passes, including the adjacent mission checks below.

**Fix:** option A: resolve the requester; missing or unauthorized callers return the existing rejection without appending a game audit event. Legitimate rejected commands from real authorities still log identity, side, source, and the original reason, bounded to 64 rows. A rejected authority-spoofing call cannot poison a later save.

**Validation:** each serialized request must reference a real squad, match its faction, and use compatible authority: PLAYER for friendly squads; ENEMY_AI or CAMPAIGN_AI for enemy squads. The existing missing-faction default applies only to an actual squad, never to an unresolved ID.

**Compatibility:** explicitly stored SCRIPTED_SCENARIO and LEGACY_UNKNOWN provenance remains accepted on either side, but still requires a real, matching owner. This exception is isolated to persistence and does not authorize new commands. The existing old-mission migration still fills missing provenance with LEGACY_UNKNOWN and derives the real owner's side; its old-save/re-save path is tested. Malformed normal ownership records are rejected, not silently rewritten.

**Coverage:** 19 `src/combat/SupportAudit.test.ts` cases cover missing IDs with no mutation, valid no-ammunition diagnostics, both enemy authorities, malformed saves, unauthorized live requests, bounded history, legacy faction/provenance, mission mismatches, and old mission migration.

## Additional search

Two additional confirmed, directly adjacent bugs were fixed with regressions:

1. **Stale paused support status:** with a moving mortar selected and simulation paused, pressing H enabled the button but left “Team moving” in the status. The status cache ignored readiness changes while elapsed time stayed constant. Adding selected mortar identity and readiness reason to its key fixes this; the E2E failed before and passes after, without unpausing.
2. **Saved mission ownership:** support missions, like requests, allowed side/source mismatches. The same small ownership check now rejects those missions while preserving explicitly legacy provenance and missing old mission fields. Two mutation tests failed before and pass after.

No further reproducible bugs were found in the touched systems. The handoff's excluded combat, building, placement, commander, and infantry-loadout implementation files were left unchanged.

## Verification

All commands ran locally, using disposable Edge contexts; existing player saves/profiles were not modified.

| Command | Result |
| --- | --- |
| Baseline `npm test` | 453/453 tests, 64 files; zero failures |
| Baseline `npm run build` | Passed hosted and standalone builds |
| Baseline `npm run test:e2e` | 16/16 Edge tests; zero failures |
| Final `npm test -- --reporter=default --reporter=json --outputFile=output/playwright/focused-support-reserves/final-unit.json` | 478/478 tests, 67 files; zero failures, 67.57 s |
| Final `npm run build` | TypeScript, hosted production build, standalone build passed |
| `npm run test:e2e -- --output=output/playwright/focused-support-reserves/final-e2e` | 21/21 Edge tests; zero failures, 43.8 s |
| Final repeat `npm run test:e2e -- --output=output/playwright/focused-support-reserves/final-e2e-settled` | 21/21 Edge tests after adding screenshot camera-settle polling; zero failures, 44.3 s |
| `npx playwright test --config=output/playwright/focused-support-reserves/production.config.ts -g "mortar buttons\|paused Hold\|configured .*reserve"` | 5/5 against production preview `127.0.0.1:4175`; zero failures, 21.3 s |
| `npx playwright test --config=output/playwright/focused-support-reserves/production.config.ts -g "configured 24-person reserve" --output=output/playwright/focused-support-reserves/production-settled-view` | 1/1; settled restored battlefield and `16/24` screenshot inspected; zero failures, 9.2 s |
| `npm run test:packaging` | 5/5 packaging tests; zero failures |
| `node scripts/qa-file-boot.mjs FRONTLINES.html focused-bugfix-offline isolated` | Passed: copied HTML alone, network disabled, two embedded workers, troop movement, identical saved continuation, refresh sizing at 1280×720 and 1920×1080; no browser errors |

Browser checks cover outdoor HE/smoke readiness and actual accepted HE mission; unavailable roofed HE/smoke; paused Hold refresh; all three reserve capacities; depleted 24-person pool saved/reloaded. Screenshots were inspected. The playtest workflow added player-facing verification, not a presentation redesign.

The roof fixture restores real crew positions against real generated geometry rather than walking through a building. Reserve depletion uses eight synthetic casualties and an advanced campaign clock followed by the actual replacement function, not a natural 24-hour playthrough. Those are test setup boundaries, not claims of navigation or long-campaign acceptance.

**Warnings:** Vite retains the existing >500 kB chunk warning (main JS 947.65 kB, gzip 273.91 kB). Playwright emits the existing NO_COLOR/FORCE_COLOR environment warning. Git also reports the repository's LF-to-CRLF normalization warning for source files. None was suppressed; no bundle-splitting or line-ending refactor was added.

**Evidence retained locally:** `output/playwright/focused-support-reserves/` contains failed `before-bug1/`, `before-bug2/`, `before-bug3.json`, corrected focused runs, final unit JSON, full E2E artifacts, and production screenshots. Initial test-authoring issues (an unequipped legacy fixture, an off-screen click target, and a target overlapping friendly danger) were corrected before using the probes as regressions. Early reload screenshots caught the unsettled camera; the final reserve test polls camera convergence before capturing. Those earlier captures are retained, not overwritten. Standalone launch evidence is in `output/playwright/focused-bugfix-offline-1790292601128/`.

## Remaining issues

No confirmed unresolved support-readiness, reserve-display, or audit-ownership bugs from this pass. The pre-existing build-size warning remains; broader gameplay and subjective visual acceptance were outside this surgical pass.
