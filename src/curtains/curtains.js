// Curtain state: each half has an openness from 0 (drawn across) to 1 (stacked
// at its wall). Pure (no Three.js): gives extents and collision boxes.

export function createCurtainSystem(house, state) {
  const c = house.floors[0].curtains;
  if (!c) return null;
  const startOpen = c.startsOpenByState?.[state] ?? true;
  const halves = c.halves.map((h) => ({
    ...h,
    dirSign: Math.sign(h.closedTo - h.anchoredAt), // which way it draws from its anchor
    closedWidth: Math.abs(h.closedTo - h.anchoredAt),
    openness: startOpen ? 1 : 0,
  }));
  let target = startOpen ? 1 : 0;
  const speed = 1 / (c.drawSeconds ?? 3);
  const depth = 0.06; // how far the folds stand off the track line, for collision

  function width(h) {
    return h.stackWidthOpen + (h.closedWidth - h.stackWidthOpen) * (1 - h.openness);
  }

  // Extent of a half along x, from its anchor toward the middle.
  function extent(h) {
    const w = width(h);
    const a = h.anchoredAt, b = h.anchoredAt + h.dirSign * w;
    return [Math.min(a, b), Math.max(a, b)];
  }

  function toggle() {
    target = target > 0.5 ? 0 : 1;
  }

  function update(dt) {
    for (const h of halves) {
      if (h.openness === target) continue;
      const step = Math.sign(target - h.openness) * speed * dt;
      h.openness = Math.abs(target - h.openness) <= Math.abs(step) ? target : h.openness + step;
    }
  }

  function colliders() {
    return halves.map((h) => {
      const [x0, x1] = extent(h);
      return { id: `curtain:${h.id}`, x0, x1, y0: c.track.y - depth / 2, y1: c.track.y + depth / 2 };
    });
  }

  const condition = () => (target > 0.5 ? "open" : "closed");

  return { def: c, halves, width, extent, toggle, update, colliders, condition, setOpen: (open) => { target = open ? 1 : 0; for (const h of halves) h.openness = target; } };
}
