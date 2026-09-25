# Persistent trench assignments

2026-09-24 · baseline `192e2db` · rules `combat-30-persistent-defense-world2`

## Reproduced cause

`issueHold` unconditionally called `clearTrenchAssignments`, removing the squad from the area and every soldier's garrison, duty and trench metadata. Observe and Suppress called Hold internally for ordinary squads, so aiming from a trench also silently detached its defenders. Crewed weapon positions had a special exception for Observe/Suppress, but Hold still unmounted them.

In disposable headed Edge on the old production build, paused Baker had eight members in garrison 374. Clicking the actual Hold button changed its order to `hold`, emptied its garrison membership and cleared all eight duties without advancing time or moving anyone. The before/after diagnostics are in the task's CLI output; `output/playwright/trench-assignment-before-hold.png` records the resulting UI.

No periodic assignment deletion was found in routine sleep, meals, logistics, geometry rebuilding or alarm handling. Casualty evacuation deliberately removes the evacuated person's local membership. This finding does not rule out a separate problem requiring the player's exact reproduction.

## Changed command contract

- Hold on an assigned formation removes tactical overrides and retains the standing Defend Area order. Entry/relocation travel, temporary duties, individual orders, loaded deliveries, support-work queues and weapon crews remain intact. It is not a freeze-every-soldier command; use Pause for that.
- Observe and Suppress retain that assignment while changing tactical intent. The compact selection readout says **Defending · observing/suppressing**.
- Hold on an unassigned formation still stops movement or main-trench excavation. Mixed selections do not acquire invented assignments.
- Move, drawn routes, Assault/Withdraw, entering a building and new main-trench construction still release the previous area through explicit commands. Building entry has its own cleanup rather than relying on Hold to do it indirectly.
- Replacing the squad order still invalidates outstanding navigation callbacks, without discarding physical duty routes.
- In-game command tooltip, Defense Status guide, support guide and field manual explain the distinction. This supersedes earlier reports describing Hold as leaving an area or unmounting its weapons.

## Saves and limits

Save schema/storage key remain unchanged. Rules identity advances to 30; old saves retain their people, positions and inventory. Same-rules continuation remains exact. No player browser profile or saved campaign was changed during QA.

Already-detached squads in an old save need a new Defend assignment. There is no reliable record of whether that old Hold was meant to leave the area, so this patch does not guess and reassign them on load. Assigned-but-outside troops can legitimately be carrying supplies, relocating or reacting to danger; physical shelter and assignment are different states.

## Verification

- **516/516 unit tests, 72 files**, including seven new persistent-assignment cases and an additional readout case. Coverage includes physical watch relief, needs, individual orders, alarms, support construction/network growth, queued work, mixed selections, explicit departure, stale async routes, exact save continuation, both factions' mortar preparation, mounted MG retention and inventory balance. The existing supplied 72-campaign-hour loop-network soak also passed. Report: `output/playwright/trench-assignment-unit-verified.json`.
- **21/21 existing browser regressions** passed on the frozen final source in 47.0 seconds: actual controls, support readiness, saved state, configured reserves and eight desktop/short-window layouts.
- Production TypeScript/Vite build and portable `FRONTLINES.html` rebuilt; **5/5 packaging tests** passed. Isolated single-file Edge launch with networking disabled passed worker startup, real troop movement, exact saved continuation and refresh sizing at 1280×720 and 1920×1080, with zero browser errors. Evidence: `output/playwright/trench-assignment-offline-1790298438315/`.
- Actual headed Edge UI controls on the production preview: Baker remained 8/8 assigned through Hold, Observe and Suppress; all six friendly formations retained their eight members over 60.1 further simulation seconds of combat at 5×. Trench 02 still reported 16 assigned, including Easy. An individual Rest order survived Hold unchanged; Easy's MG nest remained crewed after Hold. Save/reload preserved serialized people, squads, duties and inventory exactly at elapsed 640.3. An explicit Move released Baker, and the trench inspector's Assign selected squads restored it with no paused teleportation.
- Actual-control checks used the disposable `weapons-transport-qa` Edge session. State access was read-only diagnostics; no positions, progress, needs, assignments or inventory were injected. Existing automated browser tests separately use clearly labeled synthetic fixtures for isolated support-readiness checks.
- Screenshots and replayable CLI scripts: `output/playwright/trench-assignment-*`, including `observe.png`, `suppress.png`, `hold-stable.png`, `person-preserved.png`, `crew-preserved.png`, and `restored.png` with that prefix. Screenshots were inspected visually.

### Retained failed probes and remaining scope

- The first full unit run had one old expectation that Hold must empty a support-work queue. It now asserts queue retention on Hold and explicit cancellation on Move. Original run retained in `trench-assignment-unit-final.json`; verified run has a separate filename.
- The first browser regression run had one old expectation that Hold unmounts a prepared mortar. It now verifies that a paused Hold refreshes readiness while retaining all eight members and the position. Original screenshot/context retained in `trench-assignment-first-browser-failure/`.
- An early camera-wait probe referred to `zoom` instead of the exposed `zoomDistance`, and timed out after the UI selection succeeded; the probe was corrected. This was a test-script error, not a game fix.
- Vite's existing large-chunk warning remains. No new frame-time benchmark or broad visual/gameplay acceptance claim is made. If assignment still disappears without any order, the exact save and preceding actions are the next useful reproduction; no speculative every-tick reassignment or save repair was introduced.
