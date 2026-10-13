// Sunlight test: traces rays from the floor toward the sun through the real
// geometry (walls, slabs, ceilings, window frames, closed doors, furniture;
// glass lets light through) at many dates and times. Checks that direct sun
// lands only where windows let it, at the right times and from the right side.
// Usage: node tools/sun-test.mjs   (exit code 1 on failure)
import { loadHouse, inRect } from "./lib.mjs";
import { houseBoxes } from "../src/house/layout.js";
import { furnitureBoxes } from "../src/furniture/layout.js";
import { createDoorSystem } from "../src/doors/doors.js";
import { leafPlacements } from "../src/doors/kinematics.js";
import { createCurtainSystem } from "../src/curtains/curtains.js";
import { environmentAt } from "../src/time/environment.js";
import { localToUtcMs } from "../src/time/zone.js";

const house = loadHouse(process.argv[2]);
const floor = house.floors[0];
const tz = house.site.timeZone;
const failures = [];
const fail = (m) => failures.push(m);
const STEP = 0.1;
const INSET = 0.06; // sample each room inside its walls, not the thresholds under its doors

// Opaque boxes for a state: everything except glass, with doors shut.
function blockers(state, curtainsClosed) {
  const boxes = [...houseBoxes(floor).filter((b) => ["wall", "frame", "slab", "ceiling", "dummyDoor"].includes(b.role)), ...furnitureBoxes(floor, state)];
  for (const d of createDoorSystem(house).doors) {
    for (const p of leafPlacements(d.frame, 0)) {
      const x = [p.start[0], p.start[0] + p.dir[0] * p.length], y = [p.start[1], p.start[1] + p.dir[1] * p.length];
      const t = p.thickness / 2;
      boxes.push({ id: `leaf:${d.id}`, x: [Math.min(...x) - t, Math.max(...x) + t], y: [Math.min(...y) - t, Math.max(...y) + t], z: d.frame.z });
    }
  }
  if (curtainsClosed) {
    const c = createCurtainSystem(house, state);
    c.setOpen(false);
    for (const r of c.colliders()) boxes.push({ id: r.id, x: [r.x0, r.x1], y: [r.y0, r.y1], z: [c.def.bottom, c.def.track.z] });
  }
  return boxes;
}

