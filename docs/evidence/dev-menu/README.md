# FRONTLINES DEV and living home — 2026-09-26

Baseline: `20404c4d563335c30cc82bb260a329b34570e5fc`. This is the focused E/F
authoring and isolated-home milestone, not completion of A–G or a 512-person gate.

## Real authoring, not an injected scenario

The separate headed Edge editor at `http://127.0.0.1:4176/dev.html` was operated
through its DOM controls, pointer gestures and keyboard. Read-only inspection
compared source/runtime and ownership; no solved simulation state was injected.

1. Named **The Orchard Approach**, identity `orchard-approach`; chose the explicit
   project content-folder option and regenerated seed 1944.
2. Drew both trench lines using pointer drags. Corrected an accidental initial
   out-and-back control point through Remove control point, and resnapped the
   posts through their inspector after changing the parent geometry.
3. Placed 32 personnel per faction: three eight-person rifle formations, four
   engineers, two MG crew and two indirect-weapon crew. Configured attack/probe,
   reserve, hold and support intentions using dropdowns. Both controllers are AI.
4. Placed two mounted MGs, a field gun and mortar, supply stores, rest facilities,
   an objective and staging areas. The stock values are finite source manifests.
5. Composed the camera with the actual camera controls and Set opening view.
6. Saved, reopened, ran Play Test, stopped and clicked Use for title screen.
   The player home then loaded those same authored initial conditions.
7. Duplicated as `orchard-authoring-check`, then tested Branch, Extend, node drag,
   duplicate/delete item and exact Undo/Redo. Editing the copy left the original
   and active published snapshot unchanged.
8. A deliberately failed Save (HTTP 507 fault) left the edited document intact
   and dirty. A subsequent successful Save cleared dirty state.
9. Ten actual Play Test / Reset cycles retained the source, 64 actors, one active
   owner and one navigation planner. Stop restored unchanged initial conditions.

Source and published snapshot SHA-256 both remained
`ed826cec964a142a46a05b6c337bdf115bc988b9b9b7305020f1f11851999b45`.
The duplicate test document and action scripts are retained in the local ignored
`output/playwright/dev-menu-20260926` evidence area; it is not shipped as a menu.

The chosen-folder workflow was browser-tested through the explicit local
project-folder backend. Native picker permission/write failures are unit-tested;
the native OS folder picker itself is **not physically accepted** by this pass.

## Actual combat and isolation

- Both MGs expended stock. At 96.85 simulation seconds, the title battle had
  completed three friendly field-gun and four opposing mortar missions; each
  consumed one real round. Targets were delivered observations and passed the
  existing range, crew, sector and friendly-danger checks. No impact was scripted.
- Thirty actual Continue → pause → Discard and return cycles: campaign save
  remained the same 47,704 bytes; every home had 64 people, one owner/planner,
  106 WebGL geometries and four textures. Window listener counts did not grow.
- Ten Settings → home resets recreated the attract owner with stable resource
  counts; `attract-resets.txt` contains the returned browser evidence. One natural
  four-minute timer reset was also observed: generation 2 → 3, 64 people and the
  same 106/4 geometry/texture counts. These are distinct checks, not ten timed
  browser runs falsely described as one.
- Keyboard movement/build keys, mouse wheel and right-click on the home did not
  change its authored camera or select/command units.
- A mocked missing title module produced an empty-sector fallback, not a player
  world. Quick Battle, Settings and Continue still worked. Restoring the module
  restored the real title scene.
- An injected browser storage-quota fault during Save and return retained the exact paused
  battle and old save. Cancel returned to the same battle; Discard returned home.

## Failures preserved and corrected

- Initial posts were placed using the unsmoothed input polyline. Production
  geometry rejected them. Editor snapping now uses the exact production trench
  path, with an explicit Snap to parent floor repair control. Invalid layouts
  remain rejected, rather than silently relocated by the loader.
- Healthy two-person weapon crews were treated as understrength by the old
  three-person threshold. A regression covers the corrected initial-strength
  comparison. It does not add a national or invulnerability bonus.
- Friendly authored AI initially requested fire using ENEMY_AI authority, which
  correctly rejected it. AUTHORED_AI now requires that faction's actual AI
  controller and its own recent delivered report. Existing mismatched-owner and
  legacy-provenance rejection tests remain in place.
- Publication initially reloaded the DEV page. Publication now invalidates the
  next player load without automatically reloading an authoring document.
- First full unit run during concurrent browser work: 825/826 passed; the
  unchanged 40-second supplied-loop soak timed out. No gameplay timeout was
  raised. The frozen quiet run has a separate report.
- The first ten-battle headless test grouped all ten runs into one synchronous
  180-second test and exceeded its budget, also starving the worker RPC. It is
  now ten independently reported cooperative tests with 60 seconds per battle.
  A one-cycle pilot completed in 21.88 seconds before the full run.
- The first 30-transition harness rejected a **decrease** from two pointerdown
  listeners to one (the one-shot audio unlock). The corrected assertion rejects
  growth; the second 30-transition run passed with exact matching counts.
- One editor gesture harness queried a transient SVG node between redraws. The
  retry reads its visible DOM rectangle atomically; no source mutation workaround.
- A combined CLI resize/navigation loop lost its page reference. It is not
  counted as a sizing pass. The independent actual-Edge offline launcher checked
  cold refresh sizes successfully, with screenshots. Short-height screenshots
  also caught cropped home actions; a compact 44-pixel layout was added.
- A maintained Edge run during source changes finished 26/27; the failing test
  waited for a setup control across an unexpected development navigation. That
  interrupted run is preserved at `edge-hmr-interrupted` and is not the final
  frozen-browser result. No timeout or assertion was weakened to conceal it.
- Final review added reserved preset filenames (including `catalogue`), safe
  authoring IDs and an edit lock while asynchronous file operations are pending.
  The real final save/play/stop/publish flow verified the lock, unchanged source
  and no publication-triggered editor reload. The first strict DEV typecheck
  required an explicit type declaration for the build-time preset plugin;
  both player and DEV now receive TypeScript checks.
- Wide desktop review caught overlapping idle names around crewed positions.
  The original `editor-desktop.png` is retained. `editor-selected-post.png`
  shows the corrected selection-focused labels: all 23 object symbols remain,
  the selected field gun's full name is readable, and every item remains named
  in the inspector list. This changes neither the preset nor battlefield labels.

Local raw screenshots/console logs, including failures, remain in `output` and
`.playwright-cli`; selected review screenshots and final reports are copied here.

The retained `author-*.js` / `verify-*.js` files are intermediate Playwright CLI
action records, not independent one-command test specs. They rely on the prior
page/selection, original viewport and separate CLI acceptance of native dialogs.
They operate actual visible controls and use runtime inspection only for checks;
they do not inject authored JSON or solved simulation states into the editor.

## Acceptance boundary

DEV and living home are IMPLEMENTED; the actual workflows above are BROWSER
VERIFIED. Unit, maintained Edge suite, build and offline results are appended in
the implementation ledger. USER ACCEPTED remains pending. The authored 64-person
showcase is not a 512-person performance claim, physical-phone acceptance,
CrazyGames submission review, or the pending 72-hour combat/interdiction soak.

Final reports: `unit-final.json` (846/846, 123 files), `edge-frozen.json`
(27/27, no flaky/skipped results), and `offline-final.json` (isolated Edge,
network disabled, movement, exact Save/Continue and six refresh/viewport sizes).
Player, offline and separate DEV builds pass; packaging is 5/5. The retained
`offline-first.json` predates the short-height home-action correction; the final
offline report additionally requires every home action to fit visibly.
