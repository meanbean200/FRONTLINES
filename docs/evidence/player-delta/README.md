# Post-fd1d269 player delta — 26 September 2026

Baseline: `fd1d26939fb51e71462247510297f620a015bd77`, clean `master`.
Overall **PARTIAL**. This is not a repeat of DEV/Endless/title delivery and is
not user acceptance. Campaign saves and earlier failed evidence are preserved.

## Implemented

- Calm M1/Kar98k dispersion reduced by a bounded 6%; movement, target movement,
  suppression, fatigue, night and unsettled aim still worsen the real shot.
  No hit-roll override or cosmetic-only tracer correction.
- MG acquisition/traverse continues during shot cooldown. The ordinary rifle's
  long-distance *between-burst* delay had also been applied to automatic weapons
  (13.5 additional seconds at 450 m). Automatic weapons now use their own much
  smaller distance penalty; setup, loaded ammunition and crew gates remain.
- Saved mount yaw rotates at 60 degrees/s, with no banked rotation during absent
  updates. A mounted shot waits for alignment; the same yaw drives its physical
  muzzle and gun rendering. Tests cover target changes and leaving the arc at
  1x/5x. The complete interactive left/right arc demonstration remains pending.
- Normal screen-space clicks select observed supply crates, town piles, casualty
  packs, trucks, depots, position stores and roadheads. Depot/roadhead boxes share
  their anchors/inventory with the picker. Installed stores are identified as
  assigned stock, not misrepresented as loose salvage. Hidden enemy contents stay
  unknown. Crate recovery sends one physical carrier load to the chosen position.
- Physical road occupation by an unopposed armed group blocks a truck; after
  eight continuous seconds an eligible cargo truck is abandoned. Its actual cargo
  becomes one recoverable pile, not a replacement or a remote credit. Passenger
  transports wait instead of discarding personnel. Both factions use the same
  physical check. This is a road-blockade abstraction, **not vehicle gunfire damage**.
- Truck geometry blockages retry a bounded road-graph alternative; unsuccessful
  trips retain cargo and `ROUTE BLOCKED`. Empty routes and moved roadheads cannot
  remotely unload. Abandoned trucks do not reserve their old delivery destination.
- A separate converging-waypoint defect was reproduced: both trucks could classify
  the other as ahead and queue indefinitely. Stable-ID right of way breaks that
  mutual wait while ordinary followers still queue. This does not establish the
  cause of the user's original stuck-truck screenshot.
- Recovery preserves personal ammunition separately from the recovered load;
  delivered ammunition is no longer silently retained as personal rounds. Source
  access is rechecked on arrival, and save/load preserves return-trip cargo.
  Full-store waiting and failed return routes retain carried cargo metadata without
  repeated pickup. If self-care or fire consumes cargo, the consumed amount is
  not credited as delivery or left as a phantom outstanding load.
- Runtime town control, outlines and flag labels share the control authority.
  In legacy Trench War, the old Saint-Martin flag/circle was 108 m south of the
  named town centre with a 43 m radius. The real town was outside it. Control now
  covers the settlement while physical stock/saved coordinates remain unchanged.
  Existing operational-mode zone geometry is preserved, not silently replaced.
- Version-4 saves remain compatible. Rules identity is now
  `combat-44-supply-interception-world2`; incompatible learned policies fall back.
  The previous rules migrate without repeating older survival conversions.

## Actual Edge playthrough (no solved-state injection)

To try the new controls: left-click a visible supply box/pack or truck at ordinary
gameplay zoom. Choose a friendly position as the recovery destination, then
**Recover supplies**. That position needs a fit available person; installed crews
are not silently taken. Each click dispatches one finite load. **Locate** centres
the inspected object. Assigned depot/roadhead stock is labelled separately from
loose salvage. To cut an enemy shipment, physically occupy its road with armed,
supplied personnel; an unopposed blockade lasting eight simulation seconds can
leave abandoned cargo. This description is the implemented behavior, not a claim
that the outstanding complete player interception playthrough has passed.

Isolated CLI-driven Microsoft Edge profile, production preview at port 4175.
New Endless battle created through Quick Battle controls: seed 1944, east-facing,
closer approach, low enemy pressure. Baker/Easy were selected on the operational
map and ordered into Saint-Martin through ordinary right-click movement.

1. Saint-Martin changed to **FRIENDLY CONTROL**, control 1, uncontested, at about
   259 simulation seconds. The physical flag opened the town inspector.
2. The inspector showed the actual finite stock: 32 food / 48 water / 240 ammo.
3. Save & Exit, refresh, Continue retained the captured town and its stock.
4. Initial recovery orders to sectors 1/3 failed with `NO ROUTE`. The raw browser
   observation was exported for a disposable headless diagnosis. The local
   8-metre grid exhausted its search budget on the long costly route despite a
   valid external path. A bounded 32-metre fallback now checks every metre of its
   edges against both terrain and trench banks. Portal width also now agrees
   with the movement rule. The generated-terrain regression covers both sectors.
5. After rebuilding/reloading, Recover dispatched carrier 291 from sector 1. It
   physically walked the full approach; stock did not transfer on the click.
