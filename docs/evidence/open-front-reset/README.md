# Open Front reset / player playtest delta 3

2026-09-29. Baseline: `914acc3e8ed8860e13b7d233fb3dc1dd6113bdce` (`master`).

**Validated implementation milestone; overall PARTIAL — PLAYER ACCEPTANCE NOT CLEARED.**
The player's original saves/screenshots were not available as reproducible runtime
states. Controlled causes below must not be substituted for those original incidents.
No player profile, save, previous evidence, DEV content or Endless world was removed.

## Delivered behavior

- Normal **New Battle → Open Front** creates a **2400 × 2400 m** world, **72/64**
  personnel, finite kit/stores and **zero prebuilt trenches/facilities**. Endless
  and Sandbox remain separate. Legacy mission choices are absent from this normal
  flow; old operations remain internally loadable. Terrain, roads, camera, map,
  navigation workers, construction and save validation use the actual dimensions.
- The enemy sends two tool-equipped formations to excavate a useful initial line;
  it does not receive finished earthworks. The same production work/material system
  builds its MG and subsequent support. Bounded connectors and new-line intentions
  use own deployment, public terrain and recent delivered reports. A lone scout
  cannot pull all workers forward. Old works and surviving stock remain physical.
- A rear objective now refers to the actual opposing depot. It requires **12 fit,
  armed people from two formations**, physical dispatch denial, an open road to
  their own rear and **180 continuous simulation seconds**. Clearing the depot or
  severing the attacker's connection resets pressure. Empty far-edge grass neither
  wins nor suspends dispatch. The actual conditions are inspectable in the HUD/map.
- Partial visual recognition keeps its legitimate observer between bounded scans.
  Awake, appropriately facing trench watchers get consideration without increasing
  range, bypassing occlusion or sharing hidden coordinates. Night, smoke, ridges,
  buildings, pinning and an uncovered sector still matter. Read-only sight
  diagnostics explain signal/LOS/attention limits; they create no player contact.
- At stand-to, critical weapon relief can draw on ordinary rifle watch after
  reserve/worker candidates. Explicit posts, other crews, medical tasks and critical
  self-care remain protected. A crew already in a valid sheltered firing position
  ducks there under ordinary incoming fire instead of taking a gratuitous generic
  cover step away. Pinning, breaking and critical care still interrupt honestly.
- Mounted/portable MG burst length is eight rounds, with 2.2/2.5-second burst gaps
  by weapon definition. Damage, dispersion, observation and finite ammunition remain
  authoritative. No MG-specific damage multiplier or target-centred suppression
  bubble was introduced.
- Visible small-arms cues travel from the actual muzzle along the authoritative
  resolved ray to its actual endpoint. Their short tails and 55–200 ms bounded
  visual travel preserve direction/cadence without a second projectile simulation.
  Unseen incoming fire shows only the final eight metres near a legitimate impact;
  fully hidden fire stays hidden. Impact presentation consumes the same arrivals.
- Abandonment terminates the old delivery and its destination/route/claims, leaving
  surviving cargo as a physical crate. A salvage job without a carrier does not
  hold another truck's delivery. Real rear contest pauses dispatch with cargo and
  loading progress intact, then automatically resumes when physically cleared.
- Support requests immediately select useful workers and create real material
  demand. Local reachable loose stock can be carried directly to the job; carriers
  use nearby legal trench exits/entries. Nobody gets remotely credited materials.
  Construction feedback separates worker approach, local collection, transit,
  physical blockers and actual work. **Trench excavation rates were not increased.**

## Reproductions and boundaries

