# Assumptions

Every value in `house.json` that the design notes do not give is listed here, grouped by room. Anything the notes state clearly (all of section 14's coordinates, the 6.5 × 10.0 m box, the 2.6 m ceiling, the south-east glass, etc.) is kept exactly and is **not** listed, except where it clashes with something else in the notes (see "Clashes in the notes").

In `house.json`, every item has a `basis` field: `notes`, `assumed`, or `notes+assumed`. To change a value, edit `house.json`, run `npm run check`, then `npm run floorplan`.

---

## Review these first

1. **The desk in the window corner (states D–F) is mirrored from the prose.** Section 7 says "the window is on her right as she sits" and "the couch is behind her, to her left". With the section 14 coordinates (desk against the right-hand wall x = 6.5, facing it), the window is on her **left** and the couch is behind her to her **right**. I kept the coordinates. If the prose is right, the desk has to go on the left-hand wall, which is the kitchen.
2. **That desk crosses the curtain line.** The desk runs to y = 9.8 and the curtain track is at y = 9.75, so the closed curtain would cut 5 cm into the desk. I kept y 8.4–9.8 as written. Suggested fix: y 8.3–9.7.
3. **Eye height 1.6 m vs "Charlotte is small".** An eye height of 1.6 m means someone about 1.72 m tall. For a small woman (1.55–1.60 m), the eye height would be 1.45–1.50 m. I kept 1.6 and set her NPC height to 1.72 to match.
4. **The sun runs late on the clock.** Thunder Bay uses Eastern time but sits far west, so in summer the clock is about two hours ahead of the sun. On 18 Jun 2026: sunrise 05:56, low sun from the left 07:00–10:00 (as the notes want), sun squarely on the glass about 12:25, gone from the glass about 15:45, sunset 22:01. So the get-together's "city lights through the glass" only work after about 23:00. I moved that lighting preset to 23:00.
5. **The bathroom prose doesn't match the coordinates.** Coming in from the hall (facing +x), the bath is on your right, the vanity on your **left** and the toilet **straight ahead**. The notes say "toilet on the right-hand wall" and "vanity facing you as you come in". I kept the coordinates.
6. **"A narrow door in the left-hand wall" of the bedroom (walk-in closet).** The coordinates put it in the wall x = 3.0. That is the plan's left, but it is on your **right** as you walk into the bedroom. I kept the coordinates.
7. **I added a light in the walk-in closet** (`L_closet`, 400 lm). It is not in the notes' light list, and without it the closet would be pitch black. Delete it if the list is meant to be complete.
8. **NPC routines and visit times are all invented.** See the NPC section below.

---

## Clashes in the notes (kept as written, flagged)

| Where | Notes say | Coordinates give | What I did |
| --- | --- | --- | --- |
| Main-room desk (D–F) | window on her right, couch behind to her left | window on her left, couch behind to her right | kept coordinates |
| Main-room desk (D–F) | y 8.4–9.8 | curtain track y 9.75 | kept; check warns |
| Bathroom | toilet on the right-hand wall; vanity facing you | toilet ahead; vanity on your left | kept coordinates |
| Bedroom | closet door in the left-hand wall | on your right as you enter | kept coordinates |
| Player | Charlotte is small | eye height 1.6 m implies about 1.72 m tall | kept 1.6 |
| Toilet | x 2.45–3.0 against x = 3.0 | the partition face is at 2.95 | kept; it sits 5 cm into the wall, which can't be seen |

---

## Whole flat and building

- **Wall placement:** interior partitions (0.1 m, from the notes) are centred on the notes' lines, so each room loses 5 cm on each partition side. Net hall width is 1.15 m. Exterior walls sit outside the 6.5 × 10.0 box, so the box stays the inside dimension.
- **Exterior wall thickness:** corridor wall and both neighbour (demising) walls are 0.2 m. The glass wall's frame depth is 0.15 m.
- **Neighbours:** the left wall (x = 0) backs onto a neighbour's unit to the NE, the right wall (x = 6.5) onto one to the SW.
- **Floor heights:** ground floor 4.5 m floor-to-floor, then 3.0 m. That puts the unit floor 61.5 m above the street and the roof at about 76.5 m. Slab 0.4 m.
- **Floors:** grey wood-look vinyl in the laundry, coat cupboard and walk-in too, not just in the hall, main room and bedroom.
- **Colours:** all hex values in `materials`, matched to the notes' words (flat white, grey, stainless, deep blue-green, black aluminium).
- **Compass mapping:** +y = SE (135°), +x = SW, −x = NE, −y = NW (corridor side).
- **Latitude/longitude:** 48.38 N, 89.25 W. Time zone America/Toronto.

## Outside (what you see from the glass)

- **Ground** 61.5 m below the floor.
- **Tower's own parking lot** directly below the window, 55 × 40 m, about 35 m out.
- **The street** runs across the view NE–SW, 70 m out, 14 m wide, street lights every 35 m, trees every 12 m on both sides (bare late Oct to mid May).
- **Low roofs:** a grid of 1–2 storey houses (6–9 m), lots 15 × 30 m, side streets every 110 m, out to 3 km. About 20% of their windows lit in the evening.
- **Nearest building:** 4 storeys, bearing 105°, 140 m away.
- **Parking lots:** bearing 120°/260 m (80 × 60) and bearing 165°/520 m (120 × 70).
- **Church spire:** bearing 150°, 900 m, nave 14 × 32 × 12 m, spire 42 m.
- **Lake Superior sliver:** between two 8-storey buildings at bearings 84° and 96° (about 650 m out). The water is a narrow wedge at bearings 87–93° from 1.5 km out. Real geography would probably show more lake from this height; I cut it to a wedge so only the sliver the notes describe shows. Frozen 10 Jan to 5 Apr.
- **Hills to the right:** a ridge at bearings 195–255°, 6–9 km out, 120–280 m high, snow in winter.
- **Radio mast:** bearing 175°, 3.2 km, 110 m tall, red lights at 37/74/110 m blinking 30 times a minute.
- **Seasons:** snow cover 20 Nov to 10 Apr. Heating season 1 Oct to 30 Apr. Frost in the glass corners on Dec–Feb nights below −15 °C.

## Corridor (floor 21)

- A stub 14.5 m long (x −4.0 to 10.5) and 1.8 m wide, ceiling 2.45 m, with the lift at the x = −4 end.
- Corridor walls are light warm grey (`#C9C7C2`).
- Decor doors (not openable): neighbours' doors at x −2.0 and x 8.0, two across the corridor, and stainless lift doors in the end wall.
- Five downlights, always on.
- The unit number plate is left blank (the notes leave the number open).

## Front door and hall

- **Front door:** hinge on the left (x = 0.15), so it opens flat toward the left wall. 0.045 m leaf. Opens up to 95°. Self-closes in about 5 s. Starts closed and locked. Spy-hole at 1.55 m.
- **Door panel:** 0.08 × 0.30 m, z 1.25–1.55 (centre 1.4 from the notes). There is a matching panel outside, without the intercom.
- **Status light colours:** red `#FF2A2A`, green `#2AFF5A`, keypad blue `#3A78FF`.
- **Thermostat:** z 1.45–1.57 at y 4.15–4.27 on the left wall.
- **Hall switch:** on the right-hand wall by the front door (y 0.25, 1.1 m high), working both hall lights.
- **Hall lights:** 650 lm, 4000 K, 100° beam (position from the notes).
- **Hall mouth:** open to the full 2.6 m ceiling, with no header above it.

## Laundry cupboard

- **Bifold:** one two-leaf bifold, 0.8 m wide (y 2.5–3.3), 2.1 m high, folding out into the hall, hinged at the corridor end. Starts closed.
- **Detergent box:** on top of the dryer, 0.25 × 0.2 × 0.25 m.
- **No light inside** (lit from the hall).

## Coat cupboard

- **Bifold:** 0.8 m wide (y 3.5–4.3), same type as the laundry's. Starts closed.
- **Fittings:** rail 0.4 m in from the doors (x 1.6). Shelf 0.3 m deep at the back. Her coat hangs from the rail and her shoes sit on the floor.

## Bathroom

- **Door:** hinged at the corridor end (y = 1.0), swings into the bathroom, starts open.
- **Bath ledge:** the 1.52 m bath leaves a 0.18 m gap to the wall at x = 3.0, so I filled it with a tiled ledge at bath height.
- **Shower:** showerhead and lever on the hall-side wall (x = 1.2) at the bath's end. Lever at 1.1 m. Curtain rail along the bath's open side at 2.05 m, running to the wall; curtain from 0.55 to 2.05 m.
- **Towel rail:** on the wall left of the vanity (x 1.28–1.75), 1.2 m high, with two grey towels.
- **Mirror cabinet:** 0.12 m deep. Contents by state: A has plasters and Venus's toothbrush (the notes' optional prose detail). C has the pharmacy bag with her pills. D–F has the bag, empty.
- **Light bar:** 1000 lm, 4000 K, at 1.79 m. Switch inside the door on the latch side (y 1.85, 1.1 m).
- **Extractor fan:** in the ceiling at (2.4, 1.4).