6. After the assault squads withdrew, the enemy retook Saint-Martin. On arrival,
   carrier 291 reported `AREA NOT SECURED`. The 32/48/240 stock remained intact.
   This is a verified denial/recapture outcome, **not a successful delivery**.
7. A separate ordinary Sandbox run verified clicks on visible depot boxes and
   a truck, compact exact inventory/status, and desktop narrow/short layouts.
   These screenshots are desktop resizing, not physical-phone/touch acceptance.
8. The unchanged Road Cut title preset ran actual combat: 100 shots at 22.6 s;
   both mounted MGs consumed finite stock and had changing saved traverse yaw.
   This preserves title combat, but is not a substitute for full arc playtesting.

Screenshots: `saint-martin-secured.png`, `saint-martin-recaptured.png`,
`depot-inspection.png`, `truck-inspection.png`, `stock-390x844.png`,
`home-mg-live.png`. Additional working evidence, raw observed state and failed
test reports remain under `output/playwright/delta/` (ignored, not overwritten).

## Combat measurement

`scripts/verify-playtest-delta.ts` produces `combat-comparison.json`.
20,000 **paired seeded physical shots** at each distance, changing only the calm
dispersion multiplier (1.0 versus 0.94):

| Metres | Before hits / shots | After hits / shots |
|---|---:|---:|
| 50 | 5,515 / 20,000 (27.58%) | 6,015 / 20,000 (30.08%) |
| 100 | 2,414 / 20,000 (12.07%) | 2,701 / 20,000 (13.51%) |
| 200 | 517 / 20,000 (2.59%) | 566 / 20,000 (2.83%) |
| 300 | 109 / 20,000 (0.55%) | 122 / 20,000 (0.61%) |
| 350 | 53 / 20,000 (0.27%) | 61 / 20,000 (0.31%) |

Wilson 95% intervals are in the JSON. These are gameplay calibration, not
historical hit-rate claims. The independent 10,000-shot/seven-seed check recorded
3.14% at 200 m (CI 2.82–3.50%); it slightly exceeds the old nominal 3% band and
is retained, not hidden. The requested small improvement is not universal accuracy.

The same script runs actual 120-second 8v8 production encounters at 50/200/300 m,
four seeds, with rested/tired/suppressed/moving initial conditions. It records
shots, hits, ammunition expenditure, first hit, first disabling/fatal effect,
and final casualties. Conditions recover/react normally rather than being held
artificially constant. Moving formations close the range, so aggregate hits
cannot be read as stationary accuracy. At 200 m, rested encounters totalled
798 shots / 16 hits; tired 742/17; suppressed 682/19; moving 1,016/29. This small,
interactive sample is not proof of superior full-encounter outcomes. Raw null
times identify runs without an effect; they must not be silently averaged as zero.

## Verification / claim limits

Focused mount, shot geometry, control/recapture, carrier continuation, inventory,
visibility, road alternatives, failed routes, version-4 migration and policy tests
pass. Full regression/build/package results are appended in the implementation
ledger after the frozen run.

Preserved failures: initial 901/902 full run had an AsyncOrders 5-second timeout;
its isolated 8/8 retry passed without changing the timeout. A subsequent 904/905
run imported mismatched module versions while this pass was still editing the
renderer/shared pile helper; its isolated 20/20 visibility retry passed. Neither
failed run is replaced by a claimed green baseline.
The third 906/908 run exceeded long-test timeouts in the 72-hour living soak and
the 1x/5x combat-speed comparison while other heavy checks/browsers were running.
The isolated 38/38 living/reservation/recovery retry passed with unchanged limits.
A quiet serial full rerun follows, with owned QA browsers closed. These failures
are retained separately rather than discarded as presumed infrastructure noise.
That 907/912 run caught three real return-approach compatibility failures and the
new deliberately failing consumed-cargo probe; it also loaded the old truck module
before the converging-queue patch. Return failures were fixed without weakening
their assertions: preserve already-carried loads during failed routing and account
for consumed cargo. The unchanged return-approach tests and expanded recovery/queue
tests then passed together (15/15). The final frozen run includes those repairs.

Final frozen results: **912/912 tests in 134 files (399.48 s)**; **27/27 maintained
Edge checks (4.1 min)**; production/standalone and separate DEV builds; packaging
**5/5**. No assertion or timeout weakening. Network-disabled isolated Edge launch
also passed actual movement, both worker types, exact paused save/Continue and
six cold-refresh dimensions, with zero page errors (`offline-launch.json`).
Portable HTML: 1,448,892 bytes; SHA-256
`e1c63ac8d74bca830f5d69bed65d183a12dae0a7f0507e658bc9d32d88229e01`.

**REMAINING:** the exact user's Saint-Martin mode/save and stuck-truck screenshot
state are not supplied, so their original causes remain unconfirmed. Legacy town
offset is a separately reproduced defect; Endless capture/recapture is verified.
An operation without Saint-Martin as a capture objective is not converted into a
different mission. The complete normal-play interception → clicked cargo → secured
carrier → delivered friendly stock chain is not yet accepted. Repeated occupied
road/turn/control-change journeys, full browser MG arc checks, physical phones,
512-person performance, broader A–G soak and player judgment remain open.