| Issue | Evidence and status |
| --- | --- |
| Giant prepared Open Front / obsolete mission flow | **SOURCE CONFIRMED → IMPLEMENTED → BROWSER VERIFIED.** Fresh final build had 136 people, 2400 m dimensions, zero trenches and zero facilities. |
| Original daylight infiltration | **USER-REPORTED; original cause UNKNOWN.** A controlled two-trench fixture reproduced recognition decay between bounded scans despite legitimate daylight LOS. Nine observation tests cover the repair, concealment controls and saved partial recognition. The original gap crossing is not claimed reproduced. |
| Stand-to gunner departure | **USER-REPORTED; original transition UNKNOWN.** Controlled tests reproduced no relief when only ordinary watchers were available, plus a sheltered operator's generic cover step away. Physical relief and protected crew reactions now pass. Critical exhaustion without relief remains a truthful shortage, not immortality. |
| MG battlefield impact | **IMPLEMENTED / matched simulation VERIFIED / player acceptance OPEN.** The comparison below shows markedly lower exposed advance and greater pinning. It is neither a historical hit-rate claim nor a broad balance certification. |
| Crowded MG service area | **PARTIAL BROWSER VERIFICATION.** Two real handovers, ammunition fetching/delivery and combat ran in a 15-person position without sampled routes blocked over two seconds. This was not the original large through-traffic/resting pileup; its full acceptance remains open. |
| Abandoned-truck shutdown | **USER-REPORTED; original chain UNKNOWN.** A controlled trip retained its destination identity after abandonment. Clearing it, releasing claims and delivering B while salvage A lacks a carrier pass conservation/save checks. No claim of reproducing the player's entire army shutdown. |
| Construction startup | **Controlled causes REPRODUCED / IMPLEMENTED.** Empty new AI positions waited for local materials before creating the demand that could deliver them; a finishing team could also be lost to commander reassignment. Both are repaired. Player startup complaints may additionally involve genuine distance/tools/threat. |
| External carrier deadlock | **REPRODUCED during the maintained soak / ROOT CAUSE / IMPLEMENTED.** A carrier outside the graph could keep trying an obsolete entry across a support branch for over 1500 seconds. Blocked external hauls now replan from their actual position, preserving job, claims and cargo. The same 72-hour living-trench soak passes. |

Failed evidence is retained in `controlled-failures.txt`,
`crew-reaction-reproduction.txt`, `abandoned-trip-reproduction.txt`,
`ai-work-startup.txt`, `ai-work-followup.txt`, `full-regression-working.txt` and
`edge-regression-working.txt`. Initial failures are not hidden by the later passes.
Curated text copies remove terminal trailing whitespace only; original raw output
and failed browser artifacts remain untouched under `output/playwright/`.

## Measured controlled scenarios

### Construction

The nearby supplied explicit-work fixture assigned a worker on the first fixed
tick (**0.05 s**), received physically carried materials at **9.10 s**, and began
actual work at **10.40 s**. This is a startup check, not an altered dig-time target.
The remote AI site requested its MG at **71.50 s**, began work at **166.45 s** and
completed at **225.95 s** with both original work formations retained and at least
16 real material units consumed. The gap was actual collection/travel, not a
fictional instantaneous build. All inventory-balance components were zero.

### Matched exposed advance under rifles versus a mounted MG

Three seeds (1944, 81, 117), 240 fixed-step simulation seconds each, 16 identical
advancers, daylight flat approach, no return fire. Two riflemen versus one actual
two-person installed MG crew; 600 available defender rounds in each case. Production
observation, shots, wounds, suppression, reactions and movement ran. This deliberately
isolates the weapon difference rather than simulating a complete combined-arms fight.

| Aggregate / mean | Two riflemen | Mounted MG |
| --- | ---: | ---: |
| Crossed the first 100 m (48 possible) | 40 | 3 |
| Pinned person-seconds | 0 | 2594 |
| Mean advance per person | 140 m | 70 m |
| Shots / hits | 227 / 33 | 1333 / 42 |
| Casualties / seriously wounded | 29 | 37 |
| Reached the final 40 m destination | 0 | 0 |

The final-destination metric is non-discriminating in this fixture and is not
claimed as a demonstrated improvement. Per-seed suppression, exposure time and
early advance are in `mg-matched-tuned.txt`; the earlier baseline is preserved.
The unchanged rifle calibration and ballistics regressions remain in the full run.

## Actual installed-Edge playthroughs

Isolated QA profiles, production preview, seed 1944, eastward/daylight Open Front.
All orders, placement, facing, assignment, speed, saves and loads used normal
controls. Read-only snapshots/projections aided inspection and mouse targeting.
**No runtime setters, injected solved world, direct simulation stepping or player
save writes** were used for these playthroughs. Synthetic e2e fixtures are recorded
separately as regressions.

### Build, crew and sustain a position

