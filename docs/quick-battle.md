# Quick Battle / Easy Setup

Implementation on top of Operations V2 (`c312f60`), September 24, 2026.

## Player flow

The initial field-order sheet asks for **Operation, Battle size, Your side, Map**. Breakthrough / Medium / U.S. / Random is ready without opening Advanced Setup. Start presents a concise situation, primary intent, optional terrain and actual force summary. Begin deploys the battle. No campaign save is overwritten until the player explicitly saves.

All four operations are available. Peaceful sandbox remains a secondary action. Weather, saved-map import, artillery, arbitrary force editors and difficulty modifiers are not exposed as pretend controls.

Size controls use real eight-person rifle formations, not claimed historical establishments:

| Size | Meeting / Open Front, both sides combined | Breakthrough / Defense, both sides combined |
| --- | ---: | ---: |
| Small | 64 | 80 |
| Medium | 96 | 112 |
| Large | 160 | 176 |

These are the standard composition totals. Balanced forces removes the attacker's two extra rifle squads. Extra engineers add 16 across the two sides; disabling mortars removes six. The largest supported configuration starts with 192 people, not 1,000. The menu computes the actual friendly/opposing counts and recommends 1× for Large. Existing 300-person all-speed performance limitations are not waived.

The side selector chooses U.S., German, or Random. Nationality controls existing rifle/automatic weapons and uniform presentation, independently of player/enemy command authority. It grants no accuracy, bravery or hidden-information bonus. Random side is resolved reproducibly from the selected/generated sector seed. A seed recreates terrain and mission placement with the same settings; the underlying 4 km landmark/road system is unchanged.

## Advanced settings and presets

- Battlefield: dawn/day/dusk/night, seed-derived or cardinal advance direction, standard/closer staging.
- Forces/support: operation-specific or equal rifle strength, one/two engineer sections per side, mortar teams, smoke ammunition.
- Logistics: standard/half supply; Open Front replacement pools of 0/24/48 per side. Finite operations do not offer replacement controls.
- Named presets: Standard, Balanced forces, Low supply, Engineer support, Closer approach. They populate editable options, not separate game rules.
- Up to twelve named local configurations, stored under `frontlines-battle-setups-v1`, separate from battlefield saves. Duplicate names are rejected; storage errors are visible. Enter in the preset-name field saves the preset instead of unexpectedly starting a battle.

Supply options affect both starting inventory and future scheduled manifests. Removed mortar/smoke support also removes corresponding ammunition from these sources. All initial changes are reflected in the conservation ledger. Shipments and personnel replacements still follow the existing physical delivery systems.

After-action and pause menus offer Rematch, Change settings and New battle. Rematch uses the resolved seed, side and settings, including originally random choices. Change settings restores that configuration. New battle resets to the simple defaults. Existing no-setup V2 and legacy saves continue using their original missions; their unknown custom setup is not invented.

The battlefield keeps the compact order bar, folded mission help and optional reports. The selected formation shows one priority warning when relevant: Pinned, Casualties, Low ammo or Supply shortage. Normal play does not gain a wall of numerical meters.

## Architecture and compatibility

`BattleSetup`, `AdvancedBattleOptions` and `OperationPreset` are configuration data, separate from `OperationRuntime`. Resolution freezes random choices before briefing. The shared force/deployment builder consumes a configured Operations V2 definition; no DOM/menu state enters the simulation. New scenarios serialize their resolved setup in the existing v3 operation envelope. Old saves without it retain original defaults and geometry.

Prepared sectors scale their usable capacity with force size. Existing objective evaluators, navigation, construction, support, logistics, weapons and enemy knowledge boundaries are reused. Meeting Engagement uses the configured starting combat strength for its effectiveness condition. Enemy operational knowledge uses the configured deployment depth, not the old fixed value.

The architecture/UI skills guided the configuration/runtime boundary and the field-sheet presentation: squared surfaces, restrained olive/paper colors, condensed headings, compact basic choices and a single Advanced fold. No unrelated combat, terrain-generation or simulation-timing rewrite was made.

## Verification and evidence

Local evidence is retained under `output/playwright/quick-battle/` (git-ignored). Browser checks use the isolated headed Edge session `frontlines-quick-setup`, not the user's browser profile. Screenshots were visually inspected, not just checked through DOM assertions.

