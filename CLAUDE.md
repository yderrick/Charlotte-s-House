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
9. **Walking, sunlight and lights must stay verified:** `npm run test:walk`, `npm run test:sun` and `npm run test:lights` must pass after any change to `house.json`, the layout, door, collision, time or lighting code.
10. **Interactions are data-driven.** Every interactive object has `interact: { type, action }` in `house.json`. The type's prompts live in `house.interaction.types`. Code only supplies a handler per type (see `src/interact/interaction.js`). Never hard-code a prompt or a per-object special case.

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
- **Compass:** +y is bearing 135° (SE). The sun and moon come from `site.latitude`, `site.longitude` and `site.timeZone`, using `src/time/astro.js` (`sunPosition`, `moonPosition`). Use those; don't re-derive them.
- **Time of day:**
  - The clock (`src/time/clock.js`) holds a local date and minutes after midnight. `src/time/zone.js` turns that into UTC.
  - `environmentAt(house, utcMs)` (`src/time/environment.js`) gives the sun and moon directions in plan space, plus every sky and light value, interpolated from the keyframes in `house.timeOfDay`. Tune the look there, not in code.
- **Outdoors:** items are placed by bearing and distance from the centre of the window wall (`coordinateSystem.planFromCompass`). Ground is at `outdoors.groundZ` (−61.5).
- **Doors:**
  - A hinged door's leaf hangs on the wall face on its `swingsInto` side, at the `hinge` end (`start` = `offsetAlongWall`).
  - It swings from 0 to `maxOpenDeg`. Bifolds fold two leaves into `foldsInto`, up to `doorMotion.bifoldMaxOpenDeg`.
  - Leaf positions come from `src/doors/kinematics.js`; both rendering and collision use it.
- **Interaction:** a ray from the centre of the view, up to `interaction.maxDistance` (2.0 m). The first thing hit decides; a wall in the way blocks it. Meshes carry `userData.interactId` = the object's id.
- **Lights:**
  - `lumens` is the source of truth.
  - A light's Three.js intensity is `lumens / π` (spot) or `lumens / (4π)` (point), times `indoorLighting.photometricScale` (the scene's units are not physical).
  - `colourK` is the colour temperature; `colour` is its sRGB approximation.
  - `fitting` picks the visible fitting (recessed, flush, bar, strip, taskLamp, appliance), and `emit` picks the light type.
- **Indoor light and walls:**
  - Every Lambert material is patched by `src/lighting/roomMask.js`. An indoor light only lights surfaces in its own room, or in a neighbour straight through an open doorway.
  - Each light carries its room in its `distance` field (1000 + room index). Don't set `distance` on indoor lights for anything else.
  - The same rule in JS is `lightReach()` in `src/lighting/rooms.js`. Shadows are for looks only, and limited to the lights in `indoorLighting.shadows.lights`.

- **Materials and textures:**
  - Every surface uses a `MeshLambertMaterial` from `src/art/materials.js`, one per `house.materials` entry. Keep them Lambert: the room mask only patches Lambert.
  - A material's `texture` recipe gives the pattern and its real size in metres. UVs are in metres, and the material's colour from the notes stays the average colour.
  - Colours for small unnamed parts, garments and the town live in `house.art` and `outdoors.look`, not in code.
  - Real CC0 textures, once fetched, are listed in `public/textures/manifest.json` and swapped in at start-up.

## Module layout

