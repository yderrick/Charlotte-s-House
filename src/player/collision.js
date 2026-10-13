// 2D collision for a walking player: a circle in plan space against axis-aligned
// rectangles. Only boxes that overlap the body's height band block movement, so
// things under the step height (paper, a 2 cm threshold) or above the head (door
// headers, the top shelf) do not. Pure: no Three.js.

const MAX_STEP = 0.04; // metres per sub-step; well under the thinnest wall (0.1 m)

export function buildColliders(boxes, { stepHeight, headHeight }) {
  return boxes
    .filter((b) => b.collide && b.z[1] > stepHeight && b.z[0] < headHeight)
    .map((b) => ({ id: b.id, x0: b.x[0], x1: b.x[1], y0: b.y[0], y1: b.y[1] }));
}

// Push a point out of every rectangle it is within `radius` of.
export function resolve(pos, radius, rects) {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const r of rects) {
      if (pos.x < r.x0 - radius || pos.x > r.x1 + radius || pos.y < r.y0 - radius || pos.y > r.y1 + radius) continue;
      const cx = Math.min(Math.max(pos.x, r.x0), r.x1);
      const cy = Math.min(Math.max(pos.y, r.y0), r.y1);
      const dx = pos.x - cx, dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2), push = radius - d;
        pos.x += (dx / d) * push;
        pos.y += (dy / d) * push;
      } else {
        // Centre is inside the rectangle: leave by the nearest side.
        const out = [
          [r.x0 - radius - pos.x, 0],
          [r.x1 + radius - pos.x, 0],
          [0, r.y0 - radius - pos.y],
          [0, r.y1 + radius - pos.y],
        ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0];
        pos.x += out[0];
        pos.y += out[1];
      }
      moved = true;
    }
    if (!moved) break;
  }
  return pos;
}

// Move by (dx, dy) in small steps so fast movement cannot tunnel through a wall.
export function move(pos, dx, dy, radius, rects) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP));
  for (let i = 0; i < n; i++) {
    pos.x += dx / n;
    pos.y += dy / n;
    resolve(pos, radius, rects);
  }
  return pos;
}
