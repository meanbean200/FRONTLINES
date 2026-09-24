# Field command / visual system

## Audit and direction

The previous HUD combined tiny monospace readouts, bright map tints, unrelated
Unicode icons, serif menu cards and repeated boxed panels. The menu artwork was
too dominant; selection information was either hidden entirely or verbose. The
minimap did not provide a usable operational overview. World-label projection
was already synchronized to the camera and must remain so.

The new direction is **field folio**: painted-steel rails around the battlefield,
paper map stock for plotting, and an orderly typeset operations sheet. No borrowed
game layout, stencil-font wallpaper, simulated scratches or new audio.

## Tokens and components

- Ink / equipment: #1c2422, inset #151c1a; rules #535c50.
- Canvas / text: #e6e0cb; secondary #b8bbaa; map paper #d0c5a4.
- Friendly blue-gray #9bacb2; enemy brick #b8796b; selection khaki #dbca96.
- Warnings #c5a568, critical #b8796b. Meaning also uses text/symbols, not color alone.
- Condensed Bahnschrift/Arial Narrow headings; Segoe UI readable body; Cascadia
  Mono/Consolas for coordinates, times and technical reports. No network font fetch.
- 4/8/12/16/24px spacing rhythm; 1px rules; square corners. Body 13–15px,
  technical labels 11–12px, unit headings 20px. Short-window layouts fold instead
  of shrinking everything.
- Buttons: 36–42px target, SVG line symbol + explicit name; inset pressed state,
  light khaki selected state, dashed keyboard focus distinct from selection;
  disabled text remains legible. No neon glow.
- Selection: compact name/strength/order docket; optional detailed report with
  numeric ammunition and a single suppression gauge. Full hierarchy on demand.
- Tooltips: small paper labels, real current information only. Enemy reports never
  reveal hidden identities, live strength, or orders.
- Plotting: fine directional paths, crosshair destinations, segmented defense
  lines, earth-colored trench plan, control-point ticks; real terrain obstacles
  receive brick-red marks. No invented construction-time estimate.
- Completed trenches remain terrain. Blast radii and uncertainty circles remain
  circles because they encode real simulation distances.
- World markers project every render frame. Scale changes affect detail, not
  positional smoothing. Operational symbols represent existing squads, not
  invented company/platoon hierarchies.
- UI transitions: <=120ms opacity/color only, reduced-motion supported. World
  label transforms are never animated or hidden to disguise lag.

## Scope and acceptance

Presentation, input routing for UI overlays, and pure readouts only. Simulation
rules, saves, ballistics, inventories and combat knowledge remain authoritative.
Check menu, selected HUD, engineers, warnings, drawers, operational map and
native Edge resizing. Check common desktop and short/narrow windows; preserve
the player browser's native viewport and campaign storage.
