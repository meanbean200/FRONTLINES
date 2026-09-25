# Close-range aim and extreme misses

2026-09-24 · baseline `79a1e27` · rules `combat-32-close-range-aim-world2`

## Fix

The old rifle spread started at 22 cm of target-plane error even at zero range. Multiplying that fixed error for movement, stress, fatigue and darkness could turn a five-foot shot into an almost vertical ray. This was a physical shot-resolution problem, not simply an incorrectly drawn tracer.

Near-range dispersion now starts at zero, reaching 4.5 cm at 2 m, 10 cm at 5 m, 18 cm at 10 m and 37 cm at 25 m. It joins the existing 57 cm spread at 50 m. The ordinary 50–360 m spread table, weapon cadence, visibility checks, ammunition costs and wound rules are unchanged.

Sampled error is bounded to a 12-degree cone around the **intended aim ray**, not the world horizon. Soldiers can still shoot uphill or at upper floors. This limits extreme outliers for every small-arms shot; it does not guarantee a hit, ignore protection or change only the visual effect. A proper perpendicular basis also handles a directly elevated target without generating an invalid direction. Fire discipline uses that bounded physical envelope instead of withholding point-blank fire because of the old unbounded estimate.

Both factions use the same calculation. Aiming, target recognition, pinning, broken morale, movement and exhaustion still matter. The renderer, suppression and damage continue to consume the same `ShotEvent`.

Rules identity advances to 32. Save schema and storage keys are unchanged; the existing rules-change notice applies when continuing older saves. No player-profile save was edited, replaced or deleted. The offline `FRONTLINES.html` is rebuilt with the fix.

## Controlled calibration

`scripts/verify-close-combat.ts` resolves 10,000 actual physical shots per distance and condition: 400,000 shots per run, seven repeated seeds, fixed serialized shot counters, flat terrain and one fully exposed standing target. It records Wilson 95% intervals and ray angles. These are gameplay fixtures, not historical marksmanship claims or measured natural-battle outcomes.

At 1.524 metres (five feet):

| Conditions | Before: hits | After: hits | Before: largest aim error | After: largest aim error |
| --- | ---: | ---: | ---: | ---: |
| Rested, stationary | 75.41% | 100.00% | 32.56° | 5.42° |
| Shooter and target moving | 8.99% | 85.30% | 74.79° | 12.00° |
| Moving target, suppression and fatigue | 4.83% | 74.80% | 79.10° | 12.00° |
| Extreme combined penalties, including night | 0.06% | 56.82% | 88.88° | 12.00° |

The extreme row isolates dispersion only; normal action authority prevents physically pinned troops from firing. The 100% stationary result describes this sample and exposure, not every close-range situation.

Rested hit counts were identical before/after at all existing calibration distances: **27.92% at 50 m, 12.49% at 100 m, 2.68% at 200 m, 0.49% at 300 m, 0.32% at 350 m**. Extreme stressed long-range outliers are now cone-bounded too; this is not a claim that every stressed far-range trajectory is unchanged.

Preserved local evidence:

- `output/close-combat-before-79a1e27.json`
- `output/close-combat-after-rules32.json`

Reproduce without overwriting previous evidence:

```powershell
npx tsx scripts/verify-close-combat.ts output/close-combat-new-run.json
```

## Regression discovered during verification

A garrison save-continuation test initially failed because the now-reliable close shot triggered a previously unexercised reaction. At the southern world boundary, a hit soldier chose off-map cover and walked from z = -2000 to -2000.06. Save validation correctly rejected the resulting invalid position. The failed state is preserved in `output/close-save-failed-state.json`.

Cover selection now rejects out-of-world candidates. Reaction movement also rejects an off-map waypoint from an older save before taking a step, preserves the player's order, and requests a new cover review. It does not clamp/teleport the soldier or weaken save validation. Regressions cover all four map edges and the original full garrison-alert/save-continuation case.

## Verification

Focused checks cover point-blank hit rates, finite/bounded steep rays, unchanged far-range sample counts, physical earth protection, no small-arms friendly damage, actual tracer endpoints, ammunition expenditure, serialized shot continuation, map-edge reactions and garrison recovery. Initial test-fixture issues were corrected rather than changing production protection: a narrow building allowed fire through a real opening, so the close-cover test uses a solid earth bank; a large mock-heavy calibration loop was replaced by equivalent pure geometry, with the standalone probe retaining full physical resolution.

Disposable headed Edge on the production preview was checked with real map/zoom and speed controls. An explicitly synthetic two-person fixture placed a rifleman 1.524 m from a target on open, nearly level terrain; this is a controlled interaction, not a natural playthrough. At simulation time 1.75, the actual shot hit the target body, consumed one carried/loaded round, and produced a disabling wound through the existing casualty system. The visible rifle and casualty agree with the physical event. Inspected screenshots:

- `output/playwright/close-shot-before-fire.png`
- `output/playwright/close-shot-impact.png`

- Final full suite: **544/544 unit tests in 73 files**, including exact combat/speed/save continuation and the supplied 72-campaign-hour logistics regression (76.55 seconds).
- Existing Edge regressions: **22/22** (45.6 seconds), including controls, support weapons, reserves, save/load, contacts and responsive layouts. Packaging: **5/5**. TypeScript, production Vite and standalone builds pass; the existing large-chunk warning remains.
- Reloaded the disposable Edge session back into its original saved Open Front at elapsed 640.3, with the visible revised-rules notice. Using ordinary selection/map/speed controls and no injected state, it advanced 15.05 simulation seconds in 15.05 wall seconds, firing 34 shots with finite rays and no hits in that short distant encounter. Screenshot `output/playwright/close-aim-normal-play.png` was inspected. This is a continuation smoke check, not evidence of point-blank accuracy or broader battle balance. Console: zero errors/warnings. The synthetic encounter was not saved over that campaign.
- Isolated disk launch of the rebuilt `FRONTLINES.html` in Edge with networking disabled passes: terrain/navigation workers, actual movement command, identical save/load state hashes, full viewport after refresh at 1280×720 and 1920×1080, and no browser errors. Evidence: `output/playwright/close-aim-offline-1790300484255/`. The tested copied artifact and root HTML have identical SHA-256 `fbea376068e1befe5162843ccb7dcbee86f4daa7c9c9d05d38364f72fd1d80df`.

## Remaining limits

This is a focused aiming correction, not a weapon, animation or AI overhaul. No new 300/1,000-person benchmark, fresh long combat soak or broad balance acceptance is claimed. The supplied 72-campaign-hour regression checks logistics/duties, not campaign combat balance. Player judgment of combat feel remains separate from automated calibration.
