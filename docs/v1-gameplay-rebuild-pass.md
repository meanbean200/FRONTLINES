# V1 gameplay rebuild / player playtest repair pass

Starting commit: `4672ddfdd863bbbf036f10f7301404d65d62802c`. Clean checkout and identical remote master verified before changes.

## Scope and evidence standard

This is a substantial repair pass, **not V1 acceptance**. Tests, real-input browser checks, performance measurements and the player's judgment are separate gates. Unplayed paths are not passed.

Browser QA uses `scripts/qa-gameplay-session.mjs` with disposable Edge storage. Player profiles and saves were not touched. Gameplay actions use clicks, keyboard, drawing, menus and Save/Continue. Developer API calls read state, projection and timings only; they do not issue orders, create inventory, restore fabricated states or advance simulation.

The first checks used a headed Edge window. Background-window throttling later made 5× advance only approximately four simulation seconds in forty wall seconds. Subsequent checks used an isolated headless **Edge** process with background timer/render throttling disabled, importing the QA browser's own normally saved session. This is real browser input, but not physical display/input-latency or audio acceptance.

Local raw evidence: `output/playwright/gameplay-reset-1790375714910/`. Failed runs and snapshots are retained there. Selected portable evidence is under `docs/evidence/v1-gameplay/`.

## Reproduced findings and repairs

### Survival and movement authority

- Confirmed the building-order gap: needs advanced and packs depleted while building occupants were excluded from garrison supply duties. Added general self-preservation for people not being served by an existing duty. Ordinary rest and supply trips are staggered; critical needs escalate, but recent incoming fire and known dangerous routes prevent casual departure.
- An initial repair still failed in the **actual upper floor of House 21**. At approximately 3,150 simulation seconds the squad had critical needs and could not find a supply route. The ordinary formation navigator applied an eight-metre building clearance at the doorway. Individual supply navigation now uses person-sized clearance, a four-metre search grid and a doorway-anchored start. This is not an invisible inventory transfer.
- Browser continuation showed people leave via stairs/door, collect actual food/water, eat, and return to their reserved upper-floor firing places. At approximately 4,070 seconds six had returned and others were on another trip; all ten remained alive. Later continuation retained the building order through more routines.
- That normal Sandbox had lethal deprivation **disabled**, as before this pass. Alive headcount is therefore not evidence of a successful lethal-deprivation endurance test. The accepted evidence is physical replenishment, reduced needs and exact post/order return; lethality-enabled survival remains a separate gate.
- Supply travelers can rest when exhausted and resume their trip. A non-wounded exhausted person can use their own pack or stock within arm's reach; this does not heal combat wounds or move an incapacitated casualty.
- One action owner prevents building motion and self-care from overwriting each other. New explicit orders cancel the old temporary task. Away occupants retain their floor-space reservations.

### Fronts, construction and capacity

- Front state was not the only problem: cached aim could immediately turn a guard back after a new front command. A front change now invalidates stale watch/aim state; old unobserved aim is not authoritative. Real threats may still temporarily override facing.
- Through the UI, South/East/North/West produced arrived-watch headings of `0`, `π/2`, `π`, `-π/2`. The west standing front survived a branched extension, network merge and reload. The camera compass uses north `-Z`, east `+X`.
- Several engineer squads previously did not share physical output coherently. Work is now aggregated once per actual face, with stable project identity across queued branches. Tool carriers cut, ordinary helpers clear spoil, finite rows limit crowding, and additional labor has diminishing returns. Removing a team does not delete excavation or strand the helpers' project identity.
- Real-input Sandbox test: three newly placed eight-person engineer teams joined one five-part project. At 90 seconds the main arm had 14 digging and two approaching; another branch had two digging and six approaching. Save/reload preserved all three teams' project/branch IDs. By approximately 300 seconds all five new parts were complete. The final eight-section network was **621 metres, 224 usable places, one network identity**, not eight separate command entries.
- Workers in the earlier, long-running Sandbox really were sleeping/recovering. These states are retained, not removed to force construction. Readouts separate digging, clearing spoil, recovering, hauling, approaching and waiting. Support work with resting builders now says **RECOVERING**, not misleadingly **WORKERS APPROACHING**. This observation does not prove every previously reported frozen worker was merely asleep.
- Placed MG, rest dugout and field gun concurrently; eight eligible workers automatically staffed them and completed the works. In the defense operation, the field gun received four physical eight-material carrier deliveries and completed without hand-picking builders.
- Assignment formerly returned the same boolean for lack of space and inaccessible entry. `NetworkCapacity` now shares one connected-network reservation calculation between assignment, inspector and reserve requests. `AssignmentResult` distinguishes selection, unfinished ground, enemy ownership, capacity and route failures, without partially releasing people on rejection. Present count uses actual usable width, not a fixed three-metre cutoff. **The exact historical 72-capacity/24-assigned save was not supplied or reproduced.**
- Browser near-full case: a separate 30 m trench accepted eight engineers and showed **8 assigned / 9 places, 1 free**. Trying another eight left the existing assignment intact and reported **“Not enough floor space: 16 personnel + 0 inbound need 16 places; this network holds 9.”**

