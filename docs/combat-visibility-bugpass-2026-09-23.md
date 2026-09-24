# Combat, human visibility and trench command — 23 September 2026

## Request and boundaries

The user explicitly requested stronger/readable combat, nearby trench alarms, entry at the nearest useful trench location, understandable garrison controls, and imperfect human visibility. Their clarification was “a bit of both”: enemies need spotting and individual rifles need their own sight line. This direct request extends the previous narrow bug/polish scope for this pass. No neural training, new tasks/agents, external publishing, spending or user-save changes.

Rules are `deterministic-10`; save schema remains 2 and observation schema remains 2. Optional aim/contact/personal-entry/drop-owner fields are validated. Old saves remain readable without retrospective damage. Historical study and operation evidence is preserved, not pooled into a new neural claim.

The Three.js guidance kept combat/observation/navigation in the simulation and poses/effects in rendering. UI guidance favored the existing compact DOM panel, explanatory language and a corrected narrow-screen layout. Playtest guidance required actual controls and inspected screenshots, in addition to headless assertions.

## Changes

- Rifle damage is 60 per actual hit (previously 28); two hits kill an otherwise healthy soldier. Cover reduces hit probability, not damage. Firing interval is 3.8 seconds plus individual/suppression variation. Aim acquisition takes time; tiredness, movement, morale and suppression affect shooting. Suppression slows movement and blocks firing when extreme; nearby misses also affect morale.
- Previous tracers always terminated on a body, including misses. Misses now scatter visibly. Instanced raised/carried rifles, brief muzzle flashes, hit tint and fallen bodies make outcomes more legible. Dropped personal supplies are small packs beside casualties, not boxes obscuring them.
- Day/night sight starts at 180/85 metres, then accounts for facing, energy, suppression, target cover and intervening forest. Sleeping observers do not spot. Buildings and ridges block sight. A team observation never overrides a shooter's own obstruction.
- Unobserved enemies, legs, weapons, flashes and carried/dropped packs are hidden. Incoming fire from an unseen shooter shows only its final short segment. Last-known squad markers stay at observed coordinates for 12 simulation seconds, then disappear. Terrain and objective information remain visible; this is not a full unexplored-map system.
- Actual nearby gunfire alarms a garrison even if the exchange involves unassigned troops. Fit sleepers respond, temporary target is 90% watch, and the chosen readiness returns after 30 quiet simulation seconds. Explicit orders/authorized withdrawal remain authoritative. Aiming guards no longer snap to the configured front between combat ticks.
- Non-hauling soldiers enter through the nearest reachable completed trench geometry, with a slower local entry movement. Unfinished excavation remains excluded. Personal entry coordinates survive saves. Supply carriers keep the established logistics entrance and validated pickup-return routes.
- Watch destinations favor nearby usable frontage, not the far end of the network. This exposed an aid carrier trying to touch a blocked centreline waypoint while already beside a patient; physical handover now accepts arm's reach only with a clear continuous passage. Patients who move away must be approached again before transfer.
- **Defend trench [T]** replaces the unclear command label. **Trench Command** explains nearby entry, watch/rest/food/supply routines and Move/H to leave. It opens for the newly assigned squad, highlights COMBAT ALARM, and reports casualties/suppression. Coordinator diagnostics are folded away. North/South labels now match the existing saved heading angles. The operation HUD no longer overlaps the panel at 920 px width.

## Automated verification

- **197 tests / 31 files passed**, 20.61 seconds with two workers. Includes the existing 72-campaign-hour loop-network soak, construction queues, speed/save continuation, inventory conservation, casualty recovery and all new entry/combat/visibility checks.
- Production build passed: `dist/assets/index-COOcp4KX.js`, 699.83 kB / 191.52 kB gzip. SHA-256 `cc70212e0dcd12a68467ecce700e1b382149cb499a12f6baf3028c5c15d7b82e`. Existing >500 kB bundle advisory remains.
- Final six actual-simulation runs: `output/combat-visibility-operations-r4.json`, source hash `f630feef4e92f674d18ddc5f46d1e63184923b002b01474f6494a9032176db3c`. Each performs a serialized mid-operation continuation. Maximum absolute resource ledger error is 1.1e-11.

| Seed | Offensive | Defensive, no repositioning |
| --- | --- | --- |
| 1944 | Victory, 353.95 s | Defeat, 326.30 s |
| 1945 | Victory, 333.70 s | Defeat, 281.80 s |
| 1946 | Victory, 342.00 s | Victory, 275.30 s |

