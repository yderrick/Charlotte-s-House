# Charlotte's House: first-person walk-through

A walkable, first-person 3D version of Charlotte's apartment (floor 21, Thunder Bay), built with **Three.js + Vite**, plain JavaScript, in the browser.

## Project rules

1. **The scene is built only from `house.json`.** Never hard-code room sizes, positions, colours, light values, routines or sound placements in the code. If the code needs a number that is not in `house.json`, add it to `house.json` (and to `ASSUMPTIONS.md` if invented). Generic engine constants (mouse sensitivity, frame rate, shadow-map size) may live in code.
2. **Build in stages. Each stage must run before the next one starts.** "Runs" means `npm run dev` opens in the browser with no console errors, and the stage's checklist below works by hand.
3. **Keep the code split into clear modules** (see the layout below). One module per concern: player, house builder, furniture, doors, lighting, time of day, audio, story states. Modules talk through small exported functions, not shared globals.
   - Geometry that the Node tools also need (layout, collision) stays pure: no Three.js and no DOM.
   - Three.js code only turns those plain boxes into meshes.
4. **After each stage, update the "Progress" section** at the bottom of this file: what was built, how to run it, and any known problems.
5. **Validate the data before building on it:** `npm run check` must report 0 errors. Run `npm run floorplan` after any change to `house.json`, and look at `floorplan.svg`.
6. **The design notes win over `house.json` where they are clear.** `house.json` was written from Derrick's locked notes. Do not "improve" a value that has `"basis": "notes"`. Values with `"basis": "assumed"` may be changed, and the change goes in `ASSUMPTIONS.md`.
7. **The furnishing rule is part of the brief:** nothing appears in the flat that is not in `house.json`. No extra props, art, plants, rugs or clocks for decoration.
8. **No NPCs.** This location has no people. Do not add characters, routines or voices.
9. **Walking must stay verified:** `npm run test:walk` must pass after any change to `house.json`, the layout code or the collision code.

## Coordinates and conventions (from `house.json`)

- **Plan coordinates:**
  - Origin: the inside corner where the corridor wall meets the left-hand wall as you walk in.
  - x runs right as you walk in (0–6.5), y toward the windows (0–10.0), z up. All in metres.
- **To Three.js:** `three.x = x`, `three.y = z`, `three.z = -y`. A plan `rotationDeg` r becomes `object.rotation.y = r * Math.PI / 180`.
- **Rotation:** `rotationDeg` is counter-clockwise from above. 0 means the object's front faces +y (the windows), 90 faces −x, 180 faces −y, 270 faces +x.
- **Room rectangles** use the notes' lines. Interior partitions (0.1 m) are centred on those lines, and exterior walls sit outside the 6.5 × 10.0 box.
- **Walls** are given by centreline `a → b`, `thickness`, and `extendStart`/`extendEnd`. Openings are cut at `offsetAlongWall` (measured from `a`) with their `width` and `height`. Above a door, the wall continues as a header up to the ceiling.
- **Furniture** gives world-space footprints `x: [min, max]`, `y: [min, max]`, `z: [min, max]`. Fit placeholder or model geometry into that box after rotation.
- **Story state:**
  - Items with a `states` list appear only in those states.
  - Items with `byState` take their position from the current state.
  - The state switch runs A–F.
- **Compass:** +y is bearing 135° (SE). The sun direction comes from `site.latitude`, `site.longitude` and `site.timeZone`. The solar-position formula is in `tools/lib.mjs` (`sunPosition`); port it, don't re-derive it.
- **Outdoors:** items are placed by bearing and distance from the centre of the window wall (`coordinateSystem.planFromCompass`). Ground is at `outdoors.groundZ` (−61.5).
- **Lights:**
  - `lumens` is the source of truth. With `renderer.physicallyCorrectLights` / `useLegacyLights = false`, a point light's intensity in candela is `lumens / (4π)`, and a spot light's is `lumens / π` (approximately).
  - `colourK` is the colour temperature; `colour` is its sRGB approximation.

## Module layout

```
index.html             page shell: canvas, HUD, crosshair, "click to walk" overlay
house.json             THE source; imported directly by src/main.js (Vite JSON import)
src/
  main.js              boot: renderer, scene, camera, wire modules, main loop, debug hooks
  data/geometry.js     pure plan-space helpers (walls, openings, placement by state, roomAt, sun) — shared with tools/
  scene/boxes.js       plan box -> Three.js mesh (three.x = x, three.y = z, three.z = -y), outlines
  house/layout.js      pure: floors, ceilings, wall pieces, headers, thresholds, glazing, colliders as boxes
  house/builder.js     Three.js meshes for the shell (grey materials) + ground plane
  furniture/layout.js  pure: furniture boxes for a story state (island base/top, sink cut-out, seat backs, headboard)
  furniture/builder.js Three.js meshes for furniture (grey, outlined)
  player/collision.js  pure: circle-vs-box collision in plan space, sub-stepped moves
  player/controls.js   pointer lock, mouse look, WASD + Shift, camera at eye height
  lighting/flat.js     stage 1 flat lighting (hemisphere + ambient + one weak directional)
  ui/hud.js            room name, position, compass heading
  doors/               (stage 2) hinged and bifold doors, front door lock
  lighting/            (stage 4) fixtures, switches, indicators, presets
  time/                (stage 5) clock, sun, sky, seasons
  outdoors/            (stage 5) street, roofs, church, lake sliver, hills, mast
  audio/               (stage 6) positional sounds, schedules, triggers
  states/              (stage 7) story state A–F switch
  interact/            (stage 7) look-at + click interactions
tools/                 Node scripts (no dependencies): check-house.mjs, walk-test.mjs, floorplan.mjs, lib.mjs
```

