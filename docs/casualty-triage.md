# Bounded casualty rescue and triage

2026-09-24 · baseline `ba644c5` · rules `combat-33-bounded-casualty-care-world2`

## Reproduced problem

Automatic aid-post selection had no distance limit. The controlled baseline placed a casualty beside a helper and the nearest aid post 1,000 m away. After first aid, the helper began a 20.8-minute foot carry at 0.8 m/s without a warning. After 60 simulation seconds the pair had reached x = 36.635 and still had nearly a kilometre to walk. The subsequent roadhead leg was also unlimited, and a carrier could wait indefinitely for a truck.

Preserved evidence: `output/rescue-distance-before-ba644c5.json`. This is a synthetic unobstructed fixture, not a claim to have recovered the exact encounter the player witnessed.

## Changed behavior

- Helpers prioritize **critical wounds they can actually reach and treat before the existing bleeding deadline**, then other untreated wounds, then already stabilized casualties. A hopeless route for one helper does not prevent a closer/faster helper from trying. Medical supplies and treatment time remain necessary. No survival lottery or new fatality timer was added.
- Automatic approach limits use actual planned walking length: 30 m for ordinary helpers, 120 m for medics. Carrying to an aid post is limited to 120 m; the onward truck-pickup walk is limited to 60 m. These are tunable gameplay limits in `CasualtyTriage.ts`, not historical or medical claims.
- First aid can still stabilize someone locally even if there is no sensible evacuation route. The helper then returns to their existing duties; the patient remains at their real location. No remote healing, teleportation, free supplies or automatic return to combat.
- Aid-post selection compares reachable walking distances, respects faction and capacity, and counts patients already at the post as well as inbound reservations. An apparently close post with a huge detour is not treated as a short rescue.
- Ordinary helper commitments are bounded to roughly a quarter of a squad's able people, with at least one ordinary rifleman left available. Medics are exempt from this buddy quota. Exhausted helpers do not take new jobs, and ordinary watch personnel retain watch.
- Ongoing trips recheck remaining distance, progress, the aid post and reported threats every three simulation seconds. New pinning/broken morale releases the rescue assignment. A four-minute leg timeout prevents indefinite stuck trips. Old saves' already-running excessive carries are reviewed too; rejection leaves both people where they actually are.
- Risk checks inspect the actual route against **local recent reports**, not hidden enemy positions. Accepting rescue risk does not bypass physical impossibility, pinning or the walking limits.
- After treatment, a casualty may be carried to a nearby usable roadhead. The helper puts them down and resumes duty instead of remaining a permanent stretcher stand. The saved `awaiting-transport` state boards only a real friendly shuttle arriving within five metres with one of its two stretcher spaces free. No truck is spawned or given free fuel.
- Dead patients are no longer retained in truck passenger lists, and a helper dying before collection cannot teleport the uncollected patient to their own location. Cancelled tasks no longer leave an orphaned floating “being carried” pose.

## Player decisions

**Leave for now** is a persistent hold, not a 30-second cooldown that silently expires. It survives save/load and remains visible in Support & rescue. It does not stabilize a bleeding wound or prevent death. **Retry rescue** checks the situation again; an unchanged impossible route reports the problem again rather than hiding it. Exposed routes retain **Accept rescue risk**.

Casualty reviews are now at the top of the support drawer, above mortar instructions, with the unit name and wounded person's ID. Only pending decisions raise the alert; a held decision remains available without repeatedly demanding attention. The field manual explains the limits and controls.

Save version 3 and its storage key are retained. Optional care-review timers are validated and initialized for old running tasks, and the new waiting-at-pickup state is serialized. Existing people, wounds, bleeding deadlines and inventory are preserved; no retrospective deterioration is applied. The existing revised-rules notice appears when loading an earlier build's save.

## Verification

Nineteen new focused regressions cover distant posts, real route length, post occupancy, impossible deadlines, critical/minor priority, preserving rifle strength, excessive routes from old saves, long roadhead legs, releasing carriers at pickup, actual truck boarding, permanent holds, failed retries, local-information boundaries, new route threats, enemy symmetry, helper/patient death, pinning, orphaned poses and exact in-progress save continuation. Existing upstairs-door/stair rescue, ammunition/inventory, wound and transport tests also pass.

An actual full-simulation version of the far-post fixture leaves the stabilized casualty at `(30, -320)` and releases the helper at `(31, -320)` after 20 seconds. No carry task remains; the panel explains that an available aid post is needed within 120 m walking. Evidence: `output/rescue-distance-after-rules33-running.json`. The first probe accidentally retained manual pause and advanced zero ticks; that non-result is preserved separately as `output/rescue-distance-after-rules33.json` and is not used as proof.

Disposable headed Edge, production preview, explicitly synthetic casualty fixture:

- Real map/zoom and speed controls revealed the stabilized casualty on the ground and the helper released from carrying. One medical unit was consumed.
- Clicking Leave for now kept the rescue suspended past the former cooldown: from elapsed 0.1 to 35.2. The helper did not leave for the far post.
- Real Menu → Save, browser reload and Continue preserved the hold, patient, position and absence of a carry task. A subsequent Retry correctly reopened the unresolved distance warning; Leave for now worked again.
- Screenshot `output/playwright/casualty-triage-review.png` shows the rendered battlefield, grounded casualty, released helper and accessible hold/retry controls at 1440×900. The compact-window `casualty-triage-retry-final.png` shows the controls immediately beneath the drawer heading. `casualty-triage-held-final.png` was captured before terrain reload settled and is retained but not used as the visual acceptance image. The initial `casualty-triage-decision.png` and `casualty-triage-held.png` record the buried-controls problem found and corrected during this pass.
- No player profile or existing player save was modified. Browser writes were confined to the new disposable `casualty-triage-qa` session.

- Final full simulation suite: **563/563 tests in 74 files**, 83.69 seconds. This includes the existing supplied 72-campaign-hour logistics/duty soak and exact speed/save-continuation checks; it is not a new long combat-balance soak.
- TypeScript, production Vite and rebuilt single-file HTML pass. The existing large-bundle warning remains. **5/5 packaging checks** pass.
- Isolated `FRONTLINES.html`, Edge with network disabled: actual movement controls, both embedded worker types, matching save/load hashes, no external network dependencies, no console errors, and full viewport after refresh at 1280×720 and 1920×1080. Evidence: `output/playwright/casualty-triage-offline-1790301408351/`. The tested copy and root artifact share SHA-256 `3ad943d952a67d3c9c4a419245d81d7c714f865c372ce960f57a7c1de56faa30`.
- The headed controlled-rescue session has zero console warnings/errors. Final existing Edge browser regressions: **22/22**, 47.2 seconds, covering normal controls, support weapons, contact markers, save/load, reserves and eight viewport sizes.

## Limits

The system does not guarantee rescue. A stabilization can succeed while evacuation remains unavailable; a critical casualty can die before help arrives. Pickup points and wounded people are not invulnerable. The existing logistics shuttles still follow their existing schedules; no ambulance dispatch, corpse-recovery system, aid-post feeding system or medical realism overhaul was introduced. Larger tactical triage choices and these distance defaults remain subject to player feedback. This pass does not certify a new 300/1,000-person benchmark or a prolonged combat soak.