### Installed weapons and artillery

- Installed MGs retain ownership independently of personal equipment. Auto/manual crew selection now prefers nearby eligible ordinary soldiers, not people carrying a legacy MG identity. Empty positions retain the weapon.
- Reproduced a Sandbox ammunition bug: physical crew resupply was incorrectly conditional on an operation existing. Removed that gate; regression verifies ordinary crew fetching finite ammunition and returning without personal-weapon conversion.
- Renderer and ballistics now share mounted pivot/muzzle geometry. The operator is behind the receiver and the assistant has a separate point. Browser crew removal/replacement and empty-gun persistence worked. The complete low/side/rear **firing** visual matrix is still unaccepted.
- New construction offers a **single field gun (32 materials)** or **four separate field guns (128 materials)**. Each gun has its own actual work, crew, stock and position, with stable battery membership. Placement prevalidates all four before charging anything. The guns have wheels, carriage, shield, trails and a long barrel, not a scaled-up mortar tube.
- A field gun has a bounded forward traverse, physical ammunition, preparation/flight time and a larger danger preview. Battery orders address each ready physical gun; unsafe requests use the existing confirmation boundary. Internal `mortarHE`/`mortarSmoke` resource keys remain **abstract indirect-fire ammo units** for compatibility, not historical shell conversions.
- Defense playtest: build gun 390, ordinary Dog 03/Easy 06 crew, assistant fetches four HE/four smoke, READY, two player-ordered HE rounds. Each consumed one round and made one persistent crater. Save/reload retained both. A third player mission also consumed one round and made crater 432; screenshot `58` shows dust and all three craters approximately 0.76 simulation seconds after impact, **not the flash peak despite its filename**. Close carriage/crew and low-angle terrain screenshots were inspected. Audio was not auditioned and the player's judgment of impact weight remains outstanding.
- Deformation is deterministic, spatially bucketed and bounded at 512 records; nearby overlap deepens within limits and overflow merges damage rather than growing without bound. Terrain-height queries see the deformation; no general rigid-body physics was added.

### Information, missions, UI and performance

- Trench reconnaissance now observes exposed earth banks, not a fictitious crouched soldier down in the trench floor. Terrain, smoke, light, facing and fatigue still constrain discovery. Only observed sections are remembered, never hidden occupants/stocks.
- Expensive terrain-intelligence reviews are spread across five fixed-clock 0.2-second slices, completing one sweep per second. Two-of-three visibility rays terminate early. Replay counters/timing remain serialized and deterministic.
- Before-change defense evidence showed a lone scout approximately 267 metres ahead of the main body. Enemy planning now uses two reconnaissance formations and an advanced assembly before commitment, while keeping reserves and knowledge restrictions. The after run used a different seed: **it is not a matched improvement proof**.
- New mission-plan version 3 separates **Signal at the Orchard** (line + farmhouse + road), **Hold the Supply Road** (prepare/defend/repel actual attack), and **Race for the Hamlet** (two physical houses + access road). The meeting mission no longer demands an unrelated trench/delivery checklist. Existing version 1/2 mission saves retain their old plan/rules. Defense was actually played through construction, contact, casualties and artillery; all three were not played to earned outcomes.
- The operational map has position/local/full-sector scales, a command index, connected networks, actual support/supply/transport assets, remembered enemy ground, prepared orders and contextual Locate/Manage/WAIT/GO controls. Its source readout excludes hidden enemy facilities and stock. A real network selection showed 18 here, zero inbound, 51 free of 69; Manage opened the correct position panel. Enemy WAIT/GO controls existing is not end-to-end assault acceptance.
- Open Front seed 1944, actual reinforcement request: eight reserves left the map edge aboard convoy 365 by approximately 1.2 s, reached the rear depot at 40.1 s, boarded shuttle 367 at 201.8 s, then unloaded at the destination roadhead. Before unloading, the eight manifests reserved floor space without spawning soldiers. The UI showed the current transport stage, truck, destination and current-leg ETA; the 48-person pool fell to 40, with a shared next-day dispatch cooldown. All eight arrived as Reserve 1 without replacing other squads. Blocked/cancel/evacuee-return variants were not browser-tested.
- At 1024×600 the operational sheet, all four contextual controls and footer remained inside the viewport, with no document overflow. Visual inspection caught dark text inherited by the selected index row; an explicit foreground color corrects it. Wide and narrow offline viewport checks remain part of packaging QA.
- Reproduced camera explosion on reload: a visibility/load timestamp could be newer than an already queued animation frame, producing negative elapsed time and reversing exponential camera smoothing. Both the app and camera now clamp invalid/negative deltas. Sixty consecutive post-load browser frames stayed within world/zoom bounds, with both craters intact.

