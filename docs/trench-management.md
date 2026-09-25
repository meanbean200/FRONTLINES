# Trench work details and individual control

2026-09-24 · starts at `ea3bb45` on `master`.

## What changed

The reported one-person work detail was reproducible in the new equipment-based formations. A squad may have only one tool set. `EngineerSystem` discarded everyone without tools, while the squad controller explicitly sent those people into an open-ground escort formation and assigned them to watch. This was not simply a slow animation.

Tool carriers now excavate and the other fit members clear spoil behind the same working face. Only people physically present contribute; helpers cannot open a separate face without a tool carrier. Crews use completed floor behind the face, retain their stable assignments, and continue center-out/branch jobs. The conflicting escort movement writer is removed.

- A present tool carrier contributes 0.2 metres per simulation second; a present helper contributes 0.1, only at a staffed face. One tool carrier plus seven helpers can therefore produce 0.9 m/s instead of 0.2 m/s once assembled. These are gameplay rates, not historical measurements.
- Travel, crowding, suppression, casualties and loss of tools still reduce actual output. No remote work or extra equipment is created. Multiple available tool crews can staff separate fronts.
- Helpers use a working pose, not a rifle-holding escort pose. Only tool carriers display a shovel. Both kinds of work incur physical exertion.
- Breaking ground does not instantly grant trench protection. Cover follows the real excavated terrain; the first few centimetres are still open ground.

## Controls

1. Click a numbered trench marker, click empty trench floor, or open **Command → Trenches**.
2. Use **Find a trench** / **Locate** to distinguish and highlight the actual line. Map labels, construction networks, worksites, planning confirmations and area selectors use the same name.
3. Assign selected squads explicitly or resume an unassigned paused worksite. Inspecting never orders a squad to move. Resume targets the chosen trench, not an unrelated nearer line; an already assigned job cannot be stolen.
4. Select a person in **Personnel**, or Alt-click their body. The chosen person gets a visible outline.
5. **Reposition** then click free completed floor in the connected network; **Watch**, **Rest**, **Eat / drink**, or **Area duties** control that person only.

Personal routines require assignment to a friendly defensive area. Construction personnel can be inspected but remain a squad work detail until reassigned. Personal watch/rest/position orders last at most two campaign hours; meal orders finish through the existing supply flow. Return to **Area duties** restores normal coordination. Later squad orders, casualty care, immediate combat reactions, critical needs and withdrawal retain their authority. Deliveries and rescue tasks cannot be silently cancelled through this panel.

The inspector is contextual, not a permanent roster. Selected-person controls sit above the scrollable list; the close control stays available in short windows. Changing trench, choosing another person, closing the inspector or Escape cancels a pending individual movement click. Labels/inspection lines project each rendered frame, without hiding or delayed transform animations.

## Persistence and boundaries

- Save schema stays 3. The optional validated `Duty.playerOrdered` field saves the current individual assignment with its existing physical route and inventory.
- Rules identity is now `combat-27-trench-details-world2`; incompatible neural results remain unavailable/fall back to rules. No training.
- Prior people, equipment, completed earthworks and inventory are preserved. Existing old saves remain parseable; exact continuation is tested within the new rules, not promised across a rules change.
- No new permanent trench slots, arbitrary cover bonus, supply refill, audio, combat overhaul, automatic automation or deployment.

## Verification and retained evidence

All browser work used disposable Edge contexts, not the player's profile or saves. Evidence is local under `output/playwright/` (ignored by Git).

- Final simulation suite: **491/491**, 69 files, including the existing 72-campaign-hour soak (74.15 s). Focused final excavation/personnel/identity/targeting run: **33/33**. Full release results are recorded in `trench-management-unit-release.json`.
- Existing browser suite: **21/21** with two workers in `trench-management-e2e-final/`; includes menu sizes down to 1280×540, orders, support readiness and saved reserve accounting.
- Real production-preview mouse controls: Quick Battle → Open Front (seed 1944); read-only inspection; individual rest and reposition; unchanged other people's orders at issue time; physical arrival; Save → reload → Continue with identical personal duty; Alt-click selection; 1280×720 inspector; cancellation on close and trench change.
- Real mixed-kit construction: selected Dog through the roster, drew a 60 m trench with the mouse, ran normal 5× ticks. Observed **one digger and seven spoil helpers, all with trench cover** at 20% excavation; the whole line subsequently completed. No positions, equipment or excavation were injected for this check.
- Screenshots inspected: `trench-management-overview.png`, `trench-management-person-polished-1280.png`, `trench-management-draw.png`, `trench-management-working-established.png`. Release control checks additionally cover Watch / Rest / Eat / Area duties buttons and a scrollable 1280×540 inspector. Work counters are scoped to the chosen worksite, not other builders in its connected area.
- `npm run build`: TypeScript, hosted production and regenerated portable `FRONTLINES.html` pass. `npm run test:packaging`: **5/5**.
- `node scripts/qa-file-boot.mjs FRONTLINES.html trench-management-release-offline isolated`: copied single HTML with networking disabled, embedded workers, troop movement, identical saved continuation, and refresh sizing at 1280×720 / 1920×1080 pass; no browser errors. Evidence: `trench-management-release-offline-1790294837914/` (the earlier run is also retained).

### Failed probes, corrections and remaining risks

- First full unit run was 489/490. An old resume assertion assumed the arbitrary right-hand `constructionHead`, although center-out excavation has two unfinished faces. The assertion now checks the nearest real unfinished face, preserves the interval, and still requires full completion. The failed JSON (`trench-management-unit.json`) remains; subsequent full run passed.
- First parallel browser run was 20/21: the 24-reserve case hit the existing boot-failure screen before the menu appeared. No underlying exception was captured in that run, so its cause is **unconfirmed**, not claimed fixed. The same case passed alone with a trace; the entire suite subsequently passed with two workers. Both failure screenshot/context and successful reruns remain. If this startup failure recurs outside parallel QA, collect the console exception before changing launch code.
- First excavation screenshot was captured after only 0.07 m of work. Its cover assertion correctly failed because the floor was not yet excavated. The established-work check requires meaningful excavation and all seven helpers, then verifies actual cover and completion. No fake protection was added to make that probe pass. The early screenshot and initial out-of-viewport draw probe are retained.
- Existing Vite large-chunk and NO_COLOR/FORCE_COLOR warnings remain. No new 300/1,000-person performance claim is made. Close-up believability and preferred digging pace still need player acceptance.