- Focused matrix: 4 operations × 3 sizes × 2 sides × 3 seeds = 72 configurations. Each is created twice, checked for deterministic recreation, bounded/unobstructed deployment, correct force counts, traversable road access, truthful briefing and save/load after simulation begins.
- Final `npm test`: **58 files / 420 tests passed**, including the existing combat, engineering, inventory, legacy saves and 72-campaign-hour living-system soak regressions.
- Additional regressions: supported advanced extremes, real supply changes/conservation, weapon nationality, bounded total force, scaled victory, configured enemy deployment, exact same-engine continuation, rematch, legacy V2 saves, corrupted settings, local storage errors and progressive warnings.
- Production build passes; final runtime asset is `index-BRounS9R.js` and stylesheet `index-DovGRyRP.css`. The existing >500 kB bundle warning remains.
- `browser-release.json`: release-build default start, all four modes, both explicit/random side choices, seed, custom options, saved preset recall, rematch, prior settings, save preservation, exact load, invalid-seed rejection, briefing contrast and Escape back-navigation. All checks passed, with no page errors and 9.38:1 briefing body-text contrast. `browser-final.json` is the preceding successful run, retained separately. The automated two-click start including a briefing screenshot took 1.247 seconds, **not** a measured human usability study.
- Setup screenshots/layout checks at 1920×1080, 2560×1440, 1280×720 and 960×600; advanced sheets scroll without horizontal overflow. Start remains visible in the compact default sheet.
- `browser-live-final.json`: Large Open Front, 160 people, actual 1×/5× controls with measured simulation advancement, enemy orders, ongoing support/logistics, operational map and Build panel. Short 1920×1080 deployment samples measured 6.2 ms p95 and advanced 6.0 / 30.1 simulation seconds in roughly 6.01 wall seconds, respectively. This preceded only the final briefing text-contrast CSS adjustment. It is **not** prolonged mixed-combat or 300/1,000-person certification.
- `defense-result-r1.json`: actual fixed-step Small Defend the Line completed at 1177.05 simulation seconds, 301 shots / 1 hit, victory; ledger error below 1.6e-11. No battle-state overrides were used to obtain the result.
- `browser-result-release.json`: that completed state loaded through the normal Load control on the release build; after-action, rematch, Change settings, New battle and keyboard preset save all passed. `browser-result-r1.json` retains the earlier successful run. This is UI testing with a genuinely completed headless fixture, not a claim of a manually played browser victory.

Earlier screenshots, `browser-r1.json`/`browser-r2.json`, `browser-live-r1.json`, and `save-diagnostic-r1.json` remain intact. Final browser result files record the unique screenshot prefix and exact bundle identity.

### Issues caught during verification

1. Replacement conservation validation assumed every campaign started with 48 reserves. It now respects the configured 0/24/48 pool while preserving the old default.
2. Meeting victory and enemy deployment knowledge used the old fixed force/deployment definition. They now use the configured definition, with regressions.
3. JSON round-tripping normalized negative zero in cardinal geometry. New generation explicitly normalizes zero.
4. Node and Edge produced a handful of road coordinates differing by roughly 1e-13 metres. Byte-exact static-geometry validation rejected an otherwise valid completed save. Coordinate comparison now tolerates at most 1e-9 metres, preserves saved values, and still rejects changed topology, dimensions, objectives and meaningful coordinate edits. The rejected fixture/diagnostic are retained.
5. The first browser supply assertion expected untouched depot ammo after the simulation had loaded shuttles. It was corrected to account for depot plus loaded shuttle stock; the game did not refill or lose those rounds.
6. Screenshot review caught inherited dark-HUD muted text on the paper briefing. Scoped ink colors restore contrast; the real-browser probe now requires a minimum 4.5:1 body-text contrast ratio.

## Reproduction / acceptance boundary

Run `npm test` and `npm run build`. Use the existing browser probe runner with an isolated Edge session and unused evidence JSON paths. The three `qa-quick-battle*.cjs` probes create timestamped screenshot names. The result probe additionally needs `check-quick-battle-result.ts` output served by the local Vite development server on 4173; the game itself is checked against production preview on 4175.

The normal flow is complete and advanced controls affect real systems. Human judgment of speed/readability and battlefield balance remains separate. The earlier long unsupported-offensive fatigue/pacing concern remains; no hidden resupply, weakened enemy or altered fatigue rules were introduced to make the new menu appear successful. No neural training, automation, cloud spending, external publishing or user-save cleanup occurred.
