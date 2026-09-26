# World session ownership and living home screen

## Ownership

`WorldSession` owns one production `BattlefieldSimulation`, its world/RNG state, an abort lifetime and its navigation planner. Kinds are `player`, `attract`, `editor-test`. Only an active player session can call the campaign-save capability.

The player app retains one render host, camera and UI. A narrow stable simulation port forwards their references to the current owned simulation, including terrain, garrison network and construction systems. A switch disposes the old navigation worker, pending callbacks and lifetime before installing the new session. Late callbacks check disposal/generation. Terrain render jobs have independent IDs; resetting the host detaches the old job and old chunk ownership, so stale geometry cannot be applied to the new world.

Render components clear previous unit interpolation, trench instances, transient objective/impact identity and truck interpolation. They do not become save data. Existing saves remain under the existing v4 key; no editor/attract save key aliases it.

## Attract mode

- Loads the published `ScenarioPreset` with the shared deterministic constructor.
- Uses the production commander for both factions, with separate faction report inputs and memories. Spectator rendering may show both sides; it does not change their knowledge.
- Real fixed 50-ms steps, finite initial manifests, real crews, real small-arms/support resolution. No scripted contact, cosmetic-only gunfire, unlimited supplies or player-campaign backdrop.
- One authored camera; menu owns pointer/keyboard/wheel/touch. Gameplay HUD is hidden and audio is muted by default.
- Fresh instantiation on victory/defeat, 240 simulation seconds, or 60 seconds without firing after first contact. No in-place resurrection or refilling.
- Hidden documents/context loss suspend stepping and clear accumulated time; no return-to-tab catch-up burst.
- Missing/bad title data reports an error but leaves normal menu workflows available. The fallback is an empty generated sector, never the player's campaign or old Sandbox.

## Transitions

Quick Battle / Operations leave attract mode before creating a preview. Begin creates/retains the independent prepared player world; Continue loads a saved campaign. Returning home asks **Save and return / Discard and return / Cancel**. Save failure retains the live player session. Confirmed return closes it and constructs a fresh attract session. Continue subsequently loads storage, not a hidden suspended player world. The ordinary pause menu still pauses the real player session.

## Diagnostics and acceptance

`__FRONTLINES__.getSessionStats()` is read-only: kind/generation, owner and planner counts, render-host and terrain-worker count, entities and WebGL memory. `__FRONTLINES_DEV__.inspect()` is also read-only and exposes source/runtime separately for test evidence.

Automated checks cover deterministic instantiation, strict initial-condition schemas, no source residue, save-capability rejection, idempotent disposal, stable forwarding ports, repeated ownership changes and faction information isolation. Real Edge acceptance and any failures are recorded in `docs/v1-combat-artillery-mobile-pacing-pass.md` and its DEV/menu evidence directory. Automated tests are not player acceptance or physical-phone verification.

## Endless player sessions

Endless is an explicit player battle mode, not an attract configuration. Its
controller has no four-minute/inactivity reset. Save & Exit closes the player
owner and opens a fresh attract owner; Continue restores the saved Endless
world. End Battle records a concluded player world without resetting it into
the title preset or silently deleting the earlier save. The Endless evidence
directory records actual Edge save/exit/refresh/Continue checks. This extension
does not recertify long-duration worker/GPU growth or physical phones.
