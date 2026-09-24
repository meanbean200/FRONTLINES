# Open-ended trench war, environmental visibility and cover

September 23, 2026. Direct-user implementation after the overnight deadline. The overnight heartbeat remains **paused**; this is not a new scheduled run. No neural training, agents, publishing or user-save replacement.

## Play it

Choose **Trench war** in the menu. This is an **open-ended, save-and-resume campaign**, not a 45–60 minute operation. Forty-eight troops per side start in opposing completed networks. Keep your command post and capture the opposing command post; holding both for 120 seconds wins. There is no countdown. The existing offensive, defense and peaceful sandbox remain available. New games do not overwrite your last saved game.

Use **Trench Command** to change readiness/front and inspect people or shipments. Under **Facilities & shipments**, choose a rest dugout, meal bay, supply store or ammunition dugout, then click 6–40 metres behind your connected trench. Right-click/Esc cancels. Assigned engineers must excavate the connection and do the work; delivered materials are charged once. Stakes mark a planned facility. Orders do not create an instant building or inventory.

Move orders still override autonomous routines. Enemy raiders use the existing contact-limited tactical commander; a separate campaign coordinator retains a home force, sends at most two fit rifle squads, and brings survivors back to their trench. Both sides have scheduled convoys, rear depots, shuttles and foot carriers. No infinite attackers, invisible ammunition refills or free reinforcements.

## Combat and defense changes

- Watch posts are spread over useful, forward-facing parts of the network, avoid entrances/junctions/facilities, and prefer an observable arc. Bank choice uses the commanded world direction, not the order in which a trench was drawn. Relief reservations remain stable; turning the front requires walking, not teleportation.
- The same deterministic tree sites and excavation clearance drive rendering and ray tests. Buildings/roofs, tree trunks and the actual heightfield block direct observation and bullets. Canopies and understory reduce visibility without becoming bulletproof armor. Rays are three-dimensional: a finite wall is not infinitely tall.
- Spotting depends continuously on distance, light, posture, movement/firing, facing, fatigue and suppression. Weak glimpses accumulate; strong contacts acquire promptly. Outer 800 m day / 350 m night bounds limit computation rather than guaranteeing sight inside a radius. A close soldier can remain hidden behind cover. Team contacts do not bypass the shooter's own line of sight.
- Rifles have a 360 m outer limit and gradually declining accuracy. Impact traces stop at physical blockers. The existing reaction delay, finite rounds, suppression, morale, combat alarm and actual casualty rules remain. Lost contacts expire after 18 seconds at their last observed position, not their unseen current position.
- Nearby shooting raises the existing temporary 90% watch alarm. Unfit people and physical travel can leave a visible shortfall; it does not silently teleport everyone to a firing position.

## Historical grounding and abstraction

