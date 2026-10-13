// Indoor lighting test (pure, no browser): lights sit in their rooms, every manual
// light has a switch or lamp, switches sit next to doors, light does not pass
// through walls but does spill through open doorways, schedules give the right
// level at the right time, and start-up lights follow the notes' presets.
// Usage: node tools/lights-test.mjs   (exit code 1 on failure)
import { loadHouse, inRect, wallFrame, STATES } from "./lib.mjs";
import { buildRoomGraph, roomIndexAt, lightReach } from "../src/lighting/rooms.js";
import { twilightMinutes, scheduleLevel } from "../src/lighting/schedule.js";
import { createLightState, emittingLights } from "../src/lighting/lightstate.js";

const house = loadHouse(process.argv[2]);
const floor = house.floors[0];
const failures = [];
const fail = (m) => failures.push(m);
const ok = (cond, msg) => { if (!cond) fail(msg); else console.log("ok  ", msg); };
const rooms = Object.fromEntries(floor.rooms.map((r) => [r.id, r]));

// 1. Every emitting light sits in its room, in every state it appears in.
for (const st of STATES) for (const l of emittingLights(floor, st)) {
  const pts = l.position ? [l.position] : [l.from, l.to];
  for (const p of pts) if (!inRect(p[0], p[1], rooms[l.room])) fail(`${l.id} (${st}) is not inside ${l.room}`);
}

// 2. Every manual light is worked by a switch or a lamp; every control names real lights.
const ls = createLightState(house, "A", { date: "2026-06-18", hhmm: "23:00" });
const controlled = new Set(Object.values(ls.controls).flat());
for (const l of ls.lights) if (!l.schedule && !controlled.has(l.id) && l.fitting !== "appliance") fail(`${l.id} has no switch`);
for (const [c, ids] of Object.entries(ls.controls)) for (const id of ids) if (!floor.lights.some((l) => l.id === id)) fail(`${c} controls unknown light ${id}`);
console.log(`${ls.lights.length} emitting lights, ${Object.keys(ls.controls).length} controls`);

// 3. Switches sit next to a door of their room (within 0.4 m of the doorway), except those marked otherwise.
for (const s of floor.switches) {
  if (s.nearDoor === false) continue;
  const d = Math.min(...floor.doors.filter((d) => d.type !== "dummy" && d.connects.includes(s.room)).map((d) => {
    const w = floor.walls.find((w) => w.id === d.wall), f = wallFrame(w);
    const t = Math.max(d.offsetAlongWall, Math.min(d.offsetAlongWall + d.width, (s.position[0] - w.a[0]) * f.ux + (s.position[1] - w.a[1]) * f.uy));
    return Math.hypot(s.position[0] - (w.a[0] + f.ux * t), s.position[1] - (w.a[1] + f.uy * t));
  }));
  ok(d <= 0.4, `${s.id} is ${d.toFixed(2)} m from a door of the ${s.room}`);
}

// 4. Walls stop light; open doorways let a share through along the line of sight.
const g = buildRoomGraph(floor);
const pos = (id) => ls.byId[id].position;
const reach = (light, p, open) => lightReach(g, light, p, roomIndexAt(g, p[0], p[1]), () => (open ? 1 : 0));
const anyLit = (light, room, open) => {
  const r = rooms[room];
  for (let x = r.x[0] + 0.05; x < r.x[1]; x += 0.1) for (let y = r.y[0] + 0.05; y < r.y[1]; y += 0.1) if (reach(light, [x, y, 0], open) > 0) return true;
  return false;
};
ok(!anyLit(pos("L_bed"), "main", false), "bedroom light does not reach the main-room floor with the door shut");
ok(anyLit(pos("L_bed"), "main", true), "bedroom light spills onto the main-room floor through the open door");
ok(reach(pos("L_bed"), [6.0, 8.0, 0], true) === 0, "...but not onto floor out of line with the doorway (by the window corner)");
ok(!anyLit(pos("L_hall_1"), "bathroom", false), "hall light does not reach the bathroom with its door shut");
ok(anyLit(pos("L_hall_1"), "bathroom", true), "hall light spills into the bathroom through its open door");
ok(anyLit(pos("L_kit_1"), "hall", false), "kitchen light reaches the hall through the hall mouth (no door there)");
ok(!anyLit(pos("L_living"), "bedroom", false), "living-room light does not reach the bedroom through the wall");
ok(!anyLit(pos("L_closet"), "bedroom", false) && anyLit(pos("L_closet"), "bedroom", true), "closet light reaches the bedroom only with the closet door open");
ok(reach(pos("L_bed"), [3.6, 5.0, 0], true) === 1 && reach(pos("L_bed"), [3.6, 5.0, 0], false) === 0, "light through a doorway scales with how open the door is");

// 5. Schedules: dusk and dawn from the sun; corridor levels.
const tw = twilightMinutes(house, "2026-06-18");
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
ok(tw.dusk > 22 * 60 && tw.dusk < 23 * 60 && tw.dawn > 5 * 60 && tw.dawn < 6 * 60, `18 Jun dusk ${hm(tw.dusk)}, dawn ${hm(tw.dawn)}`);
const cor = house.indoorLighting.schedules.corridor;
ok(scheduleLevel(cor, 12 * 60, tw) === 0.6 && scheduleLevel(cor, 23 * 60, tw) === 1 && scheduleLevel(cor, 2 * 60, tw) === 0.3 && scheduleLevel(cor, tw.dusk - 5, tw) === 0.6, "corridor: 0.6 by day, full from dusk, 0.3 from 01:00 to dawn");
const twDec = twilightMinutes(house, "2026-12-21");
ok(scheduleLevel(cor, 18 * 60, twDec) === 1 && twDec.dusk < 17 * 60 + 40, `21 Dec dusk ${hm(twDec.dusk)}: corridor already full at 18:00`);

// 6. Start-up lights follow the lighting presets in the notes.
const d = createLightState(house, "D", { date: "2026-10-20", hhmm: "23:00" });
ok(d.on.L_desk_lamp && !d.on.L_living && !d.on.L_kit_1, "state D at 23:00 starts with only the desk lamp on (Phase 6 night)");
const a = createLightState(house, "A", { date: "2026-06-18", hhmm: "07:30" });
ok(Object.values(a.on).every((v) => !v), "state A at 07:30 starts with every light off (Phase 1 morning)");
a.toggle("S_main.kitchen");
ok(a.on.L_kit_1 && a.on.L_kit_2 && a.on.L_kit_3 && !a.on.L_living && a.condition("S_main.kitchen") === "on", "the kitchen gang of the main switch turns on the three kitchen downlights only");

for (const f of failures) console.log("FAIL", f);
console.log(failures.length ? `${failures.length} failures` : "all light tests passed");
process.exit(failures.length ? 1 : 0);
