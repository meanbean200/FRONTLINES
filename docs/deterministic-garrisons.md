# Deterministic living garrisons — current acceptance

The September 23 replacement brief supersedes the neural-learning study. Gameplay now uses deterministic need scores and hard staffing constraints. Checkpoints and failures are preserved, but no model is installed or loaded, and no training is running or scheduled.

## Implemented

- Completed-excavation graph, deduplicated usable-length capacity estimate, temporary destinations, physical approach queues and body avoidance. Wide/narrow junctions test the corridor union, not only the nearest centreline. Cached interior routes are invalidated by affected component. Exterior approaches avoid trench branches and enter through the entrance; inaccessible sealed-field assignments are rejected.
- Campaign clock: 24 campaign hours per 1,800 simulation seconds. Energy, hunger, thirst, health, morale, sleep/watch history and carried stock. Sheltered sleep recovers faster than floor sleep; unbuilt dugouts give no shelter benefit.
- Staggered five-second duty coordination, shared job summary, readiness targets and physical guard relief. Service allocation ranks needs rather than soldier IDs. Distant consumers first approach a queue rather than reserving a loading berth throughout their journey. Guards can receive physical ration deliveries and take timed on-post breaks; eating does not also earn watch coverage.
- Finite day packs, timed consumption, physical aid delivery and recoverable dropped cargo. Deprivation deaths are OFF by default and explicitly opt-in through the campaign checkbox in Living Garrison. Mortality tests explicitly enable damage. This setting is saved and cannot be changed during replay.
- Scenario-configured manifests and capacities; scheduled map-edge convoy, rear depot, three shuttles, forward stocks and personnel hauling. Overflow remains aboard the carrier. Dispatch considers food/water and construction shortages; ammunition is accounted without invented combat consumption.
- Trench/facility requests share construction service and work application. Engineer queues accept trench or facility references; direct orders clear them. Automatic support works use assigned garrison engineers and rearward connectors no longer than 40 metres.
- Compact readiness/supply/needs display, support-request buttons, individual reasons, logistics overlay, real-activity poses, night lighting, v2 persistence and non-destructive v1 migration.

## Evidence and remaining gates

`npm test`: **78 passing tests across eight files**, including all original 18 regressions. `npm run build`: passes, with navigation and ground-meshing workers. Vite still warns that the main bundle exceeds 500 kB (649.47 kB / 175.58 kB gzip); download size is not claimed optimized.

Tests cover overlap/loops and incomplete connectors; capacity and exterior-wall routing; complex construction queues; full-store producer/consumer queues; meal duration; on-post consumption and delivery; sleep, relief and alert interruption; direct-order authority; incapacitation/aid/death; inventory conservation; and exact continuation during travel, sleep, aid, construction and shipments. V1 migration preserves the old key and initializes safe needs without retrospective deprivation.

`output/deterministic-300-soak-r6.json`: **300 assigned soldiers, three looping garrisons, four trucks, 72 campaign hours with lethal deprivation enabled.** Zero deaths, zero emergency decisions, maximum resource residual **1.18e-11**, no final blocked or stationary travel duties over 120 seconds. The longest observed travel stall was **8 simulation seconds**, with at most 14 route waypoints. This is one supplied scenario, not a universal proof.

Watch gaps: **148.429 person-hours**, including assembly and timed ration breaks; critical-need exposure: **98.769 person-hours** (hunger/thirst above 90 or energy below 10); yielding: **109.351 person-hours**. Critical exposure is not zero and should not be presented as ideal routines. There were **12,299 job changes across 300 people over three campaign days**, maximum 71 for one person. Retained post-GC heap grew from approximately 9.7 MB to 10.9 MB as facilities and inventories came online, then stayed around 10.7–10.9 MB; serialized state remained about 0.32–0.33 MB after warm-up. RSS around 360 MB includes runtime reservations.

Source fingerprint for that run: `46b2555fb306c223cce301e4d96b8c0b90c1307430dfd3a968c5335a6fc7acf8`. Historical living-2/living-3 measurements do not certify this revision. See [performance methodology and results](deterministic-performance.md).

`output/deterministic-default-soak-r6.json`: the actual 224-person starting scene, with **28 assigned garrison members**, also completed 72 hours. All 28 remained active, all three support facilities completed, no deaths, no final stalls, longest travel stall **4 seconds**, inventory residual below 1.72e-11. An earlier 224-second idle-parking stall was reproduced and fixed by accepting nearby usable berm floor rather than insisting on an exact point.

**Do not interpret that default-scene result as a supplied 224-person camp.** The other 196 reserves were left holding without autonomous logistics. Their finite packs ran out and they became incapacitated; they account for most of the 8,710.632 critical-need person-hours in that test. Reserve troops must be assigned to supplied garrisons. Deprivation death damage currently applies only to assigned garrisons, as the UI states.

Browser functional check at campaign 21:20: 7/7 watch, 18 physically sleeping, two hauling and one eating; completed rest and meal facilities, supply store in the engineer queue. Night cutaways and the compact panel were inspected in `output/playwright/living-dugout-night.png` and `living-garrison-panel.png`. The opt-in mortality control was toggled both ways and returned to off. Browser console: zero errors and warnings in that check. Visual believability is not inferred from these mechanical checks.

Failed runs remain in `output/`. They exposed shared loading targets, ID-biased reservations, long-distance berth claims, full-store unloading deadlocks, bad wide/narrow corridor tests, imprecise avoidance waypoints, external paths crossing branches, guards outlasting their water, and a chained-relief mutation crash. Repairs have focused regression tests. `deterministic-300-soak-current.json` is a **failed intermediate revision despite its filename**, not the final acceptance result. R4 has a separate failure receipt because its old end-only writer did not capture the crash state.

The revised multi-garrison fixture starts its already-assigned personnel inside completed trenches. The former fixture used open-field squad formations, including soldiers inside sealed loops without access to the entrance. These are different initial conditions and are not pooled. Exterior assembly and inaccessible assignments have separate regression coverage. New soaks record source hashes, retained heap, serialized size, job counts, largest routes and measured travel stalls rather than relying only on a resettable blocked counter.

## Boundaries

Combat and machine guns remain deferred. Trucks use the southern road corridor rather than arbitrary multi-road routing. Out-of-fuel cargo is retained, but dedicated towing/refuelling missions are absent. Unassigned reserves obey player orders without autonomous garrison supply organization. Capacity is a conservative spatial estimate normalized to usable length, not exact CAD polygon union. Visual believability remains a separate user acceptance step.

## Repeat

```powershell
npm test
npm run build
node --expose-gc --import tsx scripts/soak-garrisons.ts 300 output/new-soak.json
```

Soaks refuse to overwrite prior evidence. They explicitly enable lethal needs and acknowledge emergencies with hold-and-ration for measurement; that test policy never makes emergency choices for the player in normal gameplay.