## Walk-in closet

- **Door:** hinged at y = 2.6, swings out into the bedroom (swinging in, it would hit the rail). Starts closed.
- **Rail:** 0.3 m from the left wall (x 2.3), from the door end to the drawers (y 2.45–4.0).
- **Shelf:** 0.55 m deep (x 2.05–2.6).
- **Four-drawer unit:** 0.9 × 0.35 m, at the far end.
- **His box:** 0.5 × 0.5 × 0.3 m on the top shelf.
- **Light:** `L_closet`, added (see "Review these first", item 7). Switch on the bedroom side of the closet door.

## Bedroom

- **Door:** hinged at the hall end (x = 3.2), swings in toward the closet wall. The latch side is next to the switch and climate panel. Undercut 2 cm. Starts closed, so the bedroom is dark in the Phase 1 morning.
- **Air grille:** above the door, 0.8 × 0.2 m, at z 2.2–2.4.
- **Bed details:** headboard 1.1 m high, 8 cm deep. His side is y < 2.2, hers y > 2.2.
- **Bedside table:** holds her ribbon (state A) and her phone (A–C).
- **Light switch:** at x 4.1, 1.05 m high, below the climate panel.
- **Ceiling light:** centred at (4.75, 2.2), 1500 lm, 4000 K.
- **Desk props:** chair 0.6 × 0.6 m. Monitor 0.55 m wide on the right of the desk. Laptop on the left. Keyboard in front. Lamp at the right-hand back corner.

