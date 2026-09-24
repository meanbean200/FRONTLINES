# Historical deferred-systems list (superseded)

This records the scope before the living-trench implementation. Connected navigation, needs, routines, facilities and logistics are now implemented; see [the current acceptance record](living-trenches.md). Combat/machine guns, general road routing, towing and larger-scale optimization remain separate work. The original planning text follows unchanged.

The current pass is limited to engineer reliability, construction performance, linear trench capacity and precise drawn movement. The following are not implemented or represented by placeholder UI.

## Remaining foundation priorities

1. Connected trench topology: junctions, multiple entrances, shared/deduplicated segment capacity, entry/exit traffic and branch routing. Crossing two drawn lines currently does not create a routable network.
2. Distance-based simulation LOD with deterministic scheduling, more extensive crowd/corridor arbitration, and multi-thousand-soldier measurements. The current pass is not evidence for that scale.
3. Richer order feedback for blocked construction access and persistent task queues that can be inspected, reprioritized and cancelled individually.

## Later logistics and soldier routines

- Model supplies as inventories at sources, depots, carriers and receiving formations; shipments physically move and have explicit destinations and shortages.
- Soldier consumption should reference those inventories. Eating, sleep and fatigue need time-based schedules and constraints, not decorative animations.
- Squad watch rosters need minimum staffing, shifts and interruptions by orders or threats.
- Machine-gun teams require crew roles, ammunition supply, firing arcs and suppression/cover rules. Add them only once those combat rules and logistics boundaries are defined.

The simulation remains the source of truth. Keep renderers and UI as views; do not embed the above systems into visual effects or the main application loop.
