# The Road Cut — ready-made home battle

The user's two-loop trench layout is the starting point, not another editor
expansion. The new home scene is a hand-built preset, using the production
simulation. Its camera was framed, saved and published through existing controls.
Older Orchard presets and campaign saves are retained.

## Setup

- Two separate completed redoubts across a road; 32 people per faction.
- Three eight-person rifle squads per side: two hold the trench while a patrol
  advances toward the crossing. MG, mortar, pioneer and medical pairs complete
  each force. Squad identities and individual needs remain ordinary game state.
- West infantry faces east (90 degrees); east infantry faces west (-90 degrees).
  Each mounted MG faces the opposing line. Both positions start at stand-to.
- Each MG has 1,200 local rounds. Each mortar has eight HE rounds. Personal
  supplies, two finite rear stores, rest and aid facilities are explicitly stocked.
- Both commanders use real observation. No scripted hits, forced contacts,
  invulnerability or invisible ammunition. The existing home session resets from
  initial conditions after resolution, four minutes, or its post-contact quiet
  timeout. Resets are separate sessions, not in-battle refills.

## Tweak the starting battle

The editable draft is `content/scenarios/road-cut-redoubts.json`. The normal
home screen already uses its published snapshot; no DEV setup is needed to watch.

To change it in the existing tool:

1. Open `http://127.0.0.1:4176/dev.html` while `npm run dev:author` is running.
2. Under **Document / folder**, choose **Use project content folder**.
3. **Load** `road-cut-redoubts`. **More → Duplicate** first if you want a separate copy.
4. Select a trench to change **Defensive front (degrees)** and initial readiness.
   The selected trench shows a FRONT arrow. Select an MG/mortar post to change
   its own **Facing**; this is intentionally separate from infantry facing.
5. Move units/posts or reshape trenches, then **Play Test**. Stop returns to the
   unspent initial conditions. **Save** retains a draft; **More → Use for title
   screen** publishes it. Reload the player tab; rebuild for the offline HTML.

One connected position has one defensive front/readiness. Conflicting authored
branches are rejected with an explanation, not silently overwritten. Old presets
without these optional fields retain their old zero-front/routine defaults.

## Verification boundary

See `evidence/road-cut/README.md` for actual simulation/browser evidence and failed
attempts. Presentation is still subject to the user's review. This content pass
does not complete the larger A–G, scale, mobile or campaign-release gates.
