# Orders and earthworks corrective pass

Historical plan for the preceding corrective pass. Its fixed-frontage capacity and future-routines notes are superseded by [living trenches](living-trenches.md); its engineering/movement regressions remain relevant.

Scope: complete complex engineer jobs, remove construction frame hitches, replace fixed trench slots with linear capacity, and support player-drawn movement corridors. Supplies, supply chains, eating, sleeping, watches and machine guns remain future work.

1. Cache immutable polyline metrics; queue engineer jobs, resume incomplete works, validate the whole excavated route and follow its working face.
2. Allocate continuous trench frontage at 2.5 usable metres per person. Reserve capacity atomically across squads; report used/total capacity and compute cover from physical position.
3. Draw movement routes with right-drag or the Draw path command. Preserve bends, follow in narrow columns, preview active routes, improve soldier picking and cancellation.
4. Offload terrain meshing, update only changed chunks, cap visual refresh work, cache screen geometry and reduce overlay/shadow churn. Profile the same digging workload before and after.
5. Regression tests for complex completion, queues, capacity release, drawn bends, cancellation, save/load, and malformed routes; actual browser input plus visual checks.

Baseline: local Chromium 1440 x 900, 64-control-point trench under construction at 5x: about 37 FPS, 73 ms p95 interval and 24.6 ms CPU frame time. Main-thread CPU profile is dominated by terrain sampling/meshing, with repeated layout reads also visible.