## Save compatibility and rule identity

Save version 3/storage keys are retained. Combat/simulation rule identity is **39**, invalidating incompatible learned-policy results rather than silently using them. No neural training was run.

- Old mortar positions without artillery metadata load as **legacy mortars**, preserving IDs, crew, resources, cost and flight behavior. This deliberately chooses the handoff's permitted legacy-load option instead of inventing an unsafe conversion or granting free artillery. New construction does not place mortar pits.
- Optional self-care, individual route, shared project, artillery membership and mission-plan fields are validated and serialized. Old people/positions/needs/inventory are not refilled or replaced. Missing optional behavior state initializes normally; no retrospective wound/deprivation is applied.
- Changing simulation rules cannot promise byte-identical continuation with the previous rules. Same-current-rules replay/save regressions pass.

## Performance evidence

Quiet, unthrottled headless Edge windows; eight wall seconds per row. These are frame intervals, not claims of physical display latency or universally stable FPS. No build/test process ran during the final quiet captures. The scenes are sequential observations, not perfectly matched before/after benchmarks.

| Browser scene | Sim seconds advanced | Mean / p95 / max ms | Inspector child-list mutations | Frames above 40 ms |
| --- | ---: | --- | ---: | ---: |
| Defense, 1×, inspector closed | 8.0 | 6.49 / 12.0 / 36.5 | 0 | 0 |
| Defense, 5×, inspector closed | 40.0 | 10.95 / **24.3** / 36.5 | 0 | 0 |
| Defense, 1×, inspector open | 8.25 | 6.55 / 6.3 / 30.3 | 63 | 0 |
| Operational map, intentionally paused | 0 | 6.08 / 6.2 / 6.6 | 0 | 0 |
| 52-person, eight-section worksite, 5×, construction panel open | 40.0 | 6.13 / 6.2 / 18.2 | 96 | 0 |
| Defense, 1×, third impact dust/debris decaying and craters visible | 8.0 | 6.27 / 6.2 / 36.4 | 0 | 0 |

**5× combat fails the 16.7 ms p95 target.** The inspector is throttled rather than rebuilt every frame, but still replaces content when its state key changes; 63/96 mutations warrant further incremental work. Quiet map/worksite results do not absolve combat spikes. The last row covers one impact's aftermath, not sustained firing or simultaneous batteries. Active continuous bombardment, 300-person and 1,000-person load matrices remain unverified.

An earlier deterministic diagnostic attributed a worst terrain-intelligence tick of approximately 102 ms to bank observation. After early exits and slicing, the unchanged 20-second replay test completed in approximately 16.4 seconds instead of timing out. Original failed JSON and diagnostic scripts are retained. This is a throughput diagnostic, not a substitute for the frame table.

## Automated verification

Earlier full run: 714/717 passed, with two obsolete mortar-label assertions and the replay timeout failing. Those failures are retained, not deleted. Labels were updated to the actual new field gun; the replay was optimized without increasing its timeout. A subsequent run passed 719/719; further small readout/capacity regressions were then added.

Verification ledger:

- `full-suite-release.json`: **720/721**, one replay timeout at 21.14 s while interactive browser QA was also running. No equality assertion failed; this still counts as a failed run.
- `npx vitest run --maxWorkers=1 --reporter=json --outputFile=.../full-suite-release-serial.json`: **101 files, 721/721 PASS**, 191.1 s total, replay 16.26 s under the unchanged 20 s timeout. Final selected-worker recovery/waiting copy also passed its focused construction test (20 tests across construction readout/support weapons).
- `npm run build`: **PASS**. 157 modules in the browser build; generated offline `FRONTLINES.html`, 1,309,226 bytes, two embedded workers. Vite still warns about the approximately 1.13 MB main bundle; no chunk-size claim is made.
- `npm run test:packaging`: **5/5 PASS**.
- `npm run test:launch -- FRONTLINES.html v1-gameplay-release-offline isolated`: **PASS**, no recorded errors or external network dependencies, real movement, both workers, save/load identical state hashes, refresh/menu/canvas filling 1280×720 and 1920×1080 without overflow. Evidence: `output/playwright/v1-gameplay-release-offline-1790380127769/` and the portable `offline-launch.json`.
- Final production-browser map at 1024×600: no document overflow; selected text `rgb(238, 241, 233)` against the dark panel after moving the pointer away. Final instrumented page/console error list and the original headed-run error list are empty. Some early headless continuation pages recorded page errors but did not attach console-error listeners; this is not a complete historical console audit.
- Offline SHA-256: `fda2191534e86ed707283c46158827ffcc38914d5b37a500e1af847f696d404e`.