## Main room: kitchen

- **Zones:** kitchen x 0–3.1, living x 3.1–6.5. The notes say living is about two-thirds, but the island and stools reach x 3.1.
- **Fridge door:** hinged on the hall side (y = 4.5), so it opens away from the counter.
- **Uppers over the microwave:** a short cupboard (z 1.9–2.2) fills the space above it.
- **Kettle:** on the counter between the range and the sink (y 7.95–8.15). "Beside it" in the notes was ambiguous.
- **Sink:** bowl 0.21 m deep; tap at the back, 0.34 m high.
- **Cupboard contents:** plates, bowls, mugs and glasses in the cupboards nearer the fridge. Venus's pans, the knife and the board in the cupboards nearer the sink.
- **Fridge contents by state:** B still has his containers. C has two containers. D–E almost nothing. F empty, off, door ajar.
- **Kitchen downlights:** centred on the galley at x 1.2, at y 5.8 / 7.2 / 8.6. 800 lm each, 4000 K.
- **Under-cupboard strip:** 900 lm, 5000 K (cold white, as in the notes).
- **Main switch:** by the hall mouth (x 1.35, 1.1 m), two gangs: kitchen and living. The under-cupboard lights have their own switch under the cupboard.
- **Island:** worktop at 0.88–0.91 m, base 0.9 m deep, overhang 0.3 m (from the notes).

## Main room: living

- **TV:** sits on a central pedestal stand on the media unit. The panel is 7 cm thick.
- **Console:** white, upright, 0.10 × 0.26 × 0.39 m. Two controllers in front of it. Three game cases in front of the TV's right side. Dust from state B.
- **Turntable:** 0.44 × 0.32 m, centred on the shelf. Speakers 0.25 m tall at each end.
- **The eight records:** upright in the shelf, in shop wrap. Sleeve colour is a placeholder.
- **Pages on the couch:** cover the seat edge to edge (states D, E).
- **Main-room desk props (D–F):** chair 0.55 m. Monitor against the wall. Pill strip, phone and mug at the front-left corner. Printouts by them. Laptop at the window end.
- **Boxes (E–F):** three open boxes in the window corner, x 3.4–4.6, y 8.5–9.1, 0.45 m tall.
- **Keys (E):** fob and mailbox key on one ring, middle of the island.
- **Living ceiling light:** 1500 lm, 4000 K, 0.35 m across.

## Windows, curtains, heat

