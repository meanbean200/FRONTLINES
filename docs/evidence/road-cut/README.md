# Road Cut battle — 2026-09-26

Baseline: `a9c4a88`. Scope: make a usable home battle from the user's two opposing
trench-loop reference, stop further DEV expansion, preserve editable initial
conditions and old presets. The new active snapshot is
`road-cut-redoubts-a7f1c15a2458`; draft `content/scenarios/road-cut-redoubts.json`.

## Status and evidence

- **USER-REPORTED:** cannot change the defensive front; authored forces do not
  shoot. The screenshot labels both trenches friendly. The original unsaved
  layout was not available as a runtime reproduction; do not claim its exact
  no-fire cause was proven.
- **REPRODUCED / ROOT CAUSE (front control):** the trench preset had no front or
  readiness fields and instantiated both factions with front zero / routine.
  Facility facing existed separately. The schema now accepts optional front in
  degrees and readiness, applies them to the real garrison, rejects conflicting
  connected areas and preserves old defaults for legacy presets. A small existing
  inspector control plus selected FRONT arrow lets the user tweak the result.
- **IMPLEMENTED:** 64 people, two inward-facing completed loop trenches, two
  mounted MGs, two mortars, finite supplies, rear rest/aid, and patrols contesting
  the road. No simulation accuracy, spotting, damage or ammunition rules were
  bypassed. Existing preset files, saves, AI and session boundaries are retained.
- **SIMULATION VERIFIED:** first faction shots at 1.85 / 3.15 seconds; first MG
  crew shots at 6.85 / 11.95 seconds. At 20 s, 78 small-arms shots; 120 s, 228;
  240 s, 272 and 16 fired mortar missions. 27 / 31 personnel alive at 240 s.
  Every resource balances exactly, with zero imports. `complete-cycle.json` is
  the detailed production headless run, not an injected finished state.
- **AUTOMATED VERIFIED:** 34/34 focused tests in five files, 204.36 s, including
  ten unchanged-bound attract cycles. Checks include early fire from both sides,
  both actual mounted MGs firing within 30 s, mortar fire from both factions,
  conservation, immutable source, legacy defaults, validation and session disposal.
  Production/offline and separate strict DEV builds pass; packaging 5/5. Existing
  bundle-size warnings remain. The entire prior 890-test suite was not repeated.
- **BROWSER VERIFIED:** actual Edge controls imported the draft, edited its
  front, undid that edit, played and paused at 20 s: 78 shots, both MG stocks
  decreased, correct front angles, clean source, one owned session. The camera
  was moved through controls, captured, saved and published. Player home ran the
  same preset, with refresh/layout samples at 1920×1080, 1366×768 and 900×600,
  plus Sandbox → pause → discard/return with one fresh attract owner.
- **OFFLINE VERIFIED:** copied standalone HTML in an otherwise isolated folder,
  network disabled, actual Edge launch, both workers, real movement and exact
  paused save/Continue; six refresh sizes including narrow landscape and portrait.
  No page errors. See `offline-launch.json`. File: 1,434,138 bytes, SHA-256
  `c126a4c80643494e5bcaf79b0899ac63b25d413e481c76ed8d134aa7d5a70656`.

## Preserved failed attempts and limits

`first-battle.json` records four off-floor facilities in the initial draft.
Production corner smoothing was accounted for by placing those facilities on
the actual floor, not relaxing the validator. `headed-throttled.png` records a
headed QA window whose animation callbacks were throttled to about one per
second; headless Edge completed the live control-driven checks. A live-reload
interrupted an earlier diagnostic wait. These attempts are not performance
acceptance. Browser QA never advanced the simulation through a debug hook.

`home-1920-loading.png` preserves an early screenshot while terrain detail was
still streaming. Coarse `generatedChunks` counts are not proof of completed
trench-floor rendering. The final home script waits for rendered floor heights
to match production terrain on both sides of the chunk boundary before captures.

No physical-phone or performance claim; no new 512-person, 72-hour or broad A–G
acceptance. User judgment of the scene remains pending. Natural suppression and
finite ammunition can quiet a firefight; the normal attract reset handles that
without forcing fake shots. The existing DEV remains available to tweak this
ready-made base, but no new editor programme was started.

Reproduction: `scripts/qa-road-cut.ts`, `scripts/qa-road-cut.pw.js`,
`scripts/qa-road-cut-publish.pw.js`, `scripts/qa-road-cut-home.pw.js`, and
`node scripts/qa-file-boot.mjs FRONTLINES.html road-cut-offline isolated`.
