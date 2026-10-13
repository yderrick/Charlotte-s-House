// Pure door geometry: where each leaf of a door is for a given opening angle.
// Used by the Three.js door builder (to place leaves) and by collision and
// the walk test (to block the doorway). No Three.js here.
import { hingedDoorGeom, roomsById } from "../data/geometry.js";

const DEG = Math.PI / 180;
const rotPlus90 = ([x, y]) => [-y, x];
const rotMinus90 = ([x, y]) => [y, -x];

// Static description of a door's hinge, directions and leaf sizes.
export function doorFrame(floor, door, motion) {
  const wall = floor.walls.find((w) => w.id === door.wall);
  const rooms = roomsById(floor);
  const g = hingedDoorGeom(wall, door, rooms);
  const along = [(g.free[0] - g.hinge[0]) / door.width, (g.free[1] - g.hinge[1]) / door.width];
  const n = g.n; // unit vector into the room the door swings (or folds) into
  const s = Math.sign(along[0] * n[1] - along[1] * n[0]) || 1; // +1 if n is 90° counter-clockwise of along
  const clearance = motion.leafClearance ?? 0.003;
  const undercut = door.undercut ?? motion.defaultUndercut ?? 0.01;
  const base = { id: door.id, type: door.type, along, n, s, height: door.height, z: [undercut, door.height - 0.005], leafThickness: door.leafThickness ?? 0.04 };
  if (door.type === "bifold") {
    return { ...base, pivot: g.hinge, leafLength: (door.width - 2 * clearance) / 2, maxAngle: (door.maxOpenDeg ?? motion.bifoldMaxOpenDeg ?? 80) * DEG, leaves: 2 };
  }
  // Hinged: the leaf hangs on the face of the wall on the swing side.
  const pivot = [g.hingeFace[0] + along[0] * clearance, g.hingeFace[1] + along[1] * clearance];
  return { ...base, pivot, leafLength: door.width - 2 * clearance, maxAngle: (door.maxOpenDeg ?? 90) * DEG, leaves: 1 };
}

// Leaf placements for an angle (radians, 0 = closed). Each leaf is a centre-line
// segment start -> start + dir * length, with its thickness either side.
export function leafPlacements(frame, angle) {
  const { along, n, pivot, leafLength: L, leafThickness: t } = frame;
  const c = Math.cos(angle), sn = Math.sin(angle);
  if (frame.type === "bifold") {
    // Leaf 1 swings out from the jamb; leaf 2 folds back so its far end runs along the track.
    const d1 = [along[0] * c + n[0] * sn, along[1] * c + n[1] * sn];
    const d2 = [along[0] * c - n[0] * sn, along[1] * c - n[1] * sn];
    const p1 = [pivot[0] + d1[0] * L, pivot[1] + d1[1] * L];
    return [
      { start: pivot, dir: d1, length: L, thickness: t },
      { start: p1, dir: d2, length: L, thickness: t },
    ];
  }
  // Hinged: the leaf body sits on the side away from the swing room when closed,
  // and that side turns with the leaf.
  const dir = [along[0] * c + n[0] * sn, along[1] * c + n[1] * sn];
  const perp = frame.s > 0 ? rotMinus90(dir) : rotPlus90(dir);
  const start = [pivot[0] + perp[0] * (t / 2), pivot[1] + perp[1] * (t / 2)];
  return [{ start, dir, length: L, thickness: t }];
}

// Collision segments for the leaves at an angle.
export function leafSegments(frame, angle) {
  return leafPlacements(frame, angle).map((p, i) => ({
    kind: "seg",
    id: `${frame.id}:leaf${i}`,
    ax: p.start[0],
    ay: p.start[1],
    bx: p.start[0] + p.dir[0] * p.length,
    by: p.start[1] + p.dir[1] * p.length,
    half: p.thickness / 2,
  }));
}

// Distance from a point to a segment collider.
export function distanceToSegment(px, py, seg) {
  const vx = seg.bx - seg.ax, vy = seg.by - seg.ay;
  const len2 = vx * vx + vy * vy || 1e-12;
  const t = Math.max(0, Math.min(1, ((px - seg.ax) * vx + (py - seg.ay) * vy) / len2));
  return Math.hypot(px - (seg.ax + vx * t), py - (seg.ay + vy * t));
}

// Hinged and bifold doors with a leaf (decor doors and plain openings have none).
export function hasLeaf(door) {
  return door.type === "hinged" || door.type === "bifold";
}

export function startAngle(frame, door) {
  if (!door.startsOpen) return 0;
  const a = door.startAngleDeg != null ? door.startAngleDeg * DEG : frame.maxAngle;
  return Math.min(a, frame.maxAngle);
}
