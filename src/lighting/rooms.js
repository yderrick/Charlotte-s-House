// Which room a point is in, the doorways ("portals") between rooms, and how much
// of an indoor light reaches a point: all of it in the light's own room, the share
// that passes straight through an open doorway in a neighbouring room, none
// elsewhere. Pure: the GLSL in roomMask.js does the same sum per pixel.
import { wallFrame, inRect } from "../data/geometry.js";

export const MAX_ROOMS = 12;
export const MAX_PORTALS = 12;

export function buildRoomGraph(floor) {
  const rooms = floor.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y }));
  if (rooms.length > MAX_ROOMS) throw new Error(`more than ${MAX_ROOMS} rooms`);
  const index = Object.fromEntries(rooms.map((r, i) => [r.id, i]));
  const portals = floor.doors
    .filter((d) => d.type !== "dummy" && d.connects.every((id) => id in index))
    .map((d) => {
      const w = floor.walls.find((w) => w.id === d.wall), f = wallFrame(w);
      const alongX = Math.abs(f.ux) > Math.abs(f.uy); // wall runs along x: the doorway plane is y = const
      const s = d.offsetAlongWall, e = d.offsetAlongWall + d.width;
      const p0 = [w.a[0] + f.ux * s, w.a[1] + f.uy * s], p1 = [w.a[0] + f.ux * e, w.a[1] + f.uy * e];
      return {
        doorId: d.id,
        planeIsY: alongX,
        c: alongX ? w.a[1] : w.a[0],
        lo: alongX ? Math.min(p0[0], p1[0]) : Math.min(p0[1], p1[1]),
        hi: alongX ? Math.max(p0[0], p1[0]) : Math.max(p0[1], p1[1]),
        top: d.height,
        a: index[d.connects[0]],
        b: index[d.connects[1]],
        always: d.type === "opening",
      };
    });
  if (portals.length > MAX_PORTALS) throw new Error(`more than ${MAX_PORTALS} doorways`);
  return { rooms, index, portals };
}

export function roomIndexAt(graph, x, y) {
  return graph.rooms.findIndex((r) => inRect(x, y, r));
}

// Share (0..1) of a light at `light` [x, y, z] that reaches a surface at `p` [x, y, z]
// in room `pRoom`. openness(doorId) is 0 (shut) .. 1 (fully open).
export function lightReach(graph, light, p, pRoom, openness) {
  const lr = roomIndexAt(graph, light[0], light[1]);
  if (lr < 0 || lr === pRoom) return 1;
  if (pRoom < 0) return 0;
  let best = 0;
  for (const q of graph.portals) {
    if (!((q.a === lr && q.b === pRoom) || (q.b === lr && q.a === pRoom))) continue;
    const ax = q.planeIsY ? 1 : 0;
    const den = light[ax] - p[ax];
    if (Math.abs(den) < 1e-5) continue;
    const t = (q.c - p[ax]) / den;
    if (t <= 0 || t >= 1) continue;
    const along = p[1 - ax] + (light[1 - ax] - p[1 - ax]) * t, z = p[2] + (light[2] - p[2]) * t;
    if (along >= q.lo && along <= q.hi && z >= 0 && z <= q.top) best = Math.max(best, q.always ? 1 : openness(q.doorId));
  }
  return best;
}
