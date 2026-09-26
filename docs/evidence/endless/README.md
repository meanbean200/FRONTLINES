# Endless evidence — 2026-09-26

Scope: generated player Endless milestone on top of clean local/remote master
`7426ba7916daca38c070b6ba5af682a36483eada`. **Overall PARTIAL.** Neither the setup
button nor this evidence clears the complete 50-section handoff. See
`docs/endless-mode.md` for exact behavior, calibration and remaining boundaries.

## Player-control Edge evidence

The headed `playwright-cli` `endless` session used an isolated profile, not the
user's campaign storage. No solved game state was injected in these flows.
Snapshots and raw CLI scripts are retained locally in `.playwright-cli` and
`output/playwright/endless-*.js` (ignored tool output, not production code).

1. `01–03`: Quick Battle → Endless, seed 1944, Continuous, ten-minute cycle,
   briefing and a fresh battle through visible controls.
2. `04–06`: selected Able, opened the operational map, ordered a real movement
   with a map right-click, resumed at 5×, crossed via normal navigation. Passive
   state snapshots are `browser-progress-state.json` and `browser-progress-2.json`.
   At 477.3 simulation seconds La Prairie was physically friendly controlled,
   operation still active and all 48 friendly personnel living.
3. `07–11`: continued through night, opened the record, Save & Exit, refreshed,
   Continue, cancelled End Battle, then explicitly confirmed it. The concluded
   record has no fabricated winner; `browser-ended-state.json` retains the
   actual state. The saved active campaign was not silently overwritten.
4. `12–16`: final source's setup, portrait setup/pause, desktop pause and concluded
   summary. The history is now collapsed, Save & Exit is immediately below
   Resume. Repeated Save & Exit/refresh/Continue/cancel/confirm succeeds.
   `browser-final-state.json` includes current ended state, session ownership and
   the still-active saved state, read without modifying storage.

The final screenshot pass disables CSS animations **for capture only** to avoid
sampling the menu's 160-ms entrance fade. Earlier `09`/`11` are preserved as taken,
not offered as settled contrast evidence. Final browser console: 0 warnings,
0 errors. Captured desktop 1654×910 and portrait 390×844 layouts are not physical
phone performance or touch-device acceptance. Some actions use intentional menu
scrolling on shorter displays.

Not browser-certified here: actual artillery, recapture, loss replacement arrival,
town hub/recovery, enemy convoy interception, extended late-save performance or
512-person play. The brief 96-person 5× diagnostics are not a release benchmark.

## Focused tests and preserved failures

- First local fixture attempt wrongly imported the nonexported save validator;
  it was corrected to use the real `SaveSystem.parse` API. The tool transcript
  preserves that failure; no product behavior was bypassed.
- `core-attempt-2.json`: 15 Endless checks passed.
- `core-attempt-3.json`: 18 Endless plus 7 existing replacement checks passed.
- `core-attempt-4.json`: the new regroup test failed because the fixture's
  `nextOrders` had not reached its decision time. Corrected to explicitly make
  the decision due, not by changing production scheduling.
- `core-attempt-5.json`: 19 Endless checks passed, including reported-threat
  reoccupation. Type checking also caught/fixed missing required test-fixture
  `issuedAt` and `squadId` fields before that run.

These include explicit mode restoration/rejection, Operation isolation, actual
capture-authority ticks, finite authorization, no-demand population/source bounds,
real convoy/shuttle replacement transfers, calendar/needs/transport independence,
hidden-player-movement firewall, exact production simulation continuation and
presentation-only corpse retirement.

The isolated capture fixture places people at a control area; the replacement
fixture explicitly records three test deaths. They are **unit/integration
fixtures**, not actual-control browser captures or a natural-combat soak.

## Integrated soak attempts

`scripts/soak-endless.ts` runs the actual TypeScript simulation at fixed 50-ms
ticks. It creates a normal 96-person generated Endless battle, issues public
landmark moves and a real construction order, requests support only from reported
contacts, and answers emergency hold decisions as explicit driver choices. It
does not fabricate hits, casualties, captures, stock or weapon positions. Every
150 seconds it loads a saved copy, advances both ten ticks, compares exact state
and checks resource conservation. Reports include runtime-source SHA, rules,
orders, final state, samples and individually qualified activities.