```
index.html             page shell: canvas, HUD, crosshair, "click to walk" overlay
house.json             THE source; imported directly by src/main.js (Vite JSON import)
src/
  main.js              boot: renderer, scene, camera, wire modules, main loop, debug hooks
  data/geometry.js     pure plan-space helpers (walls, openings, placement by state, roomAt, sun) — shared with tools/
  scene/boxes.js       plan box -> Three.js mesh (three.x = x, three.y = z, three.z = -y), outlines
  house/layout.js      pure: floors, ceilings, wall pieces, headers, thresholds, glazing, colliders as boxes
  house/builder.js     Three.js shell: each wall face takes the finish of the room it faces (facade outside); batched per material
  furniture/layout.js  pure: furniture boxes for a story state (island base/top, sink cut-out, seat backs, headboard)
  furniture/builder.js Three.js furniture for a state: places each model in its footprint; interactive items keep own meshes, the rest batched
  furniture/models.js  low-poly model per furniture type, built in a local frame (x across, y up, z depth, front at -z) to fill W x H x D
  player/collision.js  pure: circle-vs-box collision in plan space, sub-stepped moves
  player/controls.js   pointer lock, mouse look, WASD + Shift, camera at eye height (getColliders() each frame)
  doors/kinematics.js  pure: hinge frame, leaf placement and collision segments for an angle (hinged and bifold)
  doors/doors.js       pure: door state (angle -> target), stops against the player, self-closing + lock
  doors/builder.js     Three.js leaves (faceInside / faceOutside materials) with handles; front door status lights (red locked / green open)
  curtains/curtains.js pure: curtain halves, openness 0..1, extents and colliders
  curtains/builder.js  Three.js pleated curtain halves on the ceiling track
  interact/registry.js pure: collect every interact { type, action } from house.json; prompt lookup
  interact/interaction.js  look-at raycast, prompt, E key; handlers by type are passed in from main.js
  time/astro.js        pure: sun position (NOAA), moon position and phase, sidereal time
  time/zone.js         pure: local time in house.site.timeZone <-> UTC (Intl)
  time/clock.js        pure: game clock (date + minutes), speed steps, pause
  time/environment.js  pure: sun/moon directions in plan space + sky and light values from house.json keyframes
  time/sky.js          Three.js sky dome (gradient + sun glow), turning star field, moon disc with phase
  lighting/daylight.js Three.js sun/moon key light (shadowed), daylight spots through the glass + bounce (shadowed), ambient, exposure; per-light shadow updates
  lighting/rooms.js    pure: room graph, doorways between rooms, lightReach() (how much of a light reaches a point)
  lighting/schedule.js pure: dusk/dawn from the sun, schedule levels for automatic lights
  lighting/lightstate.js pure: which lights are on, switch/gang/lamp -> lights, start-up preset, intensities
  lighting/roomMask.js Three.js shader patch: indoor lights stop at walls and pass through open doorways; per-room soft fill
  lighting/fixtures.js Three.js fittings, lights, indicator glows, switch plates; eye-adaptation light level
  lighting/flat.js     stage 1 flat lighting, still available with ?light=flat for checking geometry
  ui/hud.js            room name, position, compass heading, interaction prompt
  ui/timebar.js        clock, date, time slider, pause / speed buttons, where the sun and moon are
  art/textures.js      textures drawn in code from materials.*.texture recipes (detail map + bump map, real size in metres)
  art/materials.js     one MeshLambertMaterial per house.json material (Lambert for the room mask); swaps in fetched CC0 textures
  art/batch.js         merges parts into one mesh per material (UVs in metres; world-UV boxes for the shell)
  art/frost.js         frost on the glass on cold winter nights (timeOfDay.frost)
  outdoors/city.js     the town from outdoors.items + outdoors.look: road grid, instanced houses and trees, church, towers, lake, hills, mast, night windows, street lights, snow
  audio/               (on hold) positional sounds, schedules, triggers
  states/              (stage 8) story state A–F switch
tools/                 Node scripts (no dependencies): check-house.mjs, walk-test.mjs, sun-test.mjs, lights-test.mjs, floorplan.mjs, fetch-textures.mjs, lib.mjs
```

## Stages

