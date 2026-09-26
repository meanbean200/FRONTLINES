# Endless mode — first playable milestone

Status: **PARTIAL / EXPERIMENTAL**. This describes implemented behavior, not
acceptance of the whole persistent-war handoff. Starting identity was clean
local/remote master `7426ba7916daca38c070b6ba5af682a36483eada`; the attachment's
`20404c4` baseline is superseded.

## Playing

Choose **Quick Battle → Endless**. Operation remains a separate choice. Choose
the map seed, force size, reinforcement policy, pressure and day/night cycle.
Existing advanced equipment/supply options still apply. Current generated
sectors remain **4 × 4 km**, with **48 per side** in the medium preset; this is
not the unpassed 3-km/512-person milestone.

- **Finite:** the selected initial personnel reserve plus four finite off-map
  supply allowances per side. Each allowance contains the configured manifest
  and 30 fuel for the convoy. There is no external regeneration.
- **Replenishing:** loss releases at most eight every 180 simulation seconds;
  bounded rear manpower availability every 600 seconds and supplies every two
  scheduled delivery intervals.
- **Continuous:** loss releases at most eight every 90 simulation seconds;
  bounded rear manpower availability every 90 seconds and supplies every one
  scheduled delivery interval. This replaces losses, not additional armies.
- **Low / Standard / High pressure:** changes strategic review cadence,
  commitment fraction and loss tolerance. No accuracy, damage, ammunition,
  observation or hidden-knowledge bonuses.

Both non-finite policies first reconsider manpower at 90 seconds and supply
availability at 450 seconds. No batch is accumulated while paused or from real
wall-clock time. Actual truck loading remains separately scheduled. Reserve
authorization holds when deployed living people plus pending replacements are
at target; evacuated people still count as living. Initial reserve choices are
initial amounts, not a switch disabling subsequent non-finite replenishment.
No heavy weapons, tools or medical kits are regenerated with rifle replacements.

New people travel **edge convoy → rear depot → position shuttle → unloading**.
A moving squad without an assigned arrival network has replacements wait at the
rear. Assign/return it to a friendly position to receive them. The transport
readout explains this; nobody materializes in a moving squad or contested town.
Enemy regrouping formations reoccupy a nearby network only without a reported
threat, enabling the same physical delivery chain.

Every generated strategic settlement has physical capture/control. Ownership
changes update flags and map markers, never grant another cache or end the war.
The normal mission evaluator does not own an Endless battle. The HUD shows day,
town counts and optional reserve/policy information. Detailed recent control
history is collapsed in the pause menu, not permanently over the battlefield.

**Save & Exit** retains an active campaign for Continue. **End Battle…** requires
confirmation, stops this live battle and shows a no-victor record. It does not
delete or silently overwrite an earlier save. **Save record & Exit** explicitly
saves the concluded record if desired. Finite automatic exhaustion is deliberately
conservative: no living personnel, reserve or pending arrival for that faction.
Wounded/recoverable personnel and blocked shipments are not declared dead or lost.

## Runtime boundaries

- `EndlessController` owns mode initialization, history and end conditions.
  `OperationSystem` dispatches once to the corresponding outcome controller.
- `EndlessEconomy` owns off-map authorization, target-strength deficits and
  source/import accounting. Existing replacement, truck, stock and arrival
  systems own actual transfers. Returned cargo is retained, inbound cargo
  counts against rear targets, and no extra trucks/crates spawn per batch.
- `EndlessDirector` receives only the shared observation object, own-force
  summaries, known terrain and delivered reports. It persists probe, commit,
  hold and regroup state, target history and failed-approach cooldowns. It uses
  production tactical execution, not a separate scripted combat model.
- Calendar progression uses the selected 10/20/30-minute day. Physiological
  rates, rolling sleep credit and physical/logistics/replacement scheduling use
  their explicit simulation clocks. Existing saves without a setting retain
  30 minutes. Night preference/visibility can affect decisions; calendar is
  not a multiplier applied to work, ammunition cadence, truck speed or needs.
- The earlier nonlethal food/water rule is preserved. This milestone neither
  proves the original reported journey-death cause nor re-enables deprivation.

Schema 4 extends compatibly with explicit `battleMode`, options, target strength,
source/reserve ledgers, schedules, control history and director state. Missing or
incompatible Endless state is rejected, not inferred/repaired into a different
mode. Old Operations remain Operations, with no army/stock enlargement. Rules
identity is `combat-44-endless-controller-world2`.

This is a **player** `WorldSession`. Attract timers never reset it. The existing
authored title battle remains disposable and independent. Endless initial
conditions are not yet supported by the DEV preset contract; that loader rejects
unsupported mode fields instead of pretending the title preset is an Endless save.

## Bounded presentation versus persistent state

Recent control history is capped at 64 entries with independent cumulative
totals; the pause menu displays the latest 16. Endless renders at most 64 fallen
people from the last 300 simulation seconds, plus living personnel. Instance
capacity uses 64-person buckets and retired display positions are removed.
Authoritative people, death provenance, supplies and damage are **not deleted**.
Existing shot/effect, support and worker lifecycles continue unchanged.

This is **not** proof of fully bounded long-run storage/CPU: historical dead
records and arrived manifests still remain in simulation arrays, and nonempty
crates remain physical. Safe history archival, empty-container retirement and
structural/crater consolidation require further implementation and verification.

## Outstanding release gates

1. Secured town/position **Set Supply Point**, multiple active hubs, shared stock
   recovery and discovered enemy-vehicle interdiction. Existing finite cache
   transfer and trench logistics do not substitute for these interactions.
2. More sustained meaningful AI operations, reoccupation/recapture and support
   coordination under losses. This first director is not operational-AI acceptance.
3. Existing artillery reload/local ammunition, structural section damage/repair,
   construction pacing and control usability work.
4. DEV Endless initial-condition authoring and production preset integration.
5. Historical-state lifecycle work and a qualified 72-hour integrated soak with
   artillery, recapture and arrivals, followed by extended actual-control Edge
   playthroughs including interception/recovery. An incomplete soak stays partial.
6. 3-km/512-person standard, long-run renderer/worker/listener/frame/memory growth,
   achieved 5× measurements and physical mid-range-phone acceptance. No smaller
   fixture or desktop viewport emulation certifies these.

Evidence and failures are catalogued in `docs/evidence/endless/README.md` and the
implementation ledger. Player presentation/believability acceptance is still open.