These are bounded scripted checks, not difficulty calibration. Earlier r1–r3 results remain intact; r1 precedes aim-heading changes, and r4 includes drop ownership.

## Browser evidence

Isolated headed Edge session `frontlines-combat`, production preview 4174. The user's 4173 tab/profile was not automated.

- Ordinary offensive: roster selection and two actual right-drawn corridors, no synthetic positions. Victory at **458.85 simulation seconds**, **44/48 friendly troops able**, 410 shots / 59 hits. Its paused 230-second save was preserved and subsequently restored exactly. Artifacts: `output/playwright/combat-orders-r1.json`, `combat-offensive-result-r1.json`, result and mid-battle-load screenshots. This playthrough used build `index-DU8nvuiy.js`; subsequent changes repaired garrison aim orientation and casualty-pack rendering. Final build separately verifies exact loading and the affected behaviors below.
- Controlled night fixture: a 300-metre trench with the entry squad beside its far end. Through the ordinary **Defend trench** control, all eight enter locally within 45 simulation seconds, not via the remote supply entrance. `combat-entry-fixture-r1.json` records fixture provenance; `combat-entry-r1.json` records before/after states and unchanged isolated save.
- **Final production** alarm/firefight: real simulation firing, ordinary UI speed controls. First alarm reads **4/15 guarding**, showing the physical handover shortfall; fit sleepers wake. After 80 further seconds there are **52 shots, 17 hits, eight enemy deaths**. The firefight ends and the network returns to **4/4 routine watch with 12 asleep**. `combat-alarm-r2.json` and `combat-alarm-night-r2.png` / `combat-trench-firefight-r2.png` preserve final evidence. No damage or deaths were injected.
- Synthetic loss-of-sight check moves an enemy squad out of view to isolate information handling. All eight remembered coordinates remain exactly unchanged; the marker reads LAST SEEN, then expires. Final screenshot/DOM test at 920×768 gives HUD right edge 646 and trench-panel left edge 662 (16-pixel gap). Exact saved campaign restoration still passes. `combat-visibility-layout-r2.json`, `combat-last-known-r1.png`, `combat-small-layout-r2.png`.
- Legacy casualty snapshot visually checked on the final build: smaller recoverable packs leave the fallen bodies readable. `combat-casualty-packs-r3.png`. Unit tests also cover hiding older untagged drops and rejecting bad new ownership IDs.
- Final browser console: **0 errors / 0 warnings**. The focused night fixture reported p95 approximately **6.2 ms**; this is a small operation measurement, not new 300/1,000-soldier certification.

## Retained failures and limits

- First full regression run exposed the real aid handover stall. The existing recovery deadline was kept; it now passes. An old test forbidding all entry from inside a trench loop was replaced with the intentionally changed nearest-entry/no-teleport contract. New save-version assertion expects rules 10.
- New test mocks initially returned an object/undefined where obstacle queries return boolean; production type checking caught this and mocks were corrected.
- Browser harness dynamic import/require were unavailable inside its VM. `run-browser-probe.mjs` now records returned evidence outside the VM. An initial drawn corridor through town was correctly rejected; screenshot retained, and the successful route goes around the buildings.
- The ordinary offensive's 45-second wait expired just before victory; a later snapshot captured the actual result. A follow-up Pause lookup failed because the result menu had already opened. Neither is represented as a successful wait.
- Exact screen-transform string comparison initially failed on a 0.001-pixel camera-damping change. The corrected loss-of-sight check compares all observed world coordinates exactly; screenshot values retain the tiny projection difference. No movement/visibility assertion was weakened in the simulation tests.
- No full panic, surrender, morale-driven retreat, machine guns, weapon ballistics or trained opponent. Gunfire alarms are visible readiness changes, not an audio siren. Individual tree trunks are not sight/movement colliders; forest is area concealment. Combat tuning and believability remain the user's acceptance decision.
- Existing mature 1,000-soldier performance failure and browser asynchronous-navigation timing remain open. Further work should stay on reproducible bugs/playthroughs, especially mixed combat/logistics traffic and extended garrison combat, with no neural training under the narrowed scope.

The original heartbeat stop boundary remains 21:45 UTC on September 23, 2026; it has not been extended.

Cleanup at 20:16 UTC: final asset identity and exact paused Load were rechecked; console remained clean. Closed only owned QA session `frontlines-combat` and verified preview PID 6204 on 4174. User Vite PID 35696 on 4173 still responds HTTP 200. No source changes followed the passing production build; only QA scripts and documentation changed.
