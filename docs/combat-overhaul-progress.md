# Believable combat implementation and verification

Status: integrated **local v3 combat preview**, rules `combat-22`. All six milestones have implementations and focused regressions. This is not final subjective acceptance, a historical hit-rate claim, or certification of every possible battle.

Production build: `index-BT4Y0-Ab.js`, `index-BJc43vhe.css`; 81 modules, 817.68 kB main bundle / 229.90 kB gzip. Build passes with the existing bundle-size warning. Latest complete regression: **320/320 tests, 52 files**, `output/combat-v3-regression-r10.json`.

No neural training, new automation, agents, publishing, purchases, cloud work, commits, destructive cleanup or changes to the user's 4173 browser saves. QA uses a separate headed Edge session at 4175. Original v1/v2 storage keys remain intact; v3 uses its own key. The initially untracked worktree and all prior evidence were preserved.

Handoff: separate Edge preview at `http://127.0.0.1:4175/`, left at the **Trench war** campaign-selection menu (`output/playwright/combat-v3-handoff-menu.png`). The owned temporary dev server on 4174 was stopped; the production preview remains available. The user can start fresh or load their own existing save on its original browser origin. Saved games are origin-specific; 4175 QA storage is not the user's 4173 saved campaign.

## Implemented milestones

1. **Physical small arms:** one seeded `ShotEvent` for ray/body intersections, injury, credible near-miss suppression, diagnostics, sound and visible endpoints. Finite terrain, earthworks, masonry, timber and tree-trunk protection; optical foliage/smoke attenuation. Ordinary-rifle range remains 360 m. Movement, poor observation, fatigue, suppression and unsettled aim worsen dispersion. No small-arms friendly injury.
2. **Human reactions and cooperation:** hysteretic under-fire/pinned/shaken/broken states; action ownership prevents duties, engineering, care and reactions overwriting each other. Player routes remain intentions, with local cover bounded to 12 m. Push through does not bypass pinning. M1, Kar98k, BAR, MG42, SMG and crew MG roles use carried rounds, magazines, reloads, setup and available crew. Stable moving/supporting groups require useful actual supporting fire.
3. **Defend Area and information:** drawn frontage near completed connected trenches, selectable facing/readiness, temporary network duties, sector alarms, reserve allocation, physical watch relief and shortages. Squad-local contacts and delayed report queues replace instantaneous shared targeting. Suspected sounds and aged last-reported areas do not follow hidden soldiers. Both commanders use reported information.
4. **Support and casualties:** smoke grenades, mortar HE and mortar smoke have separate physical stock, preparation/flight times and area dispersion. Explosive risk previews and warnings, pre-launch safety checks, real cover and explosive friendly injury. Roofed mortar positions cancel. Minor/disabling/critical/fatal wounds; timed first aid, medical kits, aid posts, carrying and two-stretcher shuttle evacuation. Serious wounds do not disappear through sleep/eating. Blocked rescues require an explicit retry; stabilized patients do not cause endless helper reassignment.
5. **Town and campaign:** common floor/door/window/stair/roof geometry, temporary firing positions, friendly cutaways and intact/damaged/ruined presets. Persistent scout/prepare/commit/reassess/consolidate/withdraw/recover enemy planning. New campaigns have 48 people per faction with the agreed roles. Finite 48-person reserves, max eight daily loss replacements, actual convoy/depot/shuttle arrival, and identity-preserving returns. Full rear depots return undelivered convoy cargo without destroying/importing it twice or indefinitely trapping personnel arrivals.
6. **Controls and presentation:** Move, Defend Area, Observe, Suppress Area, Assault and Fall Back; contextual Push through and engineering. Support/rescue controls, actual pause reasons, activity/weapon poses, synthesized combat audio and mute, responsive scrolling drawers, per-frame aligned labels, and first-contact speed reduction. Local matched replay loading/scrubbing/playback preserves the campaign and saved slot.

Save v3 includes wounds, weapons, reports, orders, structures, support missions, inventories, manifests and random counters. Old rosters/inventories/health are retained. Legacy injuries do not gain bleeding clocks. Rules changes are explained, incompatible neural policies visibly fall back to rules, and exact continuation is required only under identical rules.

## Accuracy and encounter evidence

`output/combat-balance-v3-r2.json` exercises the actual shot resolver: **10,000 shots per distance per condition**, 300,000 total, with daylight ideal, moving shooter/target, darkness, fatigue and suppression conditions. The shot model is unchanged by later care/building fixes. Wilson 95% intervals are recorded, not represented as historical statistics.