| Stage | What gets built | Done when |
| --- | --- | --- |
| 0 | Planning: `house.json`, `ASSUMPTIONS.md`, `floorplan.svg`, checker | `npm run check` passes; plan reviewed |
| 1 | Grey box: Vite + Three.js; floors, ceilings, walls with door and window openings; furniture boxes; first-person controls; collision; flat light; room HUD | You can walk through every room and can't pass through any wall |
| 2 | Doors and interaction: crosshair, look-at prompts, hinged and bifold leaves that swing, front door self-closes and shows red/green, door collision, curtains | Every door opens and closes; every room is reachable by opening doors |
| 3 | Time of day: game clock and controls, sun and moon from latitude and compass, sky through dawn/day/sunset/dusk/night, stars, shadowed sunlight through the windows, dark windowless rooms | Standing in a room and scrubbing the time slider, the window light moves and changes colour |
| 4 | Indoor lights: every fixture with a visible fitting, switches by the doors, warm bulbs, light that stops at walls and spills through open doors, scheduled lights, a few chosen shadows | At night you can walk through the flat switching lights on and off, and each room looks lit or dark |
| 5 | Cupboard and drawer handlers; lighting preset picker | Every cupboard and drawer opens; presets can be picked in game |
| 6 | Audio: positional sounds, schedules, triggers (buzz, kettle, record, fan). On hold: sound is being ignored for now | Each sound plays from its place at its time |
| 7 | Art pass: textures for every material, low-poly furniture inside the same footprints, the town outside, seasons, frost, `CREDITS.md` | The house looks like the place in the notes |
| 8 | Story states A–F and interactions (fridge, cabinets, kettle, record, pages, lamp) | Switching state moves and swaps everything listed in section 11 of the notes |

## Commands

