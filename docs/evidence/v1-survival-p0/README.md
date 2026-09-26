# Survival / traffic milestone evidence

Scope: **partial implementation**, not acceptance of the final gameplay plan.
Full status and remaining release gates: [implementation ledger](../../v1-combat-artillery-mobile-pacing-pass.md).

- `unit-final.json`: frozen game source, 784/784 tests, 113/113 files, default two
  workers, no increased test timeouts. Includes the new 3.7 km finite-supply march
  and 96-person counterflow tests, and the existing supplied noncombat 72-hour soak.
- `unit-intermediate-failed.json`: retained genuine floor-rest / known-crate
  recovery regressions, repaired before final run.
- `unit-concurrent-failed.json`: retained soak / asynchronous-route time-limit
  failures under concurrent browser workload. Both passed on unchanged logic
  without increasing test limits.
- `unit-inflight-edit-invalid.json`: retained invalid test run where the pinned
  manpower assertion changed after its implementation module had been imported.
  Do not use this run for immutable-source acceptance.
- `edge-intermediate-failed.*`: saved UI test failure from reading the v3 key
  after the game correctly wrote/restored v4. Test now checks v4 explicitly.
- `edge-final.json`: final maintained Edge suite, 25/25 passed, no skips or flaky
  cases, 117.53 seconds. Includes exact paused save/load and eight desktop sizes.
- `manpower-overview.png`: actual headed Edge control check, 1440x900. The pools
  count each person once; this is not a demonstration of ALL IN or crew relief.
- `march-preview-final.png`: actual right-mouse-drawn route in headed Edge,
  production build, 1440x900. Estimate includes carried stock only and explains
  uncertainty. The panel is visible during drawing, not a permanent map overlay.
- `offline-final.json` / `offline-boot.png`: final exact HTML copied alone into
  an isolated folder, headless Edge with network disabled. Movement, matching
  save/load state hashes, embedded workers and refresh sizing passed. No errors
  or external network dependencies; 1280x720 and 1920x1080 canvas/menu dimensions
  matched the viewport with no overflow.

All browser checks used disposable test profiles. No player saves were erased.
No physical phone, 512-person performance, lethal march reproduction from the
reported affected save, or final player-believability acceptance is claimed.

Final production/offline HTML SHA256:
`70f90b58572a70098e468b959678777d3c6e04d0b46ae059188a3bcf77b7f98f`.

The CLI fallback was used because the CUA connector could not initialize its
kernel assets. This did not replace browser play with a headless simulation:
mouse/keyboard checks and screenshots used the actual Edge browser.