// Does a ray from p in direction d hit any box? (slab method)
function blocked(p, d, boxes) {
  for (const b of boxes) {
    let t0 = 1e-6, t1 = 1e9;
    for (const [o, v, [lo, hi]] of [[p[0], d[0], b.x], [p[1], d[1], b.y], [p[2], d[2], b.z]]) {
      if (Math.abs(v) < 1e-12) { if (o < lo || o > hi) { t0 = 1; t1 = 0; break; } continue; }
      let a = (lo - o) / v, c = (hi - o) / v;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return true;
  }
  return false;
}

// Sunlit floor samples per room for one moment.
function sunlit(state, date, hhmm, curtainsClosed = false) {
  const [h, m] = hhmm.split(":").map(Number);
  const env = environmentAt(house, localToUtcMs(date, h * 60 + m, tz));
  const out = { env, perRoom: {}, spots: [], byRoom: {} };
  for (const r of floor.rooms) out.perRoom[r.id] = 0;
  if (env.sun.altitude <= 0) return out;
  const boxes = blockers(state, curtainsClosed);
  for (const r of floor.rooms) {
    for (let x = r.x[0] + INSET + STEP / 2; x < r.x[1] - INSET; x += STEP)
      for (let y = r.y[0] + INSET + STEP / 2; y < r.y[1] - INSET; y += STEP) {
        if (boxes.some((b) => b.z[0] <= 0.001 && b.z[1] > 0.001 && inRect(x, y, b))) continue; // under furniture or a wall
        if (!blocked([x, y, 0.001], env.sun.dir, boxes)) { out.perRoom[r.id]++; (out.byRoom[r.id] ??= []).push([x, y]); if (r.id === "main") out.spots.push([x, y]); }
      }
  }
  return out;
}

const area = (n) => n * STEP * STEP;
const UNDER_DOOR = 0.15;
// Distance from a plan point to the nearest door opening (on its wall's centreline).
function distanceToDoor([x, y]) {
  let best = Infinity;
  for (const d of floor.doors.filter((d) => d.type !== "dummy")) {
    const w = floor.walls.find((w) => w.id === d.wall);
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len;
    const t = Math.max(d.offsetAlongWall, Math.min(d.offsetAlongWall + d.width, (x - w.a[0]) * ux + (y - w.a[1]) * uy));
    best = Math.min(best, Math.hypot(x - (w.a[0] + ux * t), y - (w.a[1] + uy * t)));
  }
  return best;
}
const mean = (a, i) => a.reduce((s, p) => s + p[i], 0) / (a.length || 1);
const windowless = floor.rooms.filter((r) => r.id !== "main" && r.id !== "hall").map((r) => r.id);
const glassY = Math.min(...houseBoxes(floor).filter((b) => b.role === "glass").map((b) => b.y[0]));

const days = [["2026-06-18", "A"], ["2026-08-18", "C"], ["2026-11-07", "E"], ["2026-12-21", "A"]];
const summary = {};
for (const [date, state] of days) {
  console.log(`\n${date} (state ${state} furniture), doors shut, curtains open`);
  for (let h = 5; h <= 21; h++) {
    const hhmm = `${String(h).padStart(2, "0")}:00`;
    const s = sunlit(state, date, hhmm);
    const sun = s.env.sun;
    const lit = Object.entries(s.perRoom).filter(([, n]) => n > 0).map(([id, n]) => `${id} ${area(n).toFixed(2)}m²`).join(", ") || "-";
    const patch = s.spots.length ? ` · patch centre x ${mean(s.spots, 0).toFixed(2)}, deepest ${(glassY - Math.min(...s.spots.map((p) => p[1]))).toFixed(1)} m from the glass` : "";
    console.log(`  ${hhmm} sun alt ${sun.altitude.toFixed(1).padStart(5)} az ${sun.azimuth.toFixed(0).padStart(3)}  lit: ${lit}${patch}`);
    summary[`${date} ${hhmm}`] = s;
    // A windowless room may only get the sliver that slips under a closed door's gap.
    for (const id of windowless) {
      const far = (s.byRoom[id] ?? []).filter((p) => distanceToDoor(p) > UNDER_DOOR);
      if (far.length) fail(`${date} ${hhmm}: direct sun ${far.length} spots deep in the ${id}, which has no window`);
    }
    if (sun.altitude <= 0 && Object.values(s.perRoom).some((n) => n > 0)) fail(`${date} ${hhmm}: sunlit floor with the sun down`);
  }
}

// The morning sun comes from the left (NE/E side), so its patch lies right of where afternoon sun falls.
const m8 = summary["2026-06-18 08:00"], a14 = summary["2026-06-18 14:00"], n13 = summary["2026-06-18 13:00"];
if (!(m8.spots.length && a14.spots.length)) fail("18 Jun: no sun in the main room at 08:00 or 14:00");
else if (!(mean(m8.spots, 0) > mean(a14.spots, 0) + 0.3)) fail(`18 Jun: morning patch (x ${mean(m8.spots, 0).toFixed(2)}) is not to the right of the afternoon patch (x ${mean(a14.spots, 0).toFixed(2)})`);
if (m8.env.sun.dir[0] >= 0) fail("18 Jun 08:00: sun is not on the left (-x) side of the window");
// Low sun reaches deeper into the room than high sun.
const depth = (s) => glassY - Math.min(...s.spots.map((p) => p[1]));
if (!(depth(m8) > depth(n13))) fail("18 Jun: the 08:00 patch does not reach deeper than the 13:00 patch");
// Winter: the low noon sun reaches much deeper than the summer noon sun.
if (!(depth(summary["2026-12-21 13:00"]) > depth(n13) + 1.5)) fail("21 Dec: the noon patch is not much deeper than in June");
// After about 15:45 in June the sun is behind the tower face: no direct sun.
if (Object.values(summary["2026-06-18 17:00"].perRoom).some((n) => n > 0)) fail("18 Jun 17:00: sun still in the flat");

// Closed curtains: only a thin leak (under the hem) may remain.
const open10 = sunlit("A", "2026-06-18", "10:00"), shut10 = sunlit("A", "2026-06-18", "10:00", true);
console.log(`\n18 Jun 10:00 main-room sun: curtains open ${area(open10.perRoom.main).toFixed(2)} m², closed ${area(shut10.perRoom.main).toFixed(2)} m²`);
// The notes allow a thin line of daylight at the curtain; it must stay right at the curtain.
const track = floor.curtains.track.y;
const strayed = shut10.spots.filter((p) => track - p[1] > 0.3);
console.log(`closed-curtain light lies ${shut10.spots.length ? (track - Math.min(...shut10.spots.map((p) => p[1]))).toFixed(2) : 0} m or less from the curtain (under the hem)`);
if (strayed.length) fail(`closed curtains let sun more than 0.3 m into the room (${strayed.length} spots)`);

for (const f of failures) console.log("FAIL", f);
console.log(failures.length ? `${failures.length} failures` : "all sun tests passed");
process.exit(failures.length ? 1 : 0);