| Metres | Ideal hit rate | 95% interval |
| --- | --- | --- |
| 50 | 27.92% | 27.05–28.81% |
| 100 | 12.49% | 11.86–13.15% |
| 200 | 2.68% | 2.38–3.02% |
| 300 | 0.49% | 0.37–0.65% |
| 350 | 0.32% | 0.23–0.45% |

All point estimates meet the requested bands; the 200 m interval slightly overlaps the 3% boundary. These controlled tests use a flat, fully exposed target. Moving-condition fixtures apply the actual dispersion modifier, not a complete moving firefight. The older 20,000-shot geometric calibration is also retained.

The same report includes eight seeds of 8v8, 120-second stationary encounters at 50/200/300 m with real scenario weapon roles. At 300 m they produced 0–5 hits and 0–1 fatalities per encounter, rather than precision volleys. `ammoConsumed` is actual rounds used; the separately named pack-stock decrease also includes dropped recoverable cargo.

`output/combat-advance-v3-r2.json` compares eight matched road advances with the same force/world and a supporting three-person MG team either firing or withholding fire. Both progress and casualties are reported; a stationary surviving force is not scored as a successful advance. Support improved progress in all eight seeds but did not prevent every casualty. This is a bounded fixture, not universal AI/battle balance. Its rules-20 replays remain frozen; do not pool them with differently versioned runs as if they were one experiment.

Paired 120-second, one-second-snapshot replays:

- `output/combat-advance-v3-r2-exposed.json`
- `output/combat-advance-v3-r2-supported.json`

Use Developer / Performance → Review matched replays and load both. These are recorded state clips, not newly trained behavior. There is no clean pre-overhaul replay baseline; these are supported/unsupported comparisons, not an invented old-game/new-game proof.

## Campaign, persistence and actual Edge checks

`output/combat-soak-v3-r9.json`: **72.0067 campaign hours**, 96-person controlled home-line setup, eight documented wounds, a six-hour road cutoff, lethal-needs rules enabled for the test, and explicit hold decisions at emergencies. All **12/12** six-hour save/restore continuation checks match. Maximum ledger residue is approximately 1.7e-11. Three fatalities and three physically delivered replacements leave 99 identities, with 96 surviving identities; no duties end blocked over 120 seconds. A held blocked rescue remains an explicit decision, not a claimed successful evacuation. This is a persistence/logistics soak, not a 72-hour autonomous battle-balance acceptance test.

Actual Edge buttons, mouse, keyboard and screenshots were used. Developer state injection only sets up controlled scenarios; it is not presented as player input.

- Village assault/interior entry: `combat-v3-village-r1.json/.png`; six able occupants enter and two casualties remain outside. Upper-floor order, stair save/load, first aid and return to the ordered floor: `combat-v3-upper-floor-r4.json` plus `combat-v3-upper-floor-final-r3.json` and `combat-v3-upper-floor-final-r2.png`.
- Night contact: `combat-v3-night-r2.json/.png`; actual 5× returns to 1× on contact, with legible night presentation. This short capture verifies contact, not a completed night battle.
- Trench defense/alarm: `combat-v3-defense-r2.json/.png`; firing, pinning, threatened-area alarm and shortage display.
- Supply interruption: `combat-v3-supply-r1.json/.png`; truck stays blocked with its original manifest, inspected through Facilities & shipments.
- Rescue: `combat-v3-rescue-r3.json/.png`; treatment and stabilization, aid-post care and a carrier walking toward transport. Full carrying/vehicle/rear arrival and returning identity also have focused regressions. Do not call this browser screenshot a completed evacuation.
- HE danger cancellation, real HE launch, two smoke types and exact ammunition use: `combat-v3-support-recovered.json` and screenshots. The CLI returned early on the confirm dialog, but the actual UI script continued; the recovery record verifies only three subsequent missions and no shell fired at the cancelled unsafe target.
- Save/reload and 640×480, 390×700, 1280×800 controls: `combat-v3-save-layout-r4.json`, matching screenshots and label alignment within one CSS pixel after camera movement. No hiding/fading labels to disguise lag. The earlier blank captures were taken before rendering settled; later captures show the battlefield. Inspectors now avoid covering each other.
- Replay UI: `combat-v3-replay-ui-r2.json` verifies matched-time candidate switching, playback, exact return to campaign and unchanged saved slot. `combat-v3-replay-settled.json` and the `combat-v3-replay-*-settled.png` screenshots also verify the actual battlefield and centered squad after loading settles; both have 38 draw calls and no page errors. Earlier 700 ms captures were premature, not evidence of a permanently blank replay. Final-build performance measurements follow below.

