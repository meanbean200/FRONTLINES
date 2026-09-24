> Superseded by the September 23 deterministic-garrison brief. This is historical evidence, not current certification. See [current acceptance](deterministic-garrisons.md). The study is stopped; no neural model was adopted or installed.

# Living trenches: implementation and acceptance record

## Play

The starting field trench now has a 28-person garrison including engineers. Select other squads and click a connected trench's capacity label, or press **T / Garrison**. Hold and drawn movement orders remove those squads from autonomous duties immediately.

Expand **Living Garrison** at the upper right to set readiness and front direction, inspect supplies and shipments, select an individual soldier, and choose a coordinator. Rules remain the default. Neural choices are experimental and visibly fall back when a compatible model is unavailable. Priority numbers are scores, not human-like explanations.

One campaign day is 1,800 simulation seconds (30 minutes at 1×). The simulation uses 20 fixed steps per real second. Speed multiplies simulation time, not policy training. Watch targets are 25%, 50%, and 90%; routine shifts target two campaign hours with named relief handovers.

The support network uses an entrance cache, temporary floor rest, engineer-built rest/meal/store dugouts, and connecting excavation. Initial inventory is an explicit manifest. Later resources enter only with map-edge deliveries. A convoy feeds the rear depot, shuttle trucks travel the southern road to forward caches, and soldiers carry cargo to their garrison. Actual arrivals drive transfers; inventory is conserved through save/load and cargo drops.

## Ownership and modules

- `src/garrison/TrenchNetwork.ts`: completed corridor graph, junction/overlap splitting, traversable portals, components, routing, and deduplicated usable-floor capacity.
- `src/garrison/GarrisonSystem.ts`: stable temporary duties, reservations, local movement/yielding, watch relief, support works, emergency authority.
- `src/garrison/NeedsSystem.ts`: campaign-time needs, consumption, recovery, incapacitation and death.
- `src/garrison/LogisticsSystem.ts`, `Inventory.ts`: physical trucks, cargo, manifests and conservation ledger.
- `src/garrison/GarrisonPolicy.ts`: one observation/action contract shared by rules, learned, and bounded hybrid priorities.
- `src/learning/`: frozen ONNX inference in a dedicated single-thread WASM worker. No in-game training.
- `src/render/LivingRenderer.ts`: instanced logistics and cutaway facility visuals. Rendering does not own inventory or duty state.
- `src/ui/GarrisonPanel.ts`, `ReplayPanel.ts`: compact inspection and local matched-replay review.
- `src/persistence/SaveSystem.ts`: v2 snapshots, validation and non-destructive v1 migration.

Legacy local-storage saves remain under their original v1 key. Migration initializes needs and the initial logistics manifest at migration time, with no retrospective starvation. Saves do not contain renderer objects or network weights.

## Automated evidence

`npm test` currently includes 51 passing tests across seven files. These cover the original movement/earthworks behavior plus crossings, reversed and offset overlaps, unfinished connections, loops, capacity, a new junction without teleportation, readiness targets under understaffing, full-duration watch relief, stable temporary watch anchors, retiring surplus alert posts, relief from rested sleepers, exhausted-helper self-care, order interruption, carried meals, half-rations, withdrawal resupply, physical aid delivery before recovery, gradual deprivation, recovery/death, retained blocked cargo, emergency pause, malformed neural actions, stale worker replies and model identity, non-destructive migration, and exact state continuation through travel/work/rest/deliveries and an aid trip.

`npx tsx scripts/verify-living.ts 72` exercises the actual fixed-step simulation for 72 campaign hours. The supplied 48-soldier branching-loop fixture completes all three support facilities, has zero deaths, and conserves stock within floating-point tolerance (largest residual 1.63e-11). No soldier finishes this fixture with a long blocked route. It still records 13.504 watch-gap person-hours, 11.013 critical-need person-hours, and 173.711 blocked person-hours accumulated across the force; zero deaths does not mean frictionless routines. This is one reproducible soak, not proof that every possible trench layout is deadlock-free. Raw data: `output/living-v3-soak.json`.

Twelve previously failing development scenarios also finish with zero deaths after the `living-3` repairs. They are development regressions, not fresh held-out evidence: `output/living-3-preflight-3.json`. The separate neural comparison uses new test seeds. Failed earlier attempts remain preserved.

Browser measurements are in `docs/living-performance.md`. Subjective readability and believability are separate from these checks.

## Replay review

Open **Developer / Performance → Review matched replays**. Load the study's `replay-*.json` files together. Move the time slider and switch candidate to compare the same snapshot index. Review pauses the campaign, never overwrites local-storage saves, and **Return to campaign** restores the original in-memory campaign.

Replay files are local artifacts. No uploading or external publishing is required.

The long-run recordings are intentionally sparse snapshots. The additional `motion-clips/` folder contains matched quarter-second states over a two-minute night interval, including an early watch handover. **Play motion clip · 1×** animates those recorded states; it does not run a live neural policy. Motion capture is checked against the original study host at every five-second observation and requires an identical final simulation state. Always check the clip receipt is `completed` before treating its files as verified evidence. Closing the reviewer stops playback and invalidates outstanding file loads.

## Explicit limits to verify before treating this as a finished campaign

- Combat and machine guns are deliberately absent.
- Logistics currently use the southern road corridor, not a general multi-road routing system. Out-of-fuel trucks retain their cargo but have no dedicated towing/refuelling mission.
- Capacity uses a conservative half-metre scanline union of usable floor, including offset overlap; it is a spatial estimate, not an exact CAD polygon union. These cells are not soldier slots.
- A small supplied soak does not certify large, congested, or isolated garrisons. Demand, finite carrier throughput, and supply cutoffs can produce genuine shortages.
- The neural study uses 24- and 48-soldier fixtures and short bounded training runs. A completed script is not an adoption decision or proof of sufficient training.
- Unassigned reserve squads have no autonomous logistics organization; their deprivation is nonlethal until assigned to a garrison. Explicit orders still override garrison routines.
- The replay reviewer, not a reward score, decides whether routines look believable.
