// Pure plan-space helpers shared by the browser build and the Node tools.
// No Three.js and no Node APIs in here.

export const STATES = ["A", "B", "C", "D", "E", "F"];

// Wall direction, length and normal (left-hand normal of a -> b).
export function wallFrame(w) {
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  return { len, ux, uy, nx: -uy, ny: ux };
}

export function pointOnWall(w, offset) {
  const f = wallFrame(w);
  return [w.a[0] + f.ux * offset, w.a[1] + f.uy * offset];
}

// Solid pieces of a wall along its length after cutting out its openings.
// Returns [{from, to}] in wall-offset units, including the end extensions.
export function solidPieces(w, doors, windows = []) {
  if (w.kind === "glazing") return [];
  const f = wallFrame(w);
  const start = -(w.extendStart ?? 0), end = f.len + (w.extendEnd ?? 0);
  const cuts = [...doors, ...windows]
    .filter((o) => o.wall === w.id)
    .map((o) => [o.offsetAlongWall, o.offsetAlongWall + o.width])
    .sort((p, q) => p[0] - q[0]);
  const pieces = [];
  let cur = start;
  for (const [c0, c1] of cuts) {
    if (c0 > cur) pieces.push({ from: cur, to: c0 });
    cur = Math.max(cur, c1);
  }
  if (end > cur) pieces.push({ from: cur, to: end });
  return pieces;
}

// Rectangle (axis aligned) for a wall piece, as {x:[..], y:[..]}.
export function pieceRect(w, p) {
  const f = wallFrame(w), h = w.thickness / 2;
  const p0 = [w.a[0] + f.ux * p.from, w.a[1] + f.uy * p.from];
  const p1 = [w.a[0] + f.ux * p.to, w.a[1] + f.uy * p.to];
  const xs = [p0[0] + f.nx * h, p0[0] - f.nx * h, p1[0] + f.nx * h, p1[0] - f.nx * h];
  const ys = [p0[1] + f.ny * h, p0[1] - f.ny * h, p1[1] + f.ny * h, p1[1] - f.ny * h];
  return { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] };
}

// Furniture placement for a given state, or null if absent in that state.
export function placement(item, state) {
  if (item.states && !item.states.includes(state)) return null;
  if (item.byState) {
    const s = item.byState[state];
    if (!s) return null;
    return { ...item, ...s, byState: undefined };
  }
  return item;
}

export function inRect(px, py, r, tol = 0) {
  return px >= r.x[0] - tol && px <= r.x[1] + tol && py >= r.y[0] - tol && py <= r.y[1] + tol;
}

export function overlap1(a, b, tol = 0) {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > tol;
}

// The room (and zone, if the room has zones) containing a plan point, or null
// when the point is inside a wall or outside the floor.
export function roomAt(floor, x, y) {
  for (const r of floor.rooms) {
    if (!inRect(x, y, r)) continue;
    const zone = (r.zones ?? []).find((z) => z.id !== "window_corner" && inRect(x, y, z));
    return { room: r, zone: zone ?? null };
  }
  return null;
}

// Compass bearing (degrees from true north) of a plan direction.
export function bearingOf(dx, dy, facing) {
  return (((facing + (Math.atan2(dx, dy) * 180) / Math.PI) % 360) + 360) % 360;
}

export function roomsById(floor) {
  return Object.fromEntries(floor.rooms.map((r) => [r.id, r]));
}

// Hinged door: hinge point on the wall centreline and the free end of the closed leaf,
// plus the unit vector pointing into the room it swings into.
export function hingedDoorGeom(w, d, rooms) {
  const f = wallFrame(w);
  const s = d.offsetAlongWall, e = d.offsetAlongWall + d.width;
  const hingeOff = d.hinge === "end" ? e : s;
  const freeOff = d.hinge === "end" ? s : e;
  const hinge = pointOnWall(w, hingeOff), free = pointOnWall(w, freeOff);
  const mid = pointOnWall(w, (s + e) / 2);
  const into = d.swingsInto ?? d.foldsInto;
  const probe = w.thickness / 2 + 0.05;
  const r = rooms[into];
  const sign = r && inRect(mid[0] + f.nx * probe, mid[1] + f.ny * probe, r) ? 1 : -1;
  // Offset the hinge to the face of the wall on the swing side.
  const face = w.thickness / 2;
  const hingeFace = [hinge[0] + sign * f.nx * face, hinge[1] + sign * f.ny * face];
  const freeFace = [free[0] + sign * f.nx * face, free[1] + sign * f.ny * face];
  return { hinge, free, mid, hingeFace, freeFace, n: [sign * f.nx, sign * f.ny], frame: f };
}

export { sunPosition } from "../time/astro.js";

// Plan direction (dx, dy) for a compass bearing, given the house's facing bearing (+y).
export function planDirFromBearing(bearing, facing) {
  const t = ((bearing - facing) * Math.PI) / 180;
  return [Math.sin(t), Math.cos(t)];
}