- **Attempt 1:** completed 72.02 campaign hours, 108 real small-arms shots, one
  real casualty, useful completed excavation, one town captured by each faction,
  twelve exact save-continuation checks and balanced inventory. No artillery,
  no recapture and no completed replacement. A replacement reached the rear but
  had no formation arrival network. This preceded the small enemy reoccupation
  integration patch; its source hash remains separate.
- **Attempt 2 (failed, retained):** explicitly ordering remote trench entry at
  1050.5 seconds was rejected: person 259 had no reachable local entry. Capacity
  was not the blocker. The run aborts and retains the full state; no teleport or
  forced assignment was used to conceal it.
- **Attempt 3:** uses normal cross-map movement before nearby trench entry.
  Actual reoccupation accepted at 1741.65 seconds. Completed 72.02 campaign hours,
  construction, combat, capture, twelve exact load checks and conservation;
  insufficient remaining time for a forward replacement arrival. Artillery and
  recapture are still absent. Historical/physical records were not deleted.

- **Attempt 4:** same final runtime source, extended to **96.02 campaign hours**.
  The real casualty's replacement physically arrived by campaign hour 85.42
  after reoccupation. Living force returned to 96 total (97 historical people,
  including one preserved dead record). Eight trucks, 13 crates, one manifest,
  two recent control events and four tactical plans remained. Sixteen exact
  save-continuation checks and inventory conservation passed. Completed real
  excavation and 108 shots; **no artillery or recapture**. This does not clear
  the full integrated soak gate. Runtime source hash:
  `f5fc67edb77ba93d9588fde92ec4714539e7dfcd288d99543cba6a7d05c155c6`.

The failed distant-entry case remains an integration/command-UX limitation.
Arrivals do not substitute for the missing artillery/recapture/interdiction
requirements. The fourth run executes the same commands as attempt 3, just for
600 additional simulation seconds; it does not alter a save to force arrival.

The samples are simulation-step costs, **not browser frame p95**. Raw V8 heap
includes collection fluctuations; these few hours with one casualty cannot prove
bounded historical-state growth. Authoritative old casualty/manifest archival,
empty-container lifecycle and crater/structure consolidation remain open.

## Release verification

Production/portable and separate strict-TypeScript DEV builds pass. Packaging
checks pass 5/5; pre-existing large-bundle warnings remain visible. Final portable
SHA-256: `c972984bde169413100463f6778002d007df704d82804c90d497a819a31a61ee`.
- `full-regression-attempt-1.json`: **884/884, 128 files, 451.15 seconds**. Zero
  failed/pending; preserves the 865-test baseline and adds 19 Endless checks.
- `edge-regression-attempt-1.json`: **27/27, 116.16 seconds**. No skipped, flaky
  or unexpected cases. Existing restoration/injection fixtures remain synthetic
  regressions, separate from the actual-control playthrough above.
- `offline-regression.json`: copied standalone, networking disabled, real title
  session, ordinary Operation movement, both worker responses, exact paused
  save/Continue, no errors or remote requests. Cold refresh sizes 1280×720,
  1920×1080, 2560×1440, 960×540, 844×390 and 390×844 fit with accessible home actions.
- `offline-endless-attempt-1.json` is a preserved **harness failure**: direct JS
  deep comparison distinguished absent fields from optional `undefined` values.
  The save format intentionally omits undefined fields. The harness now compares
  the complete JSON-serialized simulation semantics, as the ordinary file test
  does; no actual value, time, inventory or gameplay field is excluded.
- `offline-endless-attempt-2.json`: actual offline controls select Endless with
  Continuous/20-minute calendar; exact paused Save & Exit/refresh/Continue passes.
  Cancel End leaves the state unchanged; confirm ends it without overwriting the
  active save; explicitly saving the concluded record reloads it as concluded.
  No page/console errors or remote network dependencies.

The single-file fallback harness uses isolated Edge because the browser CLI
cannot open `file://`. Both harnesses are repeatable from `scripts/`, never attach
to the user's profile and preserve failures under unused result paths.
