# Worker control / A extension — 2026-09-26

Baseline: local and remote `39557dae95aa32ef7ca47caf70c32d90617fb8f3`.
Scope: individual worker selection, NORMAL worker opt-in, shared manpower
eligibility, truthful defensive readouts, and the affected assault interface.
This is not completion of the integrated A–G release plan.

## Reproduction and automated checks

- `reproduction.json`: three pre-fix failing tests. The fit reserve is counted
  AVAILABLE but rejected by NORMAL because its duty is named `rest`; worker
  opt-in and exact work-party scope are absent. These are specific reproduced
  defects, not proof of every reported crew/control problem.
- `unit-first.json`: 816/816, 118 files, before the final readiness sharing and
  cancelled-job/personal-assignment edge-case refinements.
- `unit-final.json`: retained failed concurrent run: 814/816 plus a worker RPC
  timeout. Combat speed/save and the existing supplied loop soak exceeded their
  unchanged 45/40-second wall-clock limits while Edge suites and portable launch
  ran alongside them. No assertion failure is concealed. The isolated rerun has
  its own report; no timeout threshold was increased.
- `scoped-final.json`: 25/25 (ten worker/scope tests, thirteen existing assault
  tests, two manpower tests). Tests include read-only queries, exact person IDs,
  material preview changes, ALL IN scope, cancelled work, personal assignment,
  malformed save data, older v4 compatibility, and deterministic continuation.
- `unit-isolated.json`: the two wall-clock failures pass without the concurrent
  browser workload. This run is nevertheless **not a release pass**: it started
  before the last two edge-case tests and implementation refinements were saved,
  and its cached older implementation fails those new assertions. Retained in
  full. `unit-frozen.json` is the subsequent untouched-source full run.
- `edge-suite-first.json`: maintained Edge suite 27/27. Its deterministic
  fixture-based tests are separate from the authored-through-controls flow below.
- Packaging tests: 5/5. Final build, offline and regression status is recorded in
  the implementation ledger. The existing JavaScript chunk-size warning remains.

## Actual Edge interaction (no solved-state injection)

The native browser automation entry failed to initialize with a missing kernel
asset path. QA used a separate headed Microsoft Edge instance driven by the
Playwright CLI, not the user's profile. Campaign saves in the user's browser
were untouched. Diagnostic evaluation read state and projected coordinates only;
it did not replace game state, advance ticks or grant supplies.

1. Open Sandbox, pause, open Command / Positions, and locate the actual network.
2. Build / Rest dugout, then click on the battlefield. The first unsuitable
   front-side site was rejected; a rear-side site created facility 256 and its
   connector with an actual finite material demand. No materials were injected.
3. People / Select workers selected IDs **20, 21, 22, 226**, drawn from Rifle 02
   and Engineer 1. Their original squad IDs remained **12 and 221**.
4. Prepare assault and click a destination. Only those four entered the review.
   Unchecking Include workers produced 0 selected / 4 excluded and disabled GO.
   Checking it restored four; ALL IN still selected those four, not both squads.
5. Menu / Save, refresh, Continue. The paused preview, scopes, facility inventory
   and worker IDs were restored. Confirm GO, unpause briefly, then pause: all
   four committed and advanced; the work order retained its progress, had no
   workers, and was marked paused by assault. Squad membership was unchanged.
6. Reload the earlier saved preview and cancel it while paused. Elapsed time
   stayed **6.05 s**, prepared orders cleared, and facility 256 still had workers
   `[226,22,21,20]`, zero construction progress and exactly the same inventory.
7. Inspect at 1440x900, 800x450 and 430x800. Review content scrolls; Cancel / GO
   remain accessible. The portrait screenshot reproduced a compass above the
   review heading. Moving it into the HUD stacking context fixes occlusion,
   without hiding world labels or slowing their alignment.
8. Browser console: zero errors and zero warnings. Close the isolated browser.

Screenshots here include the selected group, resumed review, compact/portrait
views and the failed portrait layer. The earliest group screenshot precedes the
44-pixel group-action sizing refinement; final review screenshots use it.
Full CLI snapshots and rejected-placement evidence remain under
`output/playwright/worker-control-20260926/`.

## Limits and next gate

Work-party selection currently feeds the assault preparation workflow; it does
not create a permanent squad or replace the existing individual Move/Watch/Rest
orders with a new general-purpose group-order system. The optional NORMAL
worker toggle is off for ordinary formation preparation; explicitly selecting a
work party opts those selected IDs in, visibly, without adding other workers.

No population/calendar defaults, physiological rates, ammunition, construction
rates, or campaign inventories changed. The original long-journey deaths remain
not causally reproduced. External protected overflow staging, 95% protected
settling, the complete survival/calendar matrix, artillery cycle, 512 personnel,
DEV authoring, living-menu isolation and release/performance gates remain open.
Viewport checks are desktop emulation, not physical-phone acceptance.

The current [CrazyGames quality guidance](https://docs.crazygames.com/requirements/quality/)
was reviewed for clear labels, responsive controls, consistent presentation and
device-appropriate layout. This is a narrow usability check, not platform
submission readiness or a claim that onboarding and pacing are finished.
