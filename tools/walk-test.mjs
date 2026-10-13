// Walkability test using the same layout, door and collision code as the browser.
// For every story state:
//   1. with every door open, flood-fills every spot reachable on foot from the spawn
//      point; every room has reachable floor and nothing leaks outside the rooms;
//   2. with every door closed, only the hall and main room (joined by an opening) are reachable;
//   3. starting with every door closed, opening only doors within reach of where you
//      can already walk, every room becomes reachable;
//   4. every door swings from closed to fully open without hitting walls or furniture;
//   5. no reachable spot is inside a wall, a door leaf or a piece of furniture.
// Then, once: tries to walk straight through every wall piece and the glass, from both sides.
// Usage: node tools/walk-test.mjs   (exit code 1 on failure)
import { loadHouse, STATES, inRect, wallFrame } from "./lib.mjs";
import { houseBoxes } from "../src/house/layout.js";
import { furnitureBoxes } from "../src/furniture/layout.js";
import { buildColliders, move } from "../src/player/collision.js";
import { createDoorSystem } from "../src/doors/doors.js";
import { leafPlacements, distanceToSegment } from "../src/doors/kinematics.js";

const house = loadHouse(process.argv[2]);
const floor = house.floors[0];
const { radius, stepHeight, headHeight, spawn } = house.player;
const failures = [];
const fail = (m) => failures.push(m);

const structure = houseBoxes(floor);
const wallRects = buildColliders(structure, { stepHeight, headHeight });

const G = 0.05;
const DEG = Math.PI / 180;
const roomOf = (c) => floor.rooms.find((r) => inRect(c.x, c.y, r));

// Flood fill on a 5 cm grid using real moves.
function flood(colliders) {
  const key = (i, j) => `${i},${j}`;
  const i0 = Math.round(spawn.x / G), j0 = Math.round(spawn.y / G);
  const seen = new Set([key(i0, j0)]), queue = [[i0, j0]], cells = [];
  while (queue.length) {
    const [i, j] = queue.pop();
    const p = { x: i * G, y: j * G };
    cells.push(p);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      const q = move({ ...p }, di * G, dj * G, radius, colliders);
      if (Math.hypot(q.x - (i + di) * G, q.y - (j + dj) * G) < 1e-4) { seen.add(k); queue.push([i + di, j + dj]); }
    }
  }
  const perRoom = Object.fromEntries(floor.rooms.map((r) => [r.id, 0]));
  for (const c of cells) { const r = roomOf(c); if (r) perRoom[r.id]++; }
  return { cells, perRoom };
}

// A look-in cupboard counts as reached if you can stand within half a metre of its door.
function reached(id, { cells, perRoom }) {
  const room = floor.rooms.find((r) => r.id === id);
  if (room.walkIn !== false) return perRoom[id] > 0;
  const door = floor.doors.find((d) => d.connects.includes(id));
  const w = floor.walls.find((w) => w.id === door.wall), f = wallFrame(w);
  const mid = [w.a[0] + f.ux * (door.offsetAlongWall + door.width / 2), w.a[1] + f.uy * (door.offsetAlongWall + door.width / 2)];
  return cells.some((c) => Math.hypot(c.x - mid[0], c.y - mid[1]) < 0.5);
}

// Horizontal reach to a door handle from eye height, within the interaction distance.
const reach = Math.sqrt(Math.max(0, house.interaction.maxDistance ** 2 - (house.player.eyeHeight - (house.doorMotion.handleHeight ?? 1)) ** 2));

for (const state of STATES) {
  const staticRects = buildColliders([...structure, ...furnitureBoxes(floor, state)], { stepHeight, headHeight });
  const doors = createDoorSystem(house);
  const withDoors = () => [...staticRects, ...doors.segments()];
  const start = move({ x: spawn.x, y: spawn.y }, 0, 0, radius, withDoors());
  if (Math.hypot(start.x - spawn.x, start.y - spawn.y) > 1e-6) fail(`${state}: spawn point is inside something`);

  // 1. All doors open.
  for (const d of doors.doors) doors.setAngle(d.id, d.frame.maxAngle);
  const open = flood(withDoors());
  console.log(`state ${state}, all doors open: ${Object.entries(open.perRoom).map(([id, n]) => `${id} ${(n * G * G).toFixed(1)}m²`).join(", ")}`);
  for (const r of floor.rooms) if (!reached(r.id, open)) fail(`${state}: cannot walk into ${r.id} with every door open`);
  checkCells(state, open.cells, withDoors());

  // 2. All doors closed.
  for (const d of doors.doors) doors.setAngle(d.id, 0);
  const closed = flood(withDoors());
  const closedRooms = Object.entries(closed.perRoom).filter(([, n]) => n > 0).map(([id]) => id);
  if (closedRooms.sort().join() !== "hall,main") fail(`${state}: with every door closed you can reach ${closedRooms.join(", ")}`);
  checkCells(state, closed.cells, withDoors());

  // 3. Open doors one by one, only those within reach of where you can already stand.
  const opened = [];
  for (;;) {
    const now = flood(withDoors());
    const next = doors.doors.find((d) => d.angle === 0 && leafPlacements(d.frame, 0).some((p) => {
      const mid = [p.start[0] + (p.dir[0] * p.length) / 2, p.start[1] + (p.dir[1] * p.length) / 2];
      return now.cells.some((c) => Math.hypot(c.x - mid[0], c.y - mid[1]) <= reach);
    }));
    if (!next) {
      const missing = floor.rooms.filter((r) => !reached(r.id, now)).map((r) => r.id);
      if (missing.length) fail(`${state}: opening reachable doors never reaches ${missing.join(", ")}`);
      break;
    }
    doors.setAngle(next.id, next.frame.maxAngle);
    opened.push(next.id);
  }
  console.log(`state ${state}, doors opened in order: ${opened.join(" -> ")}`);
  if (opened.length !== doors.doors.length) fail(`${state}: only ${opened.length} of ${doors.doors.length} doors could be reached and opened`);

  // 4. Swing clearance: sample each leaf from closed to open against walls and furniture.
  for (const d of doors.doors) {
    for (let a = 0; a <= d.frame.maxAngle + 1e-9; a += 2 * DEG) {
      for (const p of leafPlacements(d.frame, Math.min(a, d.frame.maxAngle))) {
        for (let t = 0.03; t <= p.length; t += 0.02) {
          const x = p.start[0] + p.dir[0] * t, y = p.start[1] + p.dir[1] * t;
          const hit = staticRects.find((r) => x > r.x0 + 1e-3 && x < r.x1 - 1e-3 && y > r.y0 + 1e-3 && y < r.y1 - 1e-3);
          if (hit) { fail(`${state}: ${d.id} hits ${hit.id} at ${(a / DEG).toFixed(0)}°`); a = Infinity; break; }
        }
        if (a === Infinity) break;
      }
    }
  }
}