- **Panels:** six panels of 1.0833 m, frames 5 cm, sill at 0 (floor to ceiling).
- **Vent:** I read the "narrow vent panel at the kitchen end" as a 0.35 × 1.2 m sash inside panel W1 (x 0.05–0.40, z 0.9–2.1), hinged at the bottom and tilting in up to 5 cm at the top.
- **Curtains:** two halves, left closing to x 3.3 and right to x 3.2 (10 cm overlap). Each stacks 0.45 m deep at its wall when open. Drawing takes 3 s. Light leaks at the edges when closed.
- **When the curtains are open:** state A, 07:00–23:00. All other states closed (B from 10:00).

## Lighting

- **Colour temperature:** all building fittings 4000 K, except the under-cupboard strip (5000 K, from the notes) and the desk lamp (3000 K).
- **Brightness:**

  | Fitting | Lumens |
  | --- | --- |
  | Hall downlights | 650 |
  | Kitchen downlights | 800 |
  | Under-cupboard strip | 900 total |
  | Living and bedroom flush lights | 1500 |
  | Bathroom bar | 1000 |
  | Desk lamp | 450 (55° beam) |
  | Closet | 400 |
  | Fridge interior | 100 |
  | Indicators | 0.5–8 |

- **Desk lamp aim:** in A–C at the desk. In D–F at the wall just above the desk.
- **Lighting preset times:** Phase 1 morning 07:30 on 18 Jun. Get-together night 23:00 on 17 Jun. Phase 6 night 23:00 on 20 Oct. Phase 7 afternoon 14:30 on 7 Nov.
- **Time-of-day presets:** morning 07:30, noon 13:58, night 23:00, and a winter night with frost on 20 Jan 2027 at 23:00.
- **Clock speed:** 60× real time (one game minute per real second).

## Sound

- **Fridge:** compressor on 12 min, off 18 min. Silent in state F.
- **Kettle:** 150 s heating before the click.
- **Wind:** 1.4× louder at night (22:00–06:00) and October to March.
- **Convector:** ticks every 5–20 s for 10 min in each 30, from 17:00 to 09:00, in heating season.
- **Lift chime:** every 4–15 min between 06:00 and 01:00, muffled when the front door is shut.
- **Extractor fan:** runs with the bath light and for 10 min after (from the notes).
- **Added sounds the notes don't mention:** shower, cooking, washer (45 min), distant city (very faint, 07:00–22:00), toilet, taps, curtains, switches, footsteps (soft on vinyl, harder on tile, muffled on carpet).
- **Volumes and distances:** all the `volume` and `refDistance` values are first guesses.
- **Optional Surge sounds:** the child's voice and the radio behind the clerk are in, but switched off by default (Derrick decides).
- **The record:** a placeholder of three soft beats and a silent fourth, since the piece is not chosen.

## NPCs

- **Heights and colours** (placeholders): Venus 1.85, Michael 1.80, Scott 1.78, Hamster 1.75, Paulina 1.68, Daniel 1.80, Darton 1.80, Charlotte 1.72. Plain colours for placeholder figures.
- **Charlotte is the player by default.** She only appears as an NPC in "observer" mode.
- **Venus, state A day:** asleep until 07:00. Curtains 07:00. Cooks 07:03–07:35. Packs her breakfast until 07:55. Tidies for 32 minutes (07:55–08:27). Leaves 08:32. Back 18:30 to cook. Couch far end 19:30–22:30. Cold shower 22:30. Bed 22:45.
- **Charlotte, state A:** up 06:50. Leaves first at 08:00. Back 19:30. Bedroom desk until 22:30. Shower with him. Bed.
- **Charlotte, states B–F:** B works on the floor by the island and draws the curtains at 10:00. C packs his box 15:00–16:00. D at the main desk, sleeping 03:00–09:00. E Darton visits. F away all day.
- **Visit times:**

  | Visit | Time |
  | --- | --- |
  | Get-together | Wed 17 Jun, 19:00–23:30 |
  | Paulina | 18 Aug, 18:00–18:45 |
  | Daniel | 20 Oct, 19:30–20:00 |
  | Darton | Sat 7 Nov, 14:00–15:10 |

  The intercom buzzes 2 minutes before each visitor reaches the door.
- **Venus at the get-together:** at the island until 20:30, standing until 21:00, then on the couch's far end.
- **Visitor spots:** Daniel stands at (3.4, 6.2) looking at the TV wall. Darton fills the kettle at 14:10, then sits on the couch from 14:15 after she lifts the pages.

## Story states

- **State F** follows the notes' "Proposed reading": boxes stay, fridge off, desk lamp off, nobody home.
- **Phone:** on the bedside table in A–C, on the desk in D–E.
