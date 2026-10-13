// Checks house.json for layout problems: overlaps, gaps, unreachable rooms,
// doors in the wrong place, furniture outside rooms or in a door's swing.
// For a walkability test with the real collision code, see tools/walk-test.mjs.
// Usage: node tools/check-house.mjs   (exit code 1 on errors; warnings do not fail)
import { loadHouse, STATES, wallFrame, pointOnWall, placement, inRect, overlap1, roomsById, hingedDoorGeom } from "./lib.mjs";

const house = loadHouse(process.argv[2]);
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;

// Large items that a person (or a door) cannot pass through.
const SOLID = new Set(["bed_queen", "bedside_table", "desk", "task_chair", "fridge", "base_cabinets", "range", "island", "bar_stool", "media_unit", "couch_3seat", "low_shelf", "washer_dryer_stack", "bath", "ledge", "toilet", "vanity", "drawer_unit", "convector_heater", "boxes_open"]);

function solidRect(p) {
  // Items with a base (the island) collide with the base only below the worktop.
  return { x: p.base?.x ?? p.x, y: p.base?.y ?? p.y };
}

for (const floor of house.floors) {
  const rooms = roomsById(floor);
  const walls = Object.fromEntries(floor.walls.map((w) => [w.id, w]));
  const unit = floor.rooms.filter((r) => r.inUnit);

  // 1. Rooms: inside the box, no overlaps, no gaps.
  const xs = unit.flatMap((r) => r.x), ys = unit.flatMap((r) => r.y);
  const box = { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] };
  const boxArea = (box.x[1] - box.x[0]) * (box.y[1] - box.y[0]);
  let sum = 0;
  for (const r of unit) {
    const a = (r.x[1] - r.x[0]) * (r.y[1] - r.y[0]);
    sum += a;
    if (r.nominalArea && !near(a, r.nominalArea, 0.01)) warn(`${r.id}: area ${a.toFixed(2)} differs from nominalArea ${r.nominalArea}`);
  }
  for (let i = 0; i < unit.length; i++)
    for (let j = i + 1; j < unit.length; j++)
      if (overlap1(unit[i].x, unit[j].x, 1e-6) && overlap1(unit[i].y, unit[j].y, 1e-6)) err(`rooms ${unit[i].id} and ${unit[j].id} overlap`);
  if (!near(sum, boxArea, 1e-6)) err(`rooms cover ${sum.toFixed(2)} m² but the unit box is ${boxArea.toFixed(2)} m² (gap or overlap)`);
  console.log(`unit box ${box.x[1] - box.x[0]} x ${box.y[1] - box.y[0]} m, rooms total ${sum.toFixed(2)} m²`);

  // 2. Doors: on their wall, between the rooms they say they connect.
  const graph = {};
  for (const d of floor.doors) {
    const w = walls[d.wall];
    if (!w) { err(`${d.id}: unknown wall ${d.wall}`); continue; }
    const f = wallFrame(w);
    if (d.offsetAlongWall < -1e-6 || d.offsetAlongWall + d.width > f.len + 1e-6) err(`${d.id}: runs off the end of ${w.id}`);
    if (d.height > (w.height ?? floor.defaultCeilingHeight) + 1e-6) err(`${d.id}: taller than its wall`);
    if (d.type === "dummy") continue;
    const mid = pointOnWall(w, d.offsetAlongWall + d.width / 2);
    const probe = w.thickness / 2 + 0.05;
    const sideA = [mid[0] + f.nx * probe, mid[1] + f.ny * probe], sideB = [mid[0] - f.nx * probe, mid[1] - f.ny * probe];
    const [r1, r2] = d.connects.map((id) => rooms[id]);
    if (!r1 || !r2) { err(`${d.id}: connects unknown room`); continue; }
    const ok = (inRect(...sideA, r1) && inRect(...sideB, r2)) || (inRect(...sideA, r2) && inRect(...sideB, r1));
    if (!ok) err(`${d.id}: is not between ${d.connects.join(" and ")}`);
    if (d.hingePoint) {
      const hp = pointOnWall(w, d.hinge === "end" ? d.offsetAlongWall + d.width : d.offsetAlongWall);
      if (!near(hp[0], d.hingePoint[0], 0.001) || !near(hp[1], d.hingePoint[1], 0.001)) err(`${d.id}: hingePoint ${d.hingePoint} does not match the wall position ${hp.map((v) => v.toFixed(3))}`);
    }
    for (const [a, b] of [d.connects, [...d.connects].reverse()]) (graph[a] ??= []).push(b);
    if (d.type !== "opening" && d.width < 0.6) warn(`${d.id}: only ${d.width} m wide`);
  }

  // 3. Every room reachable from the corridor.
  const seen = new Set(["corridor"]), queue = ["corridor"];
  while (queue.length) for (const n of graph[queue.shift()] ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  for (const r of floor.rooms) if (!seen.has(r.id)) err(`room ${r.id} cannot be reached through a door`);
  console.log(`reachable from the corridor: ${[...seen].join(", ")}`);

  // 4. Furniture per state: inside its room, solid items not overlapping each other.
  const tol = 0.06; // items may sit up to half a partition into a wall
  for (const st of STATES) {
    const placed = floor.furniture.map((it) => placement(it, st)).filter(Boolean);
    for (const p of placed) {
      const r = rooms[p.room];
      if (!r) { err(`${p.id} (${st}): unknown room ${p.room}`); continue; }
      if (!(inRect(p.x[0], p.y[0], r, tol) && inRect(p.x[1], p.y[1], r, tol))) err(`${p.id} (${st}): outside ${p.room}`);
      if (p.z && p.z[1] > r.ceilingHeight + 1e-6) err(`${p.id} (${st}): above the ceiling`);
    }
    const solids = placed.filter((p) => SOLID.has(p.type));
    for (let i = 0; i < solids.length; i++)
      for (let j = i + 1; j < solids.length; j++) {
        const a = solidRect(solids[i]), b = solidRect(solids[j]);
        if (overlap1(a.x, b.x, 0.001) && overlap1(a.y, b.y, 0.001) && overlap1(solids[i].z, solids[j].z, 0.001))
          warn(`${solids[i].id} and ${solids[j].id} overlap in state ${st}`);
      }

    // 5. Door swings clear of solid furniture.
    for (const d of floor.doors.filter((d) => d.type === "hinged" || d.type === "bifold")) {
      const w = walls[d.wall], g = hingedDoorGeom(w, d, rooms);
      const radius = d.type === "bifold" ? d.width / 2 : d.width;
      const along = [(g.free[0] - g.hinge[0]) / d.width, (g.free[1] - g.hinge[1]) / d.width];
      for (const p of solids.filter((p) => (p.z?.[0] ?? 0) < d.height)) {
        const rect = solidRect(p);
        let hit = false;
        for (let k = 0; k <= 12 && !hit; k++) {
          const ang = ((d.maxOpenDeg ?? 90) * Math.PI / 180) * (k / 12);
          for (let s = 0.1; s <= 1 && !hit; s += 0.1) {
            const px = g.hingeFace[0] + s * radius * (along[0] * Math.cos(ang) + g.n[0] * Math.sin(ang));
            const py = g.hingeFace[1] + s * radius * (along[1] * Math.cos(ang) + g.n[1] * Math.sin(ang));
            if (inRect(px, py, rect, -0.005)) hit = true;
          }
        }
        if (hit) warn(`${d.id} hits ${p.id} when it swings (state ${st})`);
      }
    }

    // 6. Curtains: anything crossing the curtain line above the curtain hem.
    const c = floor.curtains;
    if (c) for (const p of placed) if (p.y[0] < c.track.y && p.y[1] > c.track.y && (p.z?.[1] ?? 0) > c.bottom) warn(`${p.id} crosses the curtain line y = ${c.track.y} (state ${st})`);
  }

  // 7. Lights and switches inside their rooms.
  for (const l of floor.lights) {
    const pts = l.position ? [l.position] : l.from ? [l.from, l.to] : Object.values(l.byState ?? {}).map((s) => s.position);
    for (const pt of pts) {
      const ids = (l.room ?? "").split("|");
      if (!ids.some((id) => rooms[id] && inRect(pt[0], pt[1], rooms[id], tol))) err(`light ${l.id} at ${pt} is not in ${l.room}`);
    }
  }
  for (const s of floor.switches) if (!inRect(s.position[0], s.position[1], rooms[s.room], tol)) err(`switch ${s.id} is not in ${s.room}`);

  // 8. Narrowest passages (net, after the partitions).
  const net = (r) => ({ w: r.x[1] - r.x[0] - 0.1, l: r.y[1] - r.y[0] - 0.1 });
  const hall = net(rooms.hall);
  if (hall.w + 0.05 < 1.0) err(`hall is only ${(hall.w + 0.05).toFixed(2)} m wide`);
  console.log(`hall net width ${(hall.w + 0.05).toFixed(2)} m`);

}

// 9. Spawn point inside its room.
const sp = house.player.spawn;
if (!house.floors.some((f) => f.rooms.some((r) => r.id === sp.room && inRect(sp.x, sp.y, r)))) err(`player spawn is not in ${sp.room}`);

for (const w of warnings) console.log("WARN ", w);
for (const e of errors) console.log("ERROR", e);
console.log(`${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