## Stages

| Stage | What gets built | Done when |
| --- | --- | --- |
| 0 | Planning: `house.json`, `ASSUMPTIONS.md`, `floorplan.svg`, checker | `npm run check` passes; plan reviewed |
| 1 | Grey box: Vite + Three.js; floors, ceilings, walls with door and window openings; furniture boxes; first-person controls; collision; flat light; room HUD | You can walk through every room and can't pass through any wall |
| 2 | Doors: hinged and bifold leaves, open/close on click, front door self-closes and shows red/green, door collision | Every door opens and shuts; closed doors block you |
| 3 | Materials and colours from `house.json`; curtains (open/close); nicer furniture shapes inside the same footprints | Every item looks like what it is, at the size in the plan |
| 4 | Lighting: every fixture, switches, indicators, shadows, the four lighting presets | Each switch works; presets match the notes |
| 5 | Time of day: clock, sun from latitude and compass, sky, outdoor surroundings, seasons, frost | The morning sun comes in low from the left; night shows city lights |
| 6 | Audio: positional sounds, schedules, triggers (buzz, kettle, record, fan) | Each sound plays from its place at its time |
| 7 | Story states A–F and interactions (fridge, cabinets, kettle, record, pages, lamp) | Switching state moves and swaps everything listed in section 11 of the notes |

## Commands

```
npm install         # once
npm run dev         # start the Vite dev server, open the printed URL (http://localhost:5173/)
npm run build       # production build to dist/  (npm run preview serves it)
npm run check       # validate house.json (rooms, doors, reachability, swings, furniture)
npm run test:walk   # walk test with the real collision code: every room reachable, no wall passable
npm run floorplan   # regenerate floorplan.svg from house.json (optional arg: state letter)
```

## Progress

### Stage 0: Planning (done, 13 Oct 2026)

- **Built:**
  - `house.json`: the single source for the scene. It covers site and compass, building, one floor with 8 spaces (7 in the unit plus a corridor stub), walls, doors, windows, curtains, lights, switches, furniture by state, NPCs and events (later removed), sounds, lighting and time-of-day presets, and outdoor surroundings.
  - `ASSUMPTIONS.md`: every invented value, by room, with the clashes found in the notes.
  - `floorplan.svg`: a top-down plan drawn from `house.json` (state A, with the D–F desk dashed, plus a compass and sun rays for 18 Jun).
  - `tools/check-house.mjs`: a layout checker. Room areas total 65.00 m², with no overlaps or gaps. Every room is reachable from the corridor. Door positions, hinge points, swing clearances, furniture-in-room, curtain line and the spawn point are all checked (the NPC checks were later removed).
- **How to run:** `npm run check` and `npm run floorplan` (Node 18+).
- **Known problems:**
  - The checker warns that `desk_main` (states D–F) crosses the curtain line at y = 9.75. The value comes from the notes and is waiting on Derrick (see `ASSUMPTIONS.md`, "Review these first").
  - The main-room desk's left/right in the prose was mirrored relative to the coordinates.
  - Both were resolved after review (see Stage 1).

### Stage 1: Grey box (done, 13 Oct 2026)

- **Fixes to the plan first** (`ASSUMPTIONS.md`, "Decisions on the issues raised in stage 0"):
  - The window-corner desk moved to y 8.3–9.7, clear of the curtains. The prose direction is corrected: the window is on her left.
  - Eye height is 1.65 m. NPCs are removed (this location has no people), along with their sounds.
  - Walk-in clothes are 0.40 m deep so the aisle is walkable. The laundry is marked look-in only.
- **Built:**
  - A Vite 6.4.3 + Three.js 0.185.1 project.
  - Everything comes from `house.json`: floors, ceilings, walls with door openings and headers, the glass wall (mullions, rails, panes), decor doors in the corridor, and every furniture item for the current story state as grey boxes with outlines.
  - First-person controls: click to capture the mouse, mouse to look, W/A/S/D or arrow keys to walk, Shift to walk faster, Esc to release. Eye height 1.65 m.
  - Collision: a 0.2 m body against every wall, the glass wall and all furniture between 0.15 m and 1.77 m high. Moves are sub-stepped so fast walking can't tunnel.
  - Flat lighting.
  - A HUD showing the room (and kitchen/living zone in the main room), x/y position and compass heading.
  - You start just inside the front door, facing into the flat.
  - There are no stairs (single-storey unit), so there is no stairs code yet.
- **How to run:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Click to start walking. Add `?state=D` (any of A–F) to the URL to see that story state's furniture.
- **Verified:**
  - `npm run check`: 0 errors, 0 warnings.
  - `npm run test:walk`: for each state A–F, every room has reachable floor (the laundry up to its bifold). No reachable spot is inside a wall or furniture. All 5,108 straight-on attempts to walk through walls and glass, from both sides, at walking speed and in single 1 m jumps, were blocked.
  - In headless Chromium, pointer lock, W and Shift+W move the player with no console errors.
- **Known problems:**
  - No door leaves yet: every doorway is an open hole until stage 2, and the front door lets you out into the corridor stub.
  - The walk-in aisle is narrow (0.47 m), so you slide along the clothes to get in.
  - The outside is a plain grey ground 61.5 m below the floor (outdoors comes in stage 5).
  - The production bundle is about 565 kB (144 kB gzipped, mostly Three.js), and Vite prints a chunk-size note.

