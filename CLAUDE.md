# Charlotte's House: first-person walk-through

A walkable, first-person 3D version of Charlotte's apartment (floor 21, Thunder Bay), built with **Three.js + Vite**, plain JavaScript, in the browser.

## Project rules

1. **The scene is built only from `house.json`.** Never hard-code room sizes, positions, colours, light values, routines or sound placements in the code. If the code needs a number that is not in `house.json`, add it to `house.json` (and to `ASSUMPTIONS.md` if invented). Generic engine constants (mouse sensitivity, frame rate, shadow-map size) may live in code.
2. **Build in stages. Each stage must run before the next one starts.** "Runs" means `npm run dev` opens in the browser with no console errors, and the stage's checklist below works by hand.
3. **Keep the code split into clear modules** (see the layout below). One module per concern: player, house builder, doors, lighting, time of day, audio, NPCs. Modules talk through small exported functions, not shared globals.
4. **After each stage, update the "Progress" section** at the bottom of this file: what was built, how to run it, and any known problems.
5. **Validate the data before building on it:** `npm run check` must report 0 errors. Run `npm run floorplan` after any change to `house.json`, and look at `floorplan.svg`.
6. **The design notes win over `house.json` where they are clear.** `house.json` was written from Derrick's locked notes. Do not "improve" a value that has `"basis": "notes"`. Values with `"basis": "assumed"` may be changed, and the change goes in `ASSUMPTIONS.md`.
7. **The furnishing rule is part of the brief:** nothing appears in the flat that is not in `house.json`. No extra props, art, plants, rugs or clocks for decoration.

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

## Module layout (planned)

```
index.html
src/
  main.js              boot: load house.json, create renderer/scene, wire modules, main loop
  data/house.js        load + light validation of house.json; helpers (rooms by id, placement by state)
  player/              pointer-lock first-person controls, walk speed, eye height, collision
  house/               floors, ceilings, walls with openings cut out, windows (glass + frames), materials
  doors/               hinged and bifold doors, open/close animation, self-closing front door, lock state
  furniture/           placeholder boxes from footprints first; nicer geometry later
  lighting/            fixtures from house.json, switches, indicators, lighting presets
  time/                game clock, sun position, sky, season (snow, frost, frozen lake)
  outdoors/            ground, street, low roofs, church, lake sliver, hills, mast, city lights
  audio/               Web Audio positional sounds, schedules, triggers; synth fallbacks for missing files
  npcs/                characters, routines, events, simple path following between spots
  states/              story state A–F switch: show/hide/move items, curtains, fridge contents
  interact/            look-at + click/E interactions (doors, switches, curtains, fridge, kettle, record)
  ui/                  small HUD: time, state, presets
public/
  house.json           copied or symlinked from the repo root at build time (root copy is the source)
  audio/               sound files (optional; missing files fall back to synthesized placeholders)
tools/                 Node scripts: check-house.mjs, floorplan.mjs, lib.mjs (no dependencies)
```

## Stages

| Stage | What gets built | Done when |
| --- | --- | --- |
| 0 | Planning: `house.json`, `ASSUMPTIONS.md`, `floorplan.svg`, checker | `npm run check` passes; plan reviewed |
| 1 | Vite scaffold; house builder (floors, ceilings, walls with openings, glass); player (pointer lock, WASD, eye height 1.6, wall collision); flat ambient light | You can walk from the hall into every room; no walking through walls |
| 2 | Doors: hinged and bifold, open/close on click, front door self-closes and shows red/green, door collision | Every door opens and shuts; closed doors block you |
| 3 | Furniture as placeholder boxes with materials, plus collision for solid items; curtains (open/close) | Every item in `house.json` appears where the plan shows it |
| 4 | Lighting: every fixture, switches, indicators, shadows, the four lighting presets | Each switch works; presets match the notes |
| 5 | Time of day: clock, sun from latitude and compass, sky, outdoor surroundings, seasons, frost | The morning sun comes in low from the left; night shows city lights |
| 6 | Audio: positional sounds, schedules, triggers (buzz, kettle, record, fan) | Each sound plays from its place at its time |
| 7 | NPCs: placeholder figures, routines, events (get-together, visits) | Venus follows his day in state A; visits happen on cue |
| 8 | Story states A–F and interactions (fridge, cabinets, kettle, record, pages, lamp) | Switching state moves and swaps everything listed in section 11 of the notes |

## Commands

```
npm run check       # validate house.json (rooms, doors, reachability, swings, furniture)
npm run floorplan   # regenerate floorplan.svg from house.json (optional arg: state letter)
npm run dev         # (from stage 1) start Vite dev server
npm run build       # (from stage 1) production build to dist/
```

## Progress

### Stage 0: Planning (done, 13 Oct 2026)

- **Built:**
  - `house.json`: the single source for the scene. It covers site and compass, building, one floor with 8 spaces (7 in the unit plus a corridor stub), walls, doors, windows, curtains, lights, switches, furniture by state, NPCs and events, sounds, lighting and time-of-day presets, and outdoor surroundings.
  - `ASSUMPTIONS.md`: every invented value, by room, with the clashes found in the notes.
  - `floorplan.svg`: a top-down plan drawn from `house.json` (state A, with the D–F desk dashed, plus a compass and sun rays for 18 Jun).
  - `tools/check-house.mjs`: a layout checker. Room areas total 65.00 m², with no overlaps or gaps. Every room is reachable from the corridor. Door positions, hinge points, swing clearances, furniture-in-room, curtain line, NPC spots and routine coverage are all checked.
- **How to run:** `npm run check` and `npm run floorplan` (Node 18+, no install needed).
- **Known problems:**
  - The checker warns that `desk_main` (states D–F) crosses the curtain line at y = 9.75. The value comes from the notes and is waiting on Derrick (see `ASSUMPTIONS.md`, "Review these first").
  - The main-room desk's left/right in the prose is mirrored relative to the coordinates.
  - The Stage 1 scaffold (Vite, Three.js) is not created yet.