Final release check: **default `npm test` (two workers), 101 files, 721/721 PASS**, 101.58 s total, replay 18.09 s. All owned QA pages were closed. Portable full results: [test-suite.json](evidence/v1-gameplay/test-suite.json); the failed concurrent run is retained alongside it as [test-suite-concurrent-failed.json](evidence/v1-gameplay/test-suite-concurrent-failed.json). No timeout was raised, assertion disabled, or failure evidence removed. The replay's small timing margin remains worth monitoring under CPU contention.

Coverage includes physical excavation rates for 1/4/8 workers, shared helpers and queued branches, tool removal/rejoin, local R exclusions, support staffing/recovery, cardinal watch headings, building floor return, finite inventory, installed ownership, legacy artillery saves, four-gun layout, shell flight/craters, network reservation/refusal, no-hidden-information boundaries, remembered trenches, existing WAIT/save/GO, and bounded projection/camera geometry.

## Acceptance status

This table is deliberately narrower than the requested final product. Functional code and a green fixture do not earn a browser PASS.

| Area | Result | Actual acceptance / outstanding gate |
| --- | --- | --- |
| Large trench construction | PARTIAL | Three squads completed the 621 m connected branched case after save/load; exact browser 1/4/8 matched-rate comparison and fatigue-plus-enemy-pressure combination remain. |
| Front orders | PARTIAL | Four cardinal controls and actual watch headings passed; west survived branch merge/load. Dedicated eat/rest/weapon-crew rotation matrix still incomplete. |
| Worker autonomy | PARTIAL | Three concurrent support works auto-staffed and built; real resting workers recognized. Under-fire interruption and full fatigue/resume browser cycle still incomplete. |
| Building survival | PASS, scoped | Reproduced House 21 failure repaired; physical trips, consumption and same upper-floor posts observed over extended play. General battle-danger/isolated-no-supply endurance remains a risk. |
| MG ownership / visuals | PARTIAL | Ordinary crew, remove/replace and persistent empty gun checked; Sandbox ammo regression fixed. Full firing/angles/clipping matrix not accepted. |
| Artillery | PARTIAL | One actual gun built/crewed/resupplied, three rounds and persistent craters worked; first two survived save/load. Four-gun battery firing, blast-peak capture and audio acceptance outstanding. |
| Trench capacity | PARTIAL | Eight accepted into nine places; another eight correctly refused with explicit counts. Reservation/route tests pass, but historical exact refusal and browser blocked-route/casualty matrix not reproduced. |
| Reinforcements | PARTIAL | Real eight-person request completed edge → convoy → rear → shuttle → unload. Disruption/blocked/cancel/casualty-return browser matrix incomplete. |
| Enemy AI | NOT YET ACCEPTED | Planning changes and information tests exist; no matched-seed behavioral improvement evidence. |
| Enemy-trench discovery | NOT YET ACCEPTED | Bank-sight tests pass; no completed legitimate-scouter browser acceptance. |
| Prepared attacks | NOT YET ACCEPTED | Existing deterministic regressions retained; three-squad discover → WAIT → save → GO → physical capture not completed in browser. |
| Operational map | PARTIAL | Real scale/index/network/Manage interactions and 1024×600 layout checked; enemy-planning flow incomplete. |
| Missions | NOT YET ACCEPTED | Three rebuilt rule sets tested; defense partly played. Three earned-outcome playthroughs not completed. |
| UI | PARTIAL | Compass, worker/position states, map and transport progression improved; full visual acceptance remains the player's decision. |
| Normal-play performance | FAIL target / PARTIAL coverage | 5× combat p95 24.3 ms misses 16.7 ms; missing continuous bombardment and large-population matrices. |
| Combined Big Position | NOT YET ACCEPTED | Large network, support works, building routines, front/save tested together peacefully; artillery/combat and reserves checked separately, not all combined under enemy pressure. |

## Remaining release gates / next actions

1. Finish a single combined Big Position under enemy pressure, including real reserves and all routines; retain failed runs.
2. Legitimately discover a trench and complete the three-formation WAIT/save/reload/GO/capture path.
3. Play all three missions to earned outcomes; use identical seeds for before/after enemy decision comparison.
4. Finish installed MG firing/close/low/side/rear checks and a real four-gun battery bombardment; audition audio.
5. Profile 5× combat spikes and incremental inspector updates, then run bombardment and 300/1,000-person matrices. Do not advertise stable 60 FPS from this pass.
6. Player review of clarity, visual quality and fun remains separate. No claim that V1 is complete.