1. Fresh 72/64 force and unprepared ground; drew a 50 m player trench and ordered
   Baker forward. Observations were sampled by **47.85 s**, and by **137.85 s** both
   original trenches were finished with **98 shots / 3 hits**.
2. Assigned Able, faced East, selected stand-to and placed an MG through the normal
   construction tool. Two workers were assigned immediately. The inspector showed
   **MATERIALS IN TRANSIT**, not fake construction while materials were absent.
3. Real trucks reached the forward point; real workers collected the load. At
   **372.10 s** the paid MG was 33% built. By **441.90 s** it was complete but correctly
   uncrewed/empty. **Staff crew** moved people to it; by **492.15 s** it was READY with
   two crew, 67 local rounds and actual firing. Save / refresh / Continue was exact.
4. Added Charlie to the same position (15 living assigned). During actual 5× control
   play, ammunition fell to zero, real deliveries restored it and two handovers
   completed: **[254,253] → [254,276] → [272,276]**. The first relief approached from
   504.5 s and was present by 608.1 s; the second began 604.55 s and completed by
   627.7 s. At **707.60 s**, the world had **989 shots**, the gun had 67 rounds and
   the position reported 12/14 watch, not perfect coverage. No sampled duty was
   blocked for more than two seconds. Critical meal/ammunition interruption was
   visible during the first approach; this is not uninterrupted 90% certification.

This first campaign was started on a working candidate and continued with the
final gameplay repair. Its already-saved enemy assignment is **not** evidence for
the corrected fresh two-team AI; that was independently repeated below.

### Fresh final-gameplay repeat

- Fresh start: 2400 m, 136 people, no works. Ordered the same 50 m trench but left
  the other player formations stationary initially. By **70.45 s**, the enemy
  trench was complete and eight contacts were known; none were known at 50.25 s.
  The player's line completed by **85.45 s**. This bounds first observation to
  50.25–70.45 s; it does not invent a more precise timestamp.
- Ordered Baker forward at **120.50 s**. First shots appeared in the
  **150.60–155.65 s** sample interval; **170.65 s** had 12 shots / 2 hits and real
  enemy MG construction. A stationary player did not receive an artificial
  opening volley or perfect long-range fire merely to satisfy pacing.
- Assigned Able to its completed trench, faced East and used stand-to. Both enemy
  builder formations remained assigned. By **228.05 s**, the enemy MG was complete,
  paid, crewed by two people, with 120 rounds. By **314.50 s**, 208 shots / 10 hits
  had occurred; the enemy had requested a separate unpaid mortar job. A finished
  gun is not claimed to have fired merely because ammunition is present.
- After the final rules-identity update, migration preserved the QA world's people
  and stock. Its first re-save updated the old policy-schema metadata; that-only
  difference is preserved in `browser-shipped-save.txt`. A subsequent current-rules
  Save / refresh / Continue at **170.70 s** matched the complete state exactly
  (`browser-shipped-save-repeat.txt`).

Timing/logs: `final-opening-second-pass.txt`, `final-opening-advance.txt`,
`final-enemy-mg.txt`. `final-opening-second.txt` preserves a diagnostic-script typo
(`s.garrisons` instead of `s.living.garrisons`), not a game exception. Other CLI
selector waits and earlier HMR-interrupted checks are retained in the raw output;
they are not represented as in-game failures.

## Persistence, release checks and limitations

- New setup marker `openFrontRules: 1`; global rules
  `combat-46-open-front-reset-world2`; unchanged v4 storage key. Known 4 km saves
  retain their original objective geometry, dimensions, armies and inventory.
  Unsupported combinations fail clearly without clamping. Prior v44/v45 needs
  migrations are not replayed; incompatible saved policy schemas visibly fall back.
  Exact continuation is promised within the same rules, not across a rules upgrade.
- Completed full gameplay run: **992/992 tests, 150 files, 474.10 s**. It included
  a passing 72-hour living-trench soak, saved combat/movement, 10 real attract
  cycles, current construction/vision/relief/stock regressions and legacy operations.
  Rules-version migration follow-up: **12/12**. Frozen final rerun is recorded below.
- Completed maintained Edge run: **35/35**, 5.7 minutes, including direct front
  direction, narrow/portrait/landscape controls, actual Locate seam, saving,
  support, assault participation and occupied traffic. The final-rules repeat also
  passed **35/35, 5.9 minutes** (`edge-regression-shipped.txt`).
