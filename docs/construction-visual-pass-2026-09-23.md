# Construction usability and battlefield presentation

Direct request: "i cant build anything an the game still looks bad". Local work;
no publishing, save migration, neural training, automation, or combat expansion.

## Reproduced problems and fixes

- Construction was hidden behind selecting engineers or the nested garrison
  inspector. A persistent **Build** command now opens an optional paper work-order
  sheet, with trench plotting and all six existing support works.
- Input silently rejected trenches between 10 and 20 metres even though the
  simulation accepts 10 metres. Preview, pointer input and simulation now share
  the same 10-metre minimum; short attempts explain the required length and keep
  the tool ready for a retry.
- Facility placement supplied a generic failure. The projected footprint and
  connector now show material cost, current stock and specific rejection reasons.
  Preview and authoritative construction use the same site checks. Material
  shortages do not create free stock: a legal plan waits for a physical delivery.
- Engineers digging main trenches are no longer assigned to a garrison. The
  sheet explains this and offers an explicit reassignment command. It warns that
  reassignment pauses their current job, while unfinished excavation is retained.
- Paused plans previously looked stuck. Queue feedback and the work list now say
  to press Space or 1x. Jobs show material delivery, connector excavation and
  structure progress, and can be clicked to focus their location.
- Changing tools clears the previous placement ghost. Escape closes the work
  sheet without opening the main menu. The sheet scrolls and keeps Close visible
  at short viewport heights.

The existing rear-side 6–40 metre rule, physical work rates, costs, inventories,
movement authority and save schema have not been loosened or replaced.

## Visual pass

The game-UI and art-direction skills guided a restrained, optional work-order
sheet using the existing field-command palette and fonts. The Three.js guidance
kept changes in rendering: field boundaries/crop rows resolve per fragment rather
than smearing across coarse terrain triangles; roads receive subtle tracks and
verges; instanced trees use continuous irregular canopies and muted foliage;
daylight loses its strong yellow cast. Tree locations, terrain heights, collision
and protection remain unchanged. No renderer-only cover was introduced.

The first canopy revision looked too much like polygon clusters; it was replaced
after screenshot inspection. This is still procedural prototype art, not a final
commercial environment-asset pass. Buildings, infantry and trench furniture have
not been replaced. Visual acceptance remains with the user.

## Verification

- Final `npm test`: **330 tests / 54 files pass**, 60.01 seconds. New regressions
  cover engineer selection, 10–20 m plans, distinct site failures, reassignment,
  physical facility completion, inventory conservation and exact saved continuation.
- Final `npm run build`: pass, 89 modules. Existing >500 kB chunk warning remains.
  JS `index-CWmZikXo.js`, SHA-256
  `7f1711cbfaa275f2481912cc704bc7c5c7b928555b1f5206a0295b0b6062fde4`.
- Actual headed Edge controls on production port 4175: Build from a rifle
  selection, queue a meal bay, reject a short line with a reason, accept a 15 m
  line, and explicitly reassign the engineers. No simulation-order injection.
  `output/playwright/build-workflow-r4.json`: all checks pass, no console/page errors.
- Live construction, through ordinary 5x/pause controls: by 300.30 simulation
  seconds the meal bay and its connector are complete, paid by physically
  delivered materials, with a balanced inventory ledger. Evidence:
  `build-progress-r2.json`, `-r3.json`, `-r4.json`. These progression samples used
  `index-BQp3jQlI.js`; the only subsequent product change was canopy rendering.
- Final-build front-side placement is rejected without changing the paused
  state; switching to Move clears the ghost; Escape closes the sheet; localStorage
  unchanged. `build-boundaries-r1.json`: all checks pass.
- Final responsive checks: 1920x1080, 1366x768, 907x510, 821x462 and 560x760.
  Sheet and dock fit, catalogue scrolls, time controls remain accessible, and
  paused state/localStorage remain unchanged. `build-layout-r2.json`: all pass.
- Final-build 96-person construction-scene smoke check at 1600x900:
  1x advances 10 simulation seconds in 10.0042 wall seconds; 5x advances 50 in
  10.0027. Both p95 frame intervals are 6.2 ms, with no console/page errors.
  `build-performance-r1.json`. This is **not** a new 300/1,000-person combat stress
  result, and it does not supersede the older documented large-scene limits.
- `git diff --check`: pass. No user saves written, no external push this pass.

The playtest/Playwright skills drove real pointer/keyboard checks and screenshot
review. Relevant preserved screenshots under `output/playwright/`:

- `build-before-world.png` (baseline)
- `build-after-world-r4.png`, `build-close-terrain-r2.png` (final battlefield)
- `build-work-orders-r4.png`, `build-site-preview-r4.png` (construction)
- `build-invalid-site-r1.png`, `build-layout-821-r2.png` (failure/responsive states)
- `build-progress-300.png` (completed live construction, earlier canopy revision)

## Retained failed probes and limits

An intermediate workflow probe resized the browser, then captured the canvas
before its new camera/render dimensions settled. It found no visible site and
aborted; the following progression probe correctly rejected its missing queued
facility. The partial `*-r2.png` screenshots remain. The revised workflow waits
for visible markers and stable projected camera coordinates, then passes. These
failed probes are not counted as successful product checks or as a fixed
construction simulation defect.

Authored QA probes live in `scripts/qa-build-*.cjs`. The evidence runner refuses to
overwrite reports; give repeats fresh output paths and screenshot suffixes.
Browser evidence stays local under ignored output, alongside earlier evidence.
Saves, unrelated systems, automation state and remote Git history were preserved.