## Performance

The expensive all-observer/terrain work was reduced through shared bounded terrain tiles, deterministic squad attention sweeps, geometric-query caching and spreading unchanged 50 ms simulation ticks across render frames. Fast-forward never increases the simulation timestep. Every measurement records real simulation advancement, not FPS alone.

Before optimization, the 300-person 5× sample had p95 36.5 ms and lost requested advancement. On build `index-a7Z_unGM.js`, matched-source 300-person scenes (six garrisons/four trucks) measured 6.2 ms at 1× and 12.2 ms at 5×. Rare spikes still occurred (133.7 ms max in that 5× sample). The separate 1,000-person stress scene measured 36.5 ms at 1× and 48.6 ms at 5×; the latter advanced only 30.85 simulation seconds in 20.02 wall seconds, **not real-time 5×**. See `output/playwright/combat-v3-*-r*.json`; final-build repeats below take precedence.

Final production build `index-BT4Y0-Ab.js`, actual headed Edge, five-second warmup followed by a 20-second animation-frame sample, no concurrent CPU-heavy checks:

| People / garrisons / trucks | Requested speed | Sample p95 frame interval | Maximum interval | Simulation / wall seconds | Result |
| --- | --- | --- | --- | --- | --- |
| 300 / 6 / 4 | 1× | 6.2 ms | 18.2 ms | 20.15 / 20.00 | Target met |
| 300 / 6 / 4 | 5× | 12.1 ms | 127.5 ms | 100.80 / 20.01 | Target met; occasional spike |
| 1,000 / 20 / 4 | 1× | 36.5 ms | 72.9 ms | 20.40 / 20.01 | Stress frame target not met |
| 1,000 / 20 / 4 | 5× | 48.7 ms | 85.0 ms | 29.40 / 20.02 | Stress frame target and requested speed not met |

Evidence: `output/playwright/combat-v3-300-{1x,5x}-final.json` and `combat-v3-1000-{1x,5x}-final.json`, with screenshots. All runs preserve the same source scene per population, record actual shots and complete state, and end paused. Table percentiles cover the complete 20-second sample; the HUD's shorter rolling percentile can differ. The 1,000-person 5× run achieves only about 1.47× advancement. The 300-person result is a measured local scene, not a guarantee for every map, browser or campaign state.

## Retained failures and limits

- Early full regressions: old first-contact speed expectations, aliased local-contact display, a renderer stub missing a height query, and a continuation timeout under concurrent CPU load. Repaired without increasing that timeout; intermediate reports remain.
- Early soaks found derived cover changing on load after care/transport movement. Cover now follows those owners; failed divergent states remain alongside the passing runs.
- Real upstairs QA found outside casualties carrying an *approach intention*, not actual occupancy; care misread that as being indoors. Fixed physical containment, mid-stair interruption, overlap escape, and repeated unreachable rescue assignments. Short early captures with helpers still treating are retained rather than relabeled as completed floor orders.
- A replay interval of 1.000000000000014 seconds incorrectly disabled playback. Timing now tolerates fixed-step floating-point residue, with focused tests. Failed browser probes and older images remain.
- Defend Area is currently anchored to reachable completed trench space, not an arbitrary open-field deployment painter. Buildings have simple presets and finite temporary positions, not detailed room-clearing/destruction. Smoke/weapon audio/art remain stylized; this is not a detailed projectile-flight/medical simulation.
- The 1,000-person stress target is not met. Broad enemy-plan balance over many unassisted campaigns, further map variation, sound/animation quality and the user's judgment of believability remain acceptance work. Automated results do not substitute for that judgment.

Architecture and checks followed the **web-game-foundations**, **three-webgl-game**, **game-ui-frontend**, **game-playtest** and **playwright** skills: deterministic simulation/render separation, shared geometry, measured advancement and actual Edge controls/screenshots. Built-in computer control failed to initialize; the existing Playwright Edge path was used instead.

Historical framing: terrain, incomplete knowledge, supporting fire and subordinate control are guided by [FM 7-10, Rifle Platoon](https://www.ibiblio.org/hyperwar/USA/ref/FM/FM7-10/FM7-10-5.html); the coordination difficulties described in [Busting the Bocage](https://www.ibiblio.org/hyperwar/USA/CSI/CSI-Bocage/) motivate caution about idealized perfect formations. Eight-person units are explicitly scenario forces. None of the calibration percentages are attributed to these historical sources.