- The final-rules full unit repeat, concurrent with Edge/build work, completed
  **992/993**, with the combat-speed/save comparison exceeding its unchanged
  **45-second timeout** at about 47 seconds. It did not report a state-mismatch
  assertion. `full-regression-shipped-busy.txt` is retained; this is a failed run,
  not relabeled as a pass. With QA renderers closed, the unchanged final source
  passed **993/993 tests in 150 files, 428.21 s**. The same combat-speed/save test
  completed in **31.206 s**, below its existing timeout. See
  `full-regression-shipped-quiet.txt`. No assertions or timeouts were relaxed.
- Production + standalone + separate DEV builds and packaging **5/5 PASS**.
  Existing bundle-size warnings remain. Shipped `FRONTLINES.html`: **1,507,999 bytes**,
  two embedded workers, SHA-256
  `455e35f0858f770bf5606a4e79337ff4ffb5cbb73bcb4cb1754ff09a50872080`.
  No simulation/UI source changed after this final build or these checks. The
  validated working-file bytes and staged standalone Git blob match.
- A copy of that HTML, with no adjacent dependencies, launched in installed Edge
  **with networking disabled**. Real movement and exact Save/Continue passed; no
  page errors; 1280×720, 1920×1080, 2560×1440, 960×540, 844×390 and 390×844 refresh
  checks filled the available viewport with reachable home actions/no overflow.
  See `offline-shipped.json`. Raw folder:
  `output/playwright/open-front-reset-shipped-offline-1790736143518/`.
- Early live 136-person profiling ran alongside verification processes and is not
  a performance certification. Physical-phone, 300/512/1000-person release workloads
  and complete new-Open-Front combat/logistics 72-hour soak remain **UNVERIFIED**.
  The maintained living-trench soak is not a substitute for those workloads.

### Short quiet performance sample

After the competing regression/build processes finished, measured the actual
continued 136-person battle in installed, headless Edge, 1654×910, balanced graphics,
camera distance 300, ordinary gameplay HUD. Twelve wall seconds per speed after
a half-second settling interval; requestAnimationFrame intervals, dropping the
first interval. This is a short hardware/browser profile, not broad certification.

| Requested speed | Achieved simulation speed | p95 frame interval | Median | Active personnel / total | New shots |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1× | 1.000× | 6.2 ms | 6.1 ms | 126 / 136 | 9 |
| 5× | 5.006× | 12.1 ms | 6.1 ms | 124 / 136 | 36 |

The tiny excess above 5× is fixed-tick/sample-boundary quantization, not a speed
claim above the setting. The view submitted 78–82 visible soldiers, about 713–720k
triangles and 114–116 draw calls. Hidden enemies still existed in the simulation.
There was no code/quality/fidelity change between speeds. Raw counters and sampling
code: `quiet-frame-sample.txt`. No native-window or physical-phone result is inferred.

### Still required for acceptance

An ordinary-player end-to-end rear attack/interdiction/counterattack recovery;
trench-versus-trench assaults and shifting/abandoned AI fronts over a long game;
matched busy MG through-traffic and sleeping/relief/ammunition behavior; the
original infiltration and abandoned-truck chains; save/continue during all those
combined late-game states; average reinforcement/delivery travel across seeds;
and the player's judgment of gunfire readability and MG dominance. Numerical
success, screenshots and this commit do not close those gates.

## Reviewed images

- [Fresh deployment](01-fresh-deployment.png)
- [Physical materials still in transit](04-physical-work-supply.png)
- [Built, supplied and crewed player MG](06-operating-position.png)
- [Stand-to combat and handovers](07-stand-to-under-fire.png)
- [Current main menu](08-final-main-menu.png)
- [Open Front briefing](09-final-briefing.png)
- [Fresh final-build advance](13-final-advance.png)
- [Final-build defended trench](14-final-defend.png)
- [Copied offline file, narrow refresh](offline-portrait.png)

Screenshots were visually inspected. They establish composition/state, not motion
quality or physical-phone performance. Previous failed raw artifacts remain under
`output/playwright/open-front-reset/`, including the preserved failed Edge report.
