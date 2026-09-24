# Field-command UI / verification

## Delivered

The field-folio system is defined in `field-command-ui.md` and implemented in
`src/field-command.css`. It standardizes the command menu, pause/after-action
surfaces, strategic strip, force drawer, selection docket and report, contextual
support/defense panels, map, tooltips, buttons, warnings and keyboard focus.

The battlefield remains the primary surface. The force list is opt-in. Selected
units receive a compact docket, not an always-open statistics wall. Engineers
receive a contextual Plot trench command; Hold cancels movement. SVG plotting
symbols supplement plain-language labels throughout.

New presentation components:

- `FieldSymbols`: consistent equipment/map icon vocabulary.
- `FieldReadout`: read-only aggregation of actual selected personnel; no invented
  hierarchy, ammunition percentages, or travel time.
- `FieldMap`: a paused operational map on G, sector and full 8×8 km theater views,
  terrain, roads, settlements, rivers, 12m contours, objectives, trenches, selected
  routes, and friendly/reported enemy formations. Clustered marks reduce crowding.
- `OrderOverlay`: selected movement arrows and defensive frontage ink, projected
  every frame independently of developer overlays.
- `TrenchDraft`: sampled obstruction marks, control points and live drawn length.
  The preview explicitly says final smoothed geometry is checked on release.

At operational camera distance, individual meshes fade into the existing squad
symbol layer. Labels still project every frame; no visibility debounce or delayed
alignment was added. Actual casualty/smoke/uncertainty geometry remains unchanged.

No combat, needs, inventory, navigation or save rules changed. UI-only map pause
does not edit saved simulation speed. No training, publishing or automation.

## Evidence

- Full regression: 325 tests / 53 files passed in
  both `output/field-style-regression-r1.json` and the final r2 rerun.
- Production layout: `output/playwright/field-style-production-r3.json`.
  All checks pass at 1920×1080, 2560×1440, 1366×768, 1024×768, 800×600,
  560×760 and 1024×520. Main HUD surfaces fit without overlap; menus center,
  scroll as needed, and expose one chosen mode. Existing saves untouched.
- Native player Edge window: `output/playwright/field-native-r1.json`.
  `viewport=null`, actual maximized/compact/short window bounds; campaign state
  and local storage exactly preserved. The player browser was not assigned a
  fixed test viewport.
- Actual trench and move drawing: `output/playwright/field-issued-orders.json`.
  Successful construction request, return to selection and persistent drawn
  route, using mouse down/move/release and real command/roster buttons.
- `output/playwright/field-interactions-r3.json`: all short/sandbox modes open,
  invalid river excavation is marked, operational zoom switches detail, and
  12 label samples align within 0.001 CSS pixel. Its off-screen drawing setup
  failed; do not count those two checks as passes. Corrected drawing evidence is
  the separate issued-orders report above.
- Full map switching and Escape routing independently checked in
  `output/playwright/field-map-debug-r1.json` and repeated production layout run.
- Final production check: `output/playwright/field-final.json` passes at
  1920×1080, 1366×768 and 560×760. The campaign clock and contextual Plot trench
  command remain visible and inside their layout bounds. Settled battlefield,
  briefing and engineer screenshots were visually inspected. Final production
  build passes (JS `index-BWW7746q.js`, CSS `index-BB3chVLV.css`).

Screenshots under `output/playwright/field-production-r2-*` document the seven
layouts, menu, selection report, sector/theater maps and trench plot. Additional
`field-issued-orders.png`, `field-r3-*` and `field-native-*` cover actual orders,
zoom, blocked excavation, modes and real Edge window sizing. The r3 layout run
also passes all checks, but its first 1920px image caught asynchronous terrain
loading: use the settled `field-folio-*` screenshots for visual review.

## Failed checks preserved / limits

The first production probe reported an unexpected map close. It did not reproduce
in the isolated event trace or repeated serial production run. Early combined
interaction probes attempted drawing at an off-screen projected point and sampled
a 200ms HUD refresh too early. Their output and screenshots are retained; the
corrected order check first requires the target to be visible. One earlier regex
also failed to parse browser-serialized transform whitespace; the later alignment
check requires twelve finite samples instead of accepting an empty sample set.
The player Edge session had been closed by the time of the final refresh attempt;
it was not reopened or overwritten. The earlier native-window verification and
exact save/state preservation remain recorded. The latest build is served on 4175.

This is UI acceptance, not a new 72-hour combat study or a 300/1,000-person
performance certification. The existing production chunk-size warning remains.
Map terrain is a restrained schematic, not a satellite image or surveyed real
location. There is no new supply-route layer on the operational sheet yet; the
existing defense inspector's supply-route control remains available. Subjective
approval of the new visual direction remains the player's decision.