// 5. No reachable spot overlaps a collider.
function checkCells(state, cells, colliders) {
  for (const c of cells) {
    if (!roomOf(c)) {
      // Allowed only inside a doorway (between two rooms)
      const inDoorway = floor.doors.some((d) => {
        if (d.type === "dummy") return false;
        const w = floor.walls.find((w) => w.id === d.wall), f = wallFrame(w);
        const rx = c.x - w.a[0], ry = c.y - w.a[1];
        const along = rx * f.ux + ry * f.uy, across = rx * f.nx + ry * f.ny;
        return along >= d.offsetAlongWall - 1e-6 && along <= d.offsetAlongWall + d.width + 1e-6 && Math.abs(across) <= w.thickness / 2 + 1e-6;
      });
      if (!inDoorway) fail(`${state}: reachable spot (${c.x.toFixed(2)}, ${c.y.toFixed(2)}) is outside every room`);
    }
    for (const r of colliders) {
      const d = r.kind === "seg" ? distanceToSegment(c.x, c.y, r) - r.half : Math.hypot(c.x - Math.min(Math.max(c.x, r.x0), r.x1), c.y - Math.min(Math.max(c.y, r.y0), r.y1));
      if (d < radius - 1e-3) { fail(`${state}: spot (${c.x.toFixed(2)}, ${c.y.toFixed(2)}) overlaps ${r.id}`); break; }
    }
  }
}

// 2. Walk straight at every wall from both sides, along the wall's normal; it must never cross.
// Samples stay a body-width away from the ends of each solid stretch, because next to a door
// jamb the body can rightly slide into the doorway.
let tries = 0;
for (const w of floor.walls) {
  const f = wallFrame(w);
  const along = (x, y) => (x - w.a[0]) * f.ux + (y - w.a[1]) * f.uy;
  const pieces = structure.filter((b) => b.collide && b.z[0] < stepHeight && b.z[1] > headHeight && b.wall === w.id);
  const spans = pieces.map((b) => {
    const ts = [along(b.x[0], b.y[0]), along(b.x[1], b.y[1]), along(b.x[0], b.y[1]), along(b.x[1], b.y[0])];
    return [Math.min(...ts), Math.max(...ts)];
  }).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const sp of spans) if (merged.length && sp[0] <= merged.at(-1)[1] + 1e-6) merged.at(-1)[1] = Math.max(merged.at(-1)[1], sp[1]); else merged.push([...sp]);
  for (const [t0, t1] of merged) {
    for (let t = t0 + radius + 0.02; t <= t1 - radius - 0.02; t += 0.05) {
      for (const side of [1, -1]) {
        const off = w.thickness / 2 + radius + 0.01;
        const cx = w.a[0] + f.ux * t, cy = w.a[1] + f.uy * t;
        const p = { x: cx + f.nx * off * side, y: cy + f.ny * off * side };
        const settled = move({ ...p }, 0, 0, radius, wallRects);
        if (Math.hypot(settled.x - p.x, settled.y - p.y) > 1e-3) continue; // start is inside another wall (a corner)
        for (const stepCount of [1, 25]) {
          const q = { ...p };
          for (let k = 0; k < stepCount; k++) move(q, (-f.nx * side) / stepCount, (-f.ny * side) / stepCount, radius, wallRects);
          const after = (q.x - cx) * f.nx * side + (q.y - cy) * f.ny * side;
          tries++;
          if (after < w.thickness / 2 + radius - 1e-3) { fail(`walked through ${w.id} at ${t.toFixed(2)} from side ${side}`); break; }
        }
      }
    }
  }
}
console.log(`wall crossing attempts: ${tries}, all blocked: ${!failures.some((f) => f.startsWith("walked"))}`);

for (const f of failures.slice(0, 40)) console.log("FAIL", f);
console.log(failures.length ? `${failures.length} failures` : "all walk tests passed");
process.exit(failures.length ? 1 : 0);
