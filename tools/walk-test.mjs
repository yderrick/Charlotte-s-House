// Walkability test using the same layout and collision code as the browser.
// For every story state:
//   1. flood-fills every spot reachable on foot from the spawn point, and
//      checks every room has reachable floor and nothing leaks outside the rooms;
//   2. tries to walk straight through every wall piece and the glass, from both sides;
//   3. checks no reachable spot is inside a wall or a piece of furniture.
// Usage: node tools/walk-test.mjs   (exit code 1 on failure)
import { loadHouse, STATES, inRect, wallFrame } from "./lib.mjs";
import { houseBoxes } from "../src/house/layout.js";
import { furnitureBoxes } from "../src/furniture/layout.js";
import { buildColliders, move } from "../src/player/collision.js";

const house = loadHouse();
const floor = house.floors[0];
const { radius, stepHeight, headHeight, spawn } = house.player;
const failures = [];
const fail = (m) => failures.push(m);

const structure = houseBoxes(floor);
const wallRects = buildColliders(structure, { stepHeight, headHeight });

for (const state of STATES) {
  const rects = buildColliders([...structure, ...furnitureBoxes(floor, state)], { stepHeight, headHeight });

  // 1. Flood fill on a 5 cm grid using real moves.
  const G = 0.05;
  const key = (i, j) => `${i},${j}`;
  const start = move({ x: spawn.x, y: spawn.y }, 0, 0, radius, rects);
  if (Math.hypot(start.x - spawn.x, start.y - spawn.y) > 1e-6) fail(`${state}: spawn point is inside something`);
  const i0 = Math.round(spawn.x / G), j0 = Math.round(spawn.y / G);
  const seen = new Set([key(i0, j0)]), queue = [[i0, j0]], cells = [];
  while (queue.length) {
    const [i, j] = queue.pop();
    const p = { x: i * G, y: j * G };
    cells.push(p);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      const q = move({ ...p }, di * G, dj * G, radius, rects);
      if (Math.hypot(q.x - (i + di) * G, q.y - (j + dj) * G) < 1e-4) { seen.add(k); queue.push([i + di, j + dj]); }
    }
  }
  const perRoom = Object.fromEntries(floor.rooms.map((r) => [r.id, 0]));
  for (const c of cells) {
    const r = floor.rooms.find((r) => inRect(c.x, c.y, r));
    if (r) perRoom[r.id]++;
    if (!r) {
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
    // 3. Nothing reachable inside a collider.
    for (const r of rects) {
      const cx = Math.min(Math.max(c.x, r.x0), r.x1), cy = Math.min(Math.max(c.y, r.y0), r.y1);
      if (Math.hypot(c.x - cx, c.y - cy) < radius - 1e-3) { fail(`${state}: spot (${c.x.toFixed(2)}, ${c.y.toFixed(2)}) overlaps ${r.id}`); break; }
    }
  }
  const summary = Object.entries(perRoom).map(([id, n]) => `${id} ${(n * G * G).toFixed(1)}m²`).join(", ");
  console.log(`state ${state}: reachable floor ${summary}`);
  for (const [id, n] of Object.entries(perRoom)) {
    const room = floor.rooms.find((r) => r.id === id);
    if (room.walkIn === false) {
      // A look-in cupboard: you must be able to stand within half a metre of its door.
      const door = floor.doors.find((d) => d.connects.includes(id));
      const w = floor.walls.find((w) => w.id === door.wall), f = wallFrame(w);
      const mid = [w.a[0] + f.ux * (door.offsetAlongWall + door.width / 2), w.a[1] + f.uy * (door.offsetAlongWall + door.width / 2)];
      if (!cells.some((c) => Math.hypot(c.x - mid[0], c.y - mid[1]) < 0.5)) fail(`${state}: cannot reach the door of ${id}`);
    } else if (n === 0) fail(`${state}: cannot walk into ${id}`);
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