The 1942 U.S. rifle-company manual describes mutually supporting defensive positions, observation, concealment and covered routes. That informed distributed watch posts and rear support connections. [FM 7-10, defensive combat](https://ibiblio.org/hyperwar/USA/ref/FM/FM7-10/FM7-10-3.html).

The Combat Studies Institute's Normandy study describes how bocage restricted observation, made fighting local, and required adaptation and combined arms. That supports separating concealment from physical protection and allowing close surprise behind intervening terrain. [Michael D. Doubler, *Busting the Bocage*](https://www.armyupress.army.mil/Portals/7/combat-studies-institute/csi-books/Doubler-Bocage.PDF).

These are design inferences, not a claim to simulate all WWII combat. The game's acquisition, shift, damage and range numbers are gameplay parameters, not values certified by those sources. Trenches are one chosen defensive setting, not a representation of every theater or combat style.

## Reproducible bugs fixed during the pass

1. A 7.2 m-wide corridor could classify an approaching soldier as inside before its narrower 3 m entry gate allowed crossing the lip. Entry/exit tolerances now come from the physical passage width. Added wide-trench regression.
2. A rifleman's bandolier incorrectly consumed his whole hauling allowance. Personal rounds now have bounded separate capacity; cargo still has a finite sack allowance.
3. Campaign starting cache stock exceeded capacity, and ammunition demand could crowd food/water out of a full cache. Starting manifests now fit; ammunition demand/reserve thresholds preserve room for ordinary supplies. Empty collection trips are not dispatched for a resource the carrier does not need.
4. Cancelled/captured-destination shipments could lose the intended unloading destination. Cargo now stays aboard and returns physically to its faction depot; it is not remotely deposited.
5. Taking an emptied enemy network retained defeated squad ownership, making the resulting save invalid. Reassignment now clears the old ownership; a captured-network save regression passes.
6. The first campaign raid could be assigned to protect an already-owned objective or time out before reaching the distant front. Campaign staging now selects an opposing/public objective and allows travel time, while preserving a home garrison.

## Automated verification and identities

- **267 tests / 41 files pass** (`npm test`, 62.81 s). This includes environmental solids/foliage/clearing/ridges, reverse-drawn and longitudinal defensive posts, wide entry, logistics capacity/conservation/cancellation/capture, campaign victory/no timeout, and exact saved continuation. Existing engineer queues, drawn orders, combat, migration, relief, recovery and UI contracts remain covered.
- **Production build passes** (`npm run build`). Main bundle `index-Di8rhtlq.js`, SHA-256 `3233333274a3cd4d4aaedb9a9bc9248ff48f27653997792038f2670644300b3d`; CSS `index-BO5w4NBj.css`; navigation worker `NavigationWorker-BM12tHBH.js`; ground worker `GroundWorker-vrDLnAQJ.js`. Vite still warns about the >500 kB main chunk (738.16 kB / 204.67 kB gzip).
- Rules **`deterministic-15`**, save version **2**, observation version **2**. Optional faction/supply/campaign/contact progress fields are validated. Old v1/v2 saves retain their established migration behavior; renderer objects are not saved. No model was trained or adopted.
- Current short-operation harness source hash: `22999d7a6fcee719191c6692a90966792074f7aba68d5bb5bca83e0a2cd27be0` (ordered TypeScript source plus harness). Source was not changed after the final simulation checks; later additions are verification scripts/docs.

### Campaign soak

`output/campaign-final-72h-2026-09-23.json`: ordinary campaign seed 1944, 0.05 s fixed steps, **5,405 simulation seconds / 72.0667 elapsed campaign hours**, starting at campaign hour 8. Status remains active; no forced emergency pause. This is an unattended simulation soak, not a human-played victory or difficulty assessment.

- 80 rifle shots, 36 hits; 80 active, 15 dead, 1 incapacitated at the endpoint. The player retains all 48 active soldiers; finite enemy raiding losses accumulate.
- Two-sided deliveries, night routines and completed automatic facilities continue. Maximum sampled inventory residual: **1.675e-11** units, numerical roundoff. No unexplained stock increase was observed.
- At 200 seconds, a serialized copy runs the same next 100 fixed steps; full states match exactly. Replay snapshots every 120 seconds are retained.
- Wall time 128.60 s; headless fixed-tick p95 2.917 ms, max 65.96 ms. These are **not browser frame percentiles**.
- Aggregate soldier-hours: watch shortfall 54.438, critical needs 24.953, blocked movement 13.654. This is not a claim of flawless routines or zero congestion. Both garrisons meet/exceed the endpoint watch target, but the enemy has an incapacitated survivor. Casualty care/balance and prolonged depleted-force behavior still need design review.

Earlier pilots are preserved: `campaign-pilot-2026-09-23.json` (wide-entry/raid issues), `campaign-pilot-entry-fixed-2026-09-23.json` (paused shortage from overfull/ammo-dominated cache), and `campaign-balanced-stores-2026-09-23.json` (48-hour intermediate confirmation). The final 72-hour file supersedes their success claims, not their evidence.

### Existing short modes

`output/campaign-rules15-short-operations-2026-09-23.json` contains actual headless simulation with intermediate save/load, finite inventory and three seeds. The offensive harness issues scripted objective orders; defense uses the starting deployment. All terminate, but their outcomes changed after the physical-sight/range changes:

| Seed | Offensive | Defense | Maximum absolute ledger residual |
|---|---|---|---:|
| 1944 | Victory at 374.00 s; 24 total deaths | Victory at 900.05 s; 41 total deaths | 1.10e-11 |
| 1945 | Victory at 334.10 s; 24 total deaths | Victory at 900.05 s; 52 total deaths | 9.10e-12 |
| 1946 | Victory at 340.95 s; 25 total deaths | Victory at 900.05 s; 45 total deaths | 7.28e-12 |

These are functional continuation checks, **not evidence that the game is balanced**. In particular, the untouched starting defense survives all three cases; an enemy that withdraws instead of attacking to annihilation can leave a long quiet ending. Do not compare these outcomes to older revisions as if rules were unchanged.

## Real browser verification

Headed Edge, isolated QA profile/origin `http://127.0.0.1:4174/`, 1440 × 960, Balanced rendering. User-facing 4173 and its saves were not automated. Actual clicks selected the campaign, launched it, opened support construction, placed ammunition works, cancelled another placement with Escape, changed speed, saved, reloaded the production build and loaded the save.

- `output/playwright/campaign-start-2026-09-23.json`: all eight startup/placement checks pass, including no instant construction and no enemy garrison selector.
- `campaign-live-check-2026-09-23.json`: fresh 28-second real play at 5×, no navigation/crash/page-error, campaign advances to 142.30 s. Earlier unexplained page return to menu is retained as a failed harness/live attempt; its cause is unconfirmed, not declared repaired.
- `campaign-ammo-construction-live-2026-09-23.json`: placed ammunition works survives actual play and Save at 293.05 s.
- `campaign-final-load-2026-09-23.json`: final production bundle loaded; paused saved state restores **exactly**, Escape cancels construction rather than opening the menu. After real play to 443.30 s, both rest dugouts are complete, ammunition work has charged delivered materials and its connector is being excavated.
- `campaign-combat-live-2026-09-23.json`: actual play to 593.30 s produces 18 shots, 11 hits, spotted contacts and a visible **COMBAT ALARM — 41/44 guarding**. The shortage is displayed rather than concealed. Screenshot inspected.
- `campaign-ammo-continuation-r2-2026-09-23.json`: after restoring the retained 743.95-second browser state, uncontended real-time 5× play reaches 869.20 s. The player-placed ammunition dugout **and its connector are fully complete**, paid from physical inventory; both rest dugouts are complete. Engineers resume duties after the combat interruption. World/speed/advancement checks pass. This is a replayed continuation, not an uninterrupted live session across the separate stress tests.
- `campaign-handoff-2026-09-23.json`: all three other modes launch via actual menu controls without touching the saved campaign; each Load restores it exactly. Final paused save is at 869.70 s. Completed ammunition works remains saved; ledger residual is below 1.60e-11. The 1024 × 768 menu scrolls vertically without horizontal overflow. Browser console: **zero errors/warnings**. Close-range and small-menu screenshots inspected; foreground foliage can still obscure a dugout, a remaining presentation limitation.

Screenshots with matching stems, including the menu, planned works, loaded front and active firefight, are retained beside the JSON evidence. A load-probe typo (`Load saved battlefield` instead of the real `Load saved campaign`) caused a 30-second locator timeout; it was a test error, corrected before the successful exact-restore check.

### Browser frame-time measurements

Each final row uses five seconds of warm-up and twenty seconds of actual `requestAnimationFrame` intervals. Simulation advancement is checked, not inferred from a speed button. No test suite, headless soak or training ran concurrently. Headed Edge, Balanced, same 1440 × 960 viewport. Reports and screenshots are in `output/playwright/`; generated probe source is retained alongside each performance JSON.

| Workload | Speed | p95 frame interval | p99 | Max | Simulation seconds in sample |
|---|---:|---:|---:|---:|---:|
| Live campaign, 96 people / 2 garrisons / 8 trucks, combat | 1× | 6.2 ms | 6.2 ms | 7.3 ms | 20.05 in 20.0001 s |
| Same live campaign, combat/relief and construction | 5× | 6.2 ms | 12.2 ms | 24.3 ms | 100.50 in 20.0059 s |
| Aged supplied 300-person fixture / 3 garrisons / 4 trucks | 1× | 6.2 ms | 6.2 ms | 66.9 ms | 20.10 in 20.0000 s |
| Same aged 300-person fixture | 5× | 6.2 ms | 6.2 ms | 12.3 ms | 100.50 in 20.0059 s |
| Aged 1,000-person fixture / 10 garrisons / 4 trucks | 5× | **170.2 ms** | 267.3 ms | 364.6 ms | **77.75 in 20.00 s** |

Files: `campaign-combat-1x-2026-09-23.json` and `campaign-combat-5x-2026-09-23.json`. These sampled shots from 25→36 and 45→54 respectively. Both meet the 16.7 ms p95 target in this workload; neither is a guarantee for every camera/army/network. At 743.95 seconds the player-placed ammunition connector is 92.48% dug, materials remain paid, and the facility is not yet complete—construction was interrupted by the actual combat alarm.

The 300-person rows (`campaign-rules15-aged300-1x-2026-09-23.json`, `campaign-rules15-aged300-5x-2026-09-23.json`) restore the preserved `output/deterministic-300-aged-final.json` at 600 seconds, then continue under current rules. They are **supplied living-garrison fixtures without an enemy**, not 300-person combat certification or a newly aged-from-birth rules-15 run. Both meet the p95 target, although the 1× row contains a 66.9 ms isolated hitch. No fixture or previous benchmark was overwritten.

**Invalid harness attempts retained:** the first `campaign-rules15-aged1000-5x-2026-09-23.json` overlapped a subsequent browser-state restoration, ending with 96 rather than 1,000 people. The overlapping `campaign-ammo-finished-2026-09-23.json` was paused by the previous probe and advanced zero seconds. Neither is a valid performance result or completed-construction claim despite its filename. The harness now explicitly records world identity, requested speed and positive advancement checks; uncontended repeats use new filenames.

The valid stress repeat is `campaign-rules15-aged1000-5x-r2-2026-09-23.json`, restoring the preserved `output/deterministic-1000-aged.json`. It keeps all 1,000 people and requested 5× but delivers only 77.75 of the expected ~100 simulation seconds. **The 1,000-person target fails**. This old aged living-garrison fixture exposes heavy simulation cost; it is not a 1,000-person battlefield with enemies. Further large-force routing/coordination profiling is deferred, not hidden by the normal-campaign result.

## Remaining limits and acceptance

This delivers a playable local campaign foundation, not all requested warfare systems. Trees/buildings/earthworks participate in direct-fire and observation cover, but **trucks, loose crates and dugout meshes are not general projectile collision objects**. Building proxies are conservative solids: no windows/interior gunfights, penetration, destruction or full ballistic arcs. Tree trunks are not yet navigation blockers. Visual tracers use ground-relative endpoints rather than a full projectile flight simulation.

No machine guns, armor/artillery, dynamic strategic front expansion, reinforcements, trained opponent, endless waves or new regions. The enemy can become too depleted to launch another fit raid; the player must take the opposing headquarters rather than wait for automatic victory. The campaign has scheduled supplies, but is not a complete economic/strategic war simulation.

One 72-hour seed and brief browser samples cannot certify arbitrary construction layouts, infinite sessions or large battles. Historical plausibility, routine quality, difficulty and whether the soldiers feel believable remain **the user's separate acceptance step**. Do not enable deprivation mortality merely because the logistics soak passed.

Next useful work is player feedback on frontline spacing and the raid/withdrawal rhythm, followed by targeted casualty-care and larger-force profiling. Do not add reinforcement waves or adopt a neural coordinator to disguise the measured limits.

22:53 UTC closeout: closed only the owned `frontlines-campaign-qa` browser and verified Vite preview PID 22792 on port 4174. The user server PID 35696 on port 4173 still returns HTTP 200, and the earlier separate Edge game session is left alone. QA saves, screenshots, valid/invalid probes and earlier evidence remain on disk. The production bundle hash is unchanged.
