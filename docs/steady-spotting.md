# Steady spotting and grouped contacts

2026-09-24 · baseline `5771770` · rules `combat-31-steady-contacts-world2`

## What changed

The distant-squad sight scan previously checked the nearest soldier and a rotating second observer. It could drop a contact simply because the person who actually saw it was no longer sampled. The scan now retains that observer, without replacing the bounded scan with an all-to-all visibility pass.

Recognition starts a six-simulation-second tracking window. During that window a weaker signal can sustain an already recognized soldier only while the same awake, active observer still has a clear ray through largely open space. Normal recognition refreshes the window; weak tracking does not. Initial acquisition, engagement ceilings and per-shooter aim checks are unchanged. Both factions use the same rules.

Buildings, terrain and trunks still occlude sight. Dense foliage or smoke cannot be bypassed by the weak tracking threshold. Losing sight freezes the last observed position at the next scheduled scan (the existing staggered cadence is approximately half a simulation second). It does not follow a hidden soldier for six seconds. Last-known information expires after the existing 18-second memory period.

Enemy presentation now uses small muted-red contact diamonds, grouping observed positions within 45 metres of a stable observed anchor. No permanent “SPOTTED · headcount” labels, enemy roster numbers or inferred equipment icons. The anchor does not re-average whenever a different member becomes visible. Hollow dashed diamonds mean last-known areas; brief explanations appear on hover or keyboard focus. Confirmed casualties stop contributing contact symbols, but unseen health changes cannot affect them.

Battlefield symbols, operational-map contacts and uncertainty rings share that presentation readout. It reads observed coordinates only, not hidden squad positions. Labels still project on every rendered frame without camera-motion hiding or CSS position tweening. Clicking a contact for an order uses its displayed known coordinate, not the terrain behind the elevated icon; this also fixes a roughly 17-metre offset reproduced during Edge QA. Drawn routes remain drawn routes.

Save schema/storage keys are unchanged. Optional observer identity and tracking deadline are serialized and validated; old contacts without these fields remain valid. Rules identity advances to 31, with the existing visible migration notice. No personnel, inventory or player-profile save was added, deleted or repaired. The field manual and README describe the new symbols. A stale trench-assignment toast was also corrected: Hold retains the assignment.

## Verification and evidence

- Focused regressions cover retained observer rotation, bounded tracking expiry/refresh, no weak-signal acquisition, obstruction by buildings/ridges/woods/smoke, unavailable observers, faction symmetry, unchanged direct-fire recognition, exact tracking continuation across save/load, and invalid saved observer/deadline rejection.
- Presentation tests cover deterministic grouping, unchanged anchors during partial sight loss, hidden-position/health independence, casualty removal, expiry, and every-frame camera alignment. The browser regression checks hover-only text, hollow last reports, and exact order coordinates when clicking through the new symbol. Its contact fixture is explicitly synthetic; it is not evidence of natural detection.
- Final verification: **535/535 unit tests in 73 files** (72.15 seconds), **22/22 Edge browser regressions** (46.3 seconds), and **5/5 packaging checks**. This includes the existing supplied 72-campaign-hour loop-network regression and deterministic speed/save-continuation tests. Production TypeScript/Vite and portable single-file builds pass. The existing Vite large-chunk warning remains.
- Disposable headed Edge, actual controls, production preview on port 4175: continued the saved Open Front at elapsed 640.3, selected Baker, focused using the operational map, inspected contacts, and issued Suppress by clicking the actual symbol. The order retained Baker's trench assignment and exactly matched the displayed observation `(11.521596941288054, -341.9629267262018)`.
- Live 1× sampling advanced 15.05 simulation seconds in 15.06 wall seconds. There were 14–16 visible enemies, three grouped symbols overall, and one visible-to-lost transition. No weak-tracking-only frames occurred in this particular firefight; the six-second edge cases are established by the controlled tests, not claimed from this sample. No game state was injected into this manual playthrough. Browser console: zero errors/warnings.
- Isolated `FRONTLINES.html` opened in Edge with networking disabled, started both embedded worker types, accepted a real movement command, preserved exact saved continuation, and filled the viewport after refresh at 1280×720 and 1920×1080. No browser errors. Final artifact evidence: `output/playwright/spotting-final-offline-1790299619433/`; the earlier run is retained in `output/playwright/spotting-offline-1790299423509/`. The tested final copy and repository-root HTML have identical SHA-256 `43aea979d257597689f9c6eb4f36eff2a5a152aa33bc46714128b6ab3ea8f231`.

Local screenshots, inspected visually:

- `output/playwright/spotting-before-settled.png` — old numbered/counting labels.
- `output/playwright/spotting-after.png` and `spotting-after-hover.png` — same saved encounter, quiet symbols and contextual explanation.
- `output/playwright/spotting-live-15s.png` — actual subsequent firefight and correctly placed suppression order.
- `output/playwright/spotting-operational-map.png` — shared grouped map presentation.
- The existing browser regression's `grouped-last-report.png` — synthetic last-known state, dashed symbol and hover explanation.

The first screenshot was captured before camera easing settled and is retained separately as `spotting-before.png`; it is not the comparison image. An initial test fixture used `since` instead of smoke's `born` field; TypeScript caught it and the fixture was corrected before production build. The first browser pass exposed the contact-click offset; the final regression asserts exact coordinate equality rather than merely checking that an order exists.

## Limits

Real occlusion, an incapacitated observer, expired memory, casualties and groups physically splitting/merging can legitimately change what is displayed. This is not permanent enemy revelation or a new rifle-accuracy system. No fresh 300/1,000-person frame-time benchmark or broad combat-believability acceptance is claimed. The existing supplied 72-campaign-hour regression is a logistics/duty soak, not a substitute for a new combat soak.
