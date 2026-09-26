# FRONTLINES DEV — battle setup authoring

This is a separate entry/build, not Sandbox or Quick Battle's settings presets.

## Launch

- Double-click `FRONTLINES-DEV.cmd`, or run `npm run dev:author` in the repository.
- Open `http://127.0.0.1:4176/dev.html` in Edge. Keep the local server running.
- `npm run build:dev` creates the separate `dist-dev` package. The player build does not include its controls or filesystem writer.

## Make a battle

1. **All content → Document / folder** contains the preset name, file identity, folder and AI/human controllers. These settings are collapsed by default, not permanent battlefield panels.
2. Choose a generated terrain seed. The current production generator is 4 × 4 km. Terrain, buildings, roads, forests and elevation are read-only; this tool does not claim the pending 3 km/512-person milestone is complete.
3. **Draw trench**: drag a line, or click successive points and press **Finish trench** / Enter. Completed trenches use the production excavation geometry. The inspector can mark a trench planned/impassable instead.
4. **Select / move**: click an item or choose it from All content. Drag trench control points to reshape; Branch, Extend, Duplicate item, Delete and Undo/Redo are available. The inspector reports production-network capacity, not invented editor slots.
5. Select **Formation**, choose faction/equipment/personnel **before clicking the terrain**. The default is eight riflemen. Choose an initial target/trench in the placement panel, or select a placed formation and use **Pick target on map / Assign trench on map**. The inspector shows faction, type, count and grid position; selected links connect to the target, trench and crew weapon. Per-person ammunition/food/water is real finite stock. Original formation identities are preserved.
6. Place positions/facilities **on completed trench floor**. Choose the installed MG, mortar or field gun, facing, real crew formation and finite stock. Draw a support branch first if you need more usable floor. **Snap to parent floor** explicitly repairs a post after reshaping its parent; invalid layouts are never silently changed at load.
7. Place finite stock, objectives and staging areas. Loose crates are recoverable stock; use a facility on the faction's trench for controlled stores. Choose one of **three** honest intentions:
   - **Advance / contest:** the production commander maneuvers toward the target/objective. Contact and needs may interrupt it.
   - **Guard target:** seeks nearby protection around the target; reacts to threats and needs. This is not an immovable sentry.
   - **Remain here:** no commander movement orders; still observes, fights and manages needs. Assigned trench/crew duties remain active. This is not a distinct reserve planner.
   Legacy `probe`, `support`, `reserve` presets still load, respectively as advance, guard, remain. They are no longer offered as six apparently different behaviors. A weapon assignment takes priority over independent movement; Guard does not invent a separate supporting-fire controller.
8. Pan/rotate/zoom to compose the shot and press **Set opening view**.

WASD/arrows pan, middle drag rotates, wheel zooms. Escape cancels a drawing gesture. Source editing is disabled during Play Test.

Dense formations and posts use compact map symbols. Select one to display its
full name, or use the always-named **All content** list to distinguish nearby
crews, weapons and facilities. Selection draws above other authoring marks.
An already-selected marker takes priority when dragging overlapping crew/weapon
marks; select the desired name in All content first.

## Editing and validation

Edit mode owns lightweight production **geometry**, not a live simulation or a
WorldSession. Moving a marker, typing a name or changing a setting does not
instantiate armies, reset terrain or start a navigation worker. Dragging previews
the item locally; release commits one undo step, Escape discards it. Static
authoring overlays perform no DOM writes. A terrain seed change deliberately
regenerates terrain; Play/Stop deliberately crosses the production-world boundary.

**Validate** aggregates footprint/obstacle, unfinished-floor, off-trench facility,
opposing-network ownership and connected-capacity issues, plus crew/ammo/target
warnings. Select **Locate** to inspect a named issue. **Snap to trench** is explicit;
the editor never silently relocates your post. Validation does not claim a complete
navigation proof. Play Test still performs the final production assignment checks,
and a rejected start retains the intact author document.

## Save, reopen, duplicate and test

**Choose folder…** opens the browser's directory picker from an explicit click. If unavailable, use Import / Download, or the explicit **Use project content folder** option on the local author server. That option shows the exact fixed `content/scenarios` destination; it does not grant arbitrary filesystem access.

- **Save** writes the selected preset identity, without publishing it.
- **Load** reopens an identity from the selected folder; Import accepts a chosen JSON file.
- **More → Duplicate** makes a new identity/file. Existing duplicate names are rejected.
- Failed/cancelled access or writes leave the document intact and dirty. Download makes a copy; it does not pretend a project-folder save succeeded.
- A damaged or unsupported title catalogue is rejected, not overwritten with an empty list. Failed native writes abort their writable stream.
- **Play Test** instantiates a fresh production world. **Stop test** returns to the unchanged author document; **Reset** recreates its initial conditions, not the battered test world. Playtests cannot save campaigns.
- **More → Reset test** recreates the test; **More → New setup** asks before clearing the author document. A newly started Play Test runs at 1× even if the previous test was paused.

Native folder access requires a secure context and user activation, and is not available in every browser. See [MDN's directory picker constraints](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). The local project-folder fallback is DEV-server-only and requires an explicit selection. Static DEV builds retain native-picker/import/download support, but not the local server writer.

## Use for title screen

For the first title scene, keep 50–100 people, both factions AI-controlled, at least one objective, valid trenches/posts and finite ammunition.

**More → Use for title screen** validates the production world, writes a runtime snapshot under the selected content folder's `published` directory, then updates `catalogue.json`. Published snapshots have content-derived filenames. Draft Save cannot modify the active published snapshot.

Choose this repository's `content/scenarios` folder to update this game. Publishing to a different folder does not magically change another repository. Reload the normal game after publication; rebuild production/offline packages to embed it. Publication never commits, pushes or uploads anything.

The normal/offline build embeds only the selected validated published snapshot, not every draft or editor metadata. Unsupported generator versions, dimensions, malformed references and obstructed placements produce errors.

## Current boundaries

This is a first-release battle setup editor, not a terrain sculptor. It uses the current production facilities, inventories, objectives and commanders. Advanced town-control/hub/convoy editing, structural damage authoring and the remaining larger-scale campaign systems are not newly implemented by this tool. They remain tied to their underlying gameplay milestones. Physical phone acceptance and player judgment are separate from automated/browser checks.

The initial title battle, **The Orchard Approach**, was drawn, populated, supplied, saved, reopened, tested and published through the DEV controls in Edge. Its runtime preset contains initial conditions only: no casualties, spent ammunition, active routes, shells, suppression or AI memory.

The corrective pass re-authored its closer opening camera through these same
controls, saved/reopened/tested and published `orchard-approach-8e4800f6033d`.
The old published snapshot is retained. See `evidence/dev-home-corrective/README.md`
for measurements, failed attempts and acceptance boundaries. The prior editor was
**USER REJECTED** despite mechanical checks; this revision remains **USER ACCEPTED
pending**, not completed on the strength of tests alone.

The first generated Endless-mode milestone is separate from this preset format.
DEV does **not yet author Endless initial conditions**. Its strict loader rejects
unsupported mode/economy fields; never paste a running Endless save into a preset.
Future authoring must describe initial ownership, rear sources and policies
without importing control history, casualties, spent stock or active manifests.