```
npm install         # once
npm run dev         # start the Vite dev server, open the printed URL (http://localhost:5173/)
npm run build       # production build to dist/  (npm run preview serves it)
npm run check       # validate house.json (rooms, doors, reachability, swings, furniture)
npm run test:walk   # walk test with the real collision and door code: rooms reachable by opening doors, no wall passable
npm run test:sun    # sun test: rays from every floor spot toward the sun through the real walls, on four dates, hourly
npm run test:lights # light test: switches by doors, every light switchable, light stops at walls and spills through open doors, schedules
npm run floorplan   # regenerate floorplan.svg from house.json (optional arg: state letter)
npm run fetch:textures  # optional: download CC0 textures from Poly Haven into public/textures/ (needs network access)
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

### Stage 2: Doors and interaction (done, 13 Oct 2026)

- **Built:**
  - **Crosshair:** a white dot with a dark ring in the centre of the screen.
  - **Prompts:** looking at something interactive within 2.0 m shows a prompt such as "E – Open door" or "E – Close curtains" under the crosshair. Walls in the way block it.
  - **Interaction system** (`src/interact/`): every interactive object in `house.json` now has `interact: { type, action }`. That covers 6 doors, the curtains, 24 furniture items and 6 switches. The 19 types and their prompts are in `house.interaction.types`.
    - Handlers exist for `door`, `bifold` and `curtains`.
    - Cupboards, drawers, switches, the kettle and the rest are already tagged and are ignored until their stage adds a handler. Adding one is a single entry in the `handlers` map in `src/main.js`.
  - **Doors:** real leaves on their hinges, swinging smoothly (0.9 s) in the direction set in `house.json`.
    - Hinged: front door, bathroom, bedroom and walk-in closet. Bifolds: the laundry and coat cupboards, two leaves each, folding into the hall.
    - A closed door blocks you. An open door lets you through. A swinging door stops against you and carries on when you step back.
    - The front door self-closes 4 s after opening (shutting over 5 s, slowly) and locks. Its panel lights show red when locked, green when open.
  - **Curtains:** two pleated halves on the ceiling track. One press draws both across the glass (3 s) or back into their stacks at each end. They start open in state A and closed in B–F. Closed curtains block walking at the glass.
  - **Collision:** now also handles door leaves as thick line segments that turn with the door.
- **How to run:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Click to start. Look at a door and press E. Add `?state=D` to see a story state with the curtains closed.
- **Verified:**
  - `npm run check`: 0 errors. It also checks every `interact` names a known type with the matching action.
  - `npm run test:walk`, for each state A–F:
    - With all doors closed, only the hall and main room are reachable.
    - Starting all-closed and opening only doors within reach, all 6 doors get opened (front, bathroom, laundry, coat, bedroom, closet) and every room is reached.
    - No door hits a wall or furniture anywhere in its swing (the check was tested against a deliberately bad swing, and caught it).
    - All 5,108 attempts to walk through a wall are still blocked.
  - In headless Chromium with the real E key, every door showed the right prompt, opened fully (95° front, 90° hinged, 80° bifolds) and closed again. A closed bedroom door stopped a walk at the doorway; open, the walk went through. The front door self-closed and re-locked. A door stopped at 57° against the player, then finished opening once they moved. The curtains closed to meet in the middle with a 10 cm overlap, and the prompt flipped. No console errors.
- **Known problems:**
  - The decor doors in the corridor (neighbours, lift) don't open; they aren't part of the flat.
  - You can only grab the curtains where they hang. When they are open, that means the stacks at the two ends of the glass.
  - The prompt for cupboards, switches, the fridge and other later types does not appear yet (no handler).
  - Story states still come from the `?state=` URL parameter; there is no in-game switch until stage 7.

### Stage 3: Time of day (done, 13 Oct 2026)

Stage numbering follows your request: time of day is stage 3, and materials and lighting fixtures moved to stages 4 and 5.

- **Built:**
  - **Game clock:** starts at the story state's date and time (state A: 18 Jun 2026, 07:30). One day passes in 24 real minutes by default, and the clock rolls over midnight into the next date.
  - **Time bar** at the bottom of the screen:
    - The clock and date, a 00–24 slider to jump to any minute, and « ❚❚ » buttons.
    - The current speed, shown as "×60 · 1 day = 24 min".
    - Where the sun and moon are, for example "Sun 18° high in the ENE · Moon 23° W, 21% lit".
  - **Keys:** P pauses, [ slows down, ] speeds up (×15 to ×960). They work while walking. Press Esc to free the mouse for the slider.
  - **Sun:** follows its real path for Thunder Bay on the clock's date, from the house's compass facing (SE) and latitude. Sunlight casts shadows, so window-shaped patches and soft frame stripes move across the floor and walls through the day. It is warm and orange when low, white when high.
  - **Moon:** its real position and phase, drawn as a disc with its lit part. At night the shadowed light follows the moon, so moonlight falls through the glass.
  - **Stars:** fade in at dusk and turn with the sky.
  - **Sky:** changes colour through night, dawn, day, sunset (orange glow around the sun) and dusk (violet).
  - **Daylight through the glass:** soft light from three sources outside the window, plus a bounce light that lifts the ceiling.
    - Walls and closed curtains block it. The windowless bedroom, bathroom, closet and cupboards are clearly darker by day, and the bedroom with its door shut is nearly dark (as in the notes).
    - A faint everywhere-light and eye adaptation keep night dark but not pitch black.
  - **Performance:** each light's shadow re-renders only when needed. The sun's re-renders when it moves about 0.05°; the fixed daylight lights' only while a door or curtain moves. The heaviest normal frame went from 1,156 draw calls to 353. Use `?shadows=low|high` to change shadow quality.
  - **URL options:** `?date=2026-12-21`, `?time=22:40`, `?speed=0`, `?shadows=low`, `?light=flat` (the old even lighting).
- **How to run:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Stand in the main room, press Esc, and drag the time slider.
- **Verified:**
  - `npm run test:sun` traces a ray toward the sun from every 10 cm of floor through the real walls, slabs, frames, closed doors and furniture. It does this hourly on 18 Jun, 18 Aug, 7 Nov and 21 Dec 2026. It found:
    - Direct sun only in the main room, plus the hall through its open mouth on winter mornings.
    - In the windowless rooms, nothing beyond the sliver under the bedroom door's gap.
    - On 18 Jun the morning sun comes from the left: its patch sits at x 5.1 at 07:00 and moves to x 3.2 by 14:00.
    - The sun leaves the glass between 14:00 and 15:00 as it swings behind the tower face.
    - The low December sun reaches 5.5 m into the room, against 1.1 m at the June noon.
    - Closed curtains leave only a thin line under the hem.
  - The sun test fails, as it should, if the house is turned to face north-west.
  - Browser, headless Chromium:
    - Screenshots at 07:30, 08:00, 12:00, 14:00, 21:45, 22:40 and 01:00 show the patches moving and the colours changing. Also shot: the full moon on 29 Jun, and the dark bedroom at noon.
    - Dragging the slider with the mouse moved the clock (12:00 mid-drag, 18:10 on release).
    - P, [, ] and the buttons changed the speed as expected, including while walking.
    - No console errors.
  - `npm run check` and `npm run test:walk` still pass.
- **Known problems:**
  - Outside is still a plain ground 61.5 m below; the street, roofs, church, lake sliver, hills and city lights come with stage 4. It looks brown in low sun.
  - Daylight bouncing around the room is approximated by one light in the middle of the main room, so corners and the far side of furniture are a little darker than in reality.
  - The window frames' soft shadows from the daylight lights show as three faint stripes up close.
  - The sun position is accurate to about a minute, the moon to about a degree.
  - Shadows from the moon are as sharp as the sun's.
  - Rare: when the sun or moon crosses the light threshold at dawn or dusk, the lighting shaders recompile once, which can cause a single short hitch.
  - The bundle is about 611 kB (159 kB gzipped).

### Stage 4: Indoor lights (done, 13 Oct 2026)

Stage numbering again follows your request: indoor lights are stage 4, and materials, outdoors and presets moved to stage 5.

- **Built:**
  - **Every fitting from `house.json`, with the light it gives off:**
    - Recessed downlights (2 in the hall, 3 over the kitchen galley, 5 in the corridor).
    - Flush round ceiling lights (living area, bedroom, walk-in closet).
    - The bathroom light bar above the mirror cabinet.
    - The under-cupboard strip.
    - Her desk lamp: base, stem and shade, aimed as `house.json` says. It is in the bedroom in states A–C and turned to the wall in D–F.
    - Fittings glow when on and go plain white when off.
    - Indicator glows with no light of their own: the TV's red standby dot, the bedroom climate panel, and in states D and E the dimmed monitor screen and the phone face up. The door panel's red/green light comes from stage 2.
  - **Switches:** plates on the walls next to the room doors, worked through the stage 2 interaction system (E):
    - Hall, by the front door.
    - Main room, by the hall mouth: two gangs, "Turn kitchen lights on" and "Turn living-room light on".
    - Bedroom, just inside the door. Bathroom, inside its door. Walk-in closet, beside its door.
    - Under-cupboard lights, a switch under the cupboards.
    - The desk lamp is switched on the lamp itself.
    - Rockers tip when switched.
  - **Warm bulbs:** 2700 K for household bulbs. The under-cupboard strip stays cold white, as in the notes, and the corridor stays neutral.
  - **Light stays in its room and spills through doorways.** A shader patch (`src/lighting/roomMask.js`) lets an indoor light reach only its own room, or a next-door room along the line of sight through an open doorway. An open door throws a wedge of light across the next room's floor, fading as the door closes. A wall between rooms lets no light through. Each room also gets a soft fill from its own lamps, so lit rooms don't have black corners; this isn't meant to be realistic.
  - **Automatic lights:** a schedule format in `house.json` (`indoorLighting.schedules`): periods from dusk, dawn or a clock time, with levels. Dusk and dawn come from the real sun for the date. The flat has no porch and nothing automatic of its own, so the building's corridor lights use it: 60% by day, full from dusk (22:19 on 18 Jun, 17:21 on 21 Dec), 30% from 01:00 until dawn.
  - **Shadows: only 2 indoor lights cast them.**
    - The living-room ceiling light: the biggest, most-seen room, where the couch and furniture throw the most shadows.
    - The desk lamp: low and close, so its shadows define the scene (the lamp to the wall in Phase 6, toward the bed in Ch1 Sc4).
    - Since walls already stop light without shadows, the downlights, the bathroom bar, the closet and the corridor lights skip them. That keeps the flat at 7 shadow maps in total (5 for daylight, 2 indoor), well inside the GPU's texture limit.
    - Indoor shadows only re-render when a light is switched on or a door or curtain moves.
  - **Start-up lights:** the lighting preset from the notes for the state's opening moment. State D starts with only the desk lamp on; state A at 07:30 starts dark.
  - **Eye adaptation:** walking into a lit room at night brings the exposure down from dark-adapted, so lit rooms look lit and dark rooms look dark.
- **How to run:** `npm install`, then `npm run dev`, and open http://localhost:5173/?time=23:30 (or drag the time slider to night). Walk to a switch by a door and press E. Try `?state=D` for the Phase 6 night with only the desk lamp on.
- **Verified:**
  - `npm run test:lights`:
    - All 17 emitting lights sit in their rooms in every state, and every manual light has a switch or lamp.
    - Every wall switch is within 0.4 m of a door of its room.
    - The bedroom light doesn't reach the main room with the door shut, does spill through the open door, and only onto floor in line with the doorway.
    - The same holds for the hall light into the bathroom and the closet light into the bedroom. The kitchen lights reach the hall through the hall mouth.
    - The corridor schedule gives the right levels by day, from dusk and after 01:00, in June and December.
    - The state D and state A start-up presets are right, and the kitchen gang works only the kitchen lights.
  - Browser, headless Chromium, real E key: all 7 switch controls showed the right prompt, turned their lights and glow on, then off. The desk lamp in state D started on, prompted "E – Turn lamp off", and turned off. The corridor lights read 0.6 / 1.0 / 0.3 / 1.0 of full at noon / 23:00 / 02:00 / a December 18:00. No console errors.
  - Night screenshots:
    - The main room with every light on, seen from the hall.
    - The hall downlights with light spilling out of the open bathroom.
    - A lit bedroom throwing a wedge of light through its door into the dark main room.
    - A dark bedroom seen from inside, with the lit main room beyond its door.
    - The Phase 6 desk lamp making a pool of light on the wall.
  - Daytime with the lights off looks as it did in stage 3.
  - `npm run check`, `npm run test:walk` and `npm run test:sun` still pass.
- **Known problems:**
  - Light passes through only one doorway: the kitchen light reaches the hall, but not on into the bathroom beyond it.
  - Lights aren't realistic (by choice). The soft fill is a flat per-room glow, and downlight cones leave scalloped edges on the walls.
  - The fridge's inside light exists but stays off until the fridge door opens (stage 7).
  - The lighting presets are only applied at start-up; there is no in-game preset picker yet.
  - Each light's room is stored in its Three.js `distance` value (see conventions). The desk lamp's shadow camera therefore uses a 1000 m far plane, which costs a little shadow precision.
  - The bundle is about 634 kB (167 kB gzipped).

### Stage 7: Art pass (done, 13 Oct 2026)

Stage numbering follows your request: this is stage 7. Sound is on hold, and story states move to stage 8.

- **Textures, drawn in code.** Poly Haven, ambientCG and Kenney are blocked by this environment's network policy, so nothing could be downloaded.
  - Every material in `house.json` now has a texture recipe (`materials.*.texture`), and `src/art/textures.js` draws it at its real size, with a bump map.
  - Recipes: faint plaster on the white walls and ceilings; 1.22 m grey wood-look vinyl planks; 60 × 30 cm grey bathroom tiles with grout; quarter-turned charcoal carpet tiles in the corridor; speckled grey counter; brushed stainless; fine fabric weaves on the couch, curtains, bedding, towels and stools; cardboard on the boxes; slotted grilles; handwriting on her pages.
  - Each material keeps its colour from the notes as its average colour.
  - `npm run fetch:textures` will download Poly Haven CC0 textures (picked from each recipe's `search` words) on a machine with access. It writes `public/textures/manifest.json` and lists the files in `CREDITS.md`. The game swaps them in at start-up and tints each one to the notes' colour.
- **Shell:** each wall face takes the finish of the room it faces: white paint in the flat, the corridor's wall finish in the corridor, the facade outside. Floors take each room's floor material, ceilings their ceiling, and slab edges are concrete. Door leaves are white inside; the front door is charcoal on the corridor side. Handles are stainless. The grey outlines are gone.
- **Furniture:** every item is a low-poly model built in code (`src/furniture/models.js`), filling its footprint from `house.json`. Some examples:
  - Kitchen: cabinet doors and drawers with handles, the worktop cut around the sink, the range with a black glass top and knobs, the microwave with its window, a kettle and a drying rack.
  - Living area: the couch with arms, loose back cushions and the worn cushion at Michael's end; bar stools; the TV on its pedestal stand with the console, controllers and game cases; the shelf with the turntable, speakers and record sleeves (one new sleeve in state A).
  - Bedroom: the bed with headboard, sheets, duvet and pillows; the desk, task chair, monitor, laptop, keyboard and phone.
  - Bathroom: the bath with the shower curtain, the toilet, the vanity and mirror cabinet, the towel rail and the extractor.
  - Walk-in closet: her few dark clothes on the rail, bare hangers in states C–F, his box on the shelf.
  - Elsewhere: pill strip, mug, open boxes, convector heaters along the glass.
  - Collision still uses the plain footprint boxes, so walking is unchanged.
- **Not added, on purpose:**
  - No NPC models: the flat has no people (rule 8).
  - No pictures, rugs, plants or shelf ornaments. The notes say bare walls, no photographs, art, plants, rug, clock or magnets, and rule 7 forbids extras. Only items already in `house.json` are drawn.
- **The view outside** (`src/outdoors/city.js`, from `outdoors.items` and `outdoors.look`):
  - A 110 m road grid lined up with the main street, with tree-lined avenues.
  - About 8,500 low houses with pitched or flat roofs on their lots, in the notes' sector and thinning with distance, plus about 900 trees.
  - Parking lots, the taller buildings with windows, the church with its tower and spire, the lake, the hills on the horizon, and the mast with blinking red lights.
  - At night, 20% of windows are lit (dusk to 23:30) and street lights glow along the roads.
  - Distance fog takes its colour from the sky's horizon.
- **Seasons:** snow on the ground and roofs, and a frozen harbour, on the dates in `timeOfDay.season`. Tree leaves are on from mid-May to late October.
- **Frost:** on December–February nights, feathery frost grows from the bottom corners of each pane (`timeOfDay.frost`).
- **Smoothness:** all shaders are compiled at start-up, behind the "click to walk" overlay, so turning to look at something new doesn't stutter.
- **How to run:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Try:
  - `?time=23:30` for night;
  - `?date=2026-01-15&time=12:30` for snow;
  - `?date=2026-01-15&time=23:00` for frost;
  - `?state=D` for Phase 6.
- **Verified:**
  - `npm run check`: 0 errors, 0 warnings. `npm run test:walk`, `npm run test:sun` and `npm run test:lights` all pass.
  - Browser, headless Chromium:
    - Screenshots by day and night of the hall, kitchen, living area, couch, TV wall, bedroom, bathroom, walk-in, corridor and the view, in June and January, plus state D.
    - With the real E key, all 6 doors open and close, the curtains draw, all switch controls and the desk lamp work, and a door still stops against the player.
    - No console errors.
- **Performance** (measured in headless Chromium, which renders on the CPU, so compare counts rather than frame times):
  - Draw calls are slightly lower than in stage 4, because static parts are batched: hall view 194 (was 217), main room 105 (126), bedroom 69 (89).
  - The heaviest frame, when a door moves and every shadow re-renders, is 1,214 calls (was 1,180).
  - Triangles went from about 5,000 to about 220,000, almost all in the instanced town. That is light for any desktop or laptop GPU.
  - Texture memory is about 70 MB: around 50 canvas textures at 512 px, with mipmaps.
  - Start-up spends about 1.2 s drawing textures, then compiles the shaders.
  - The bundle is about 714 kB (195 kB gzipped).
- **If it runs slowly, simplify in this order:**
  1. `?shadows=low`.
  2. Lower `art.textureResolution` to 256, which saves about 50 MB of texture memory and most of the start-up drawing.
  3. Lower `outdoors.look.maxHouses` (2,000 still fills the near view).
  4. Set `art.fog.density` to 0 and drop the bump maps (`texture.bump`), which saves per-pixel work on weak GPUs.
- **Known problems:**
  - All textures are generated rather than photographed; they read as the right material but plainer than real photos. Allow api.polyhaven.com and dl.polyhaven.org, then run `npm run fetch:textures`.
  - Models are deliberately simple (boxes, cylinders, spheres). Up close, pillows, clothes and the toilet are blocky.
  - Mirrors and glass don't reflect; the mirror is a pale emissive grey.
  - The town's houses all face the same way and repeat their few colours; the road grid is perfectly regular.
  - Under ACES tone mapping, her dark clothes stay close to black next to white walls.
  - In headless tests, the first view of a new direction can take several seconds in software rendering. This is shader and texture upload on the CPU, not the game.
