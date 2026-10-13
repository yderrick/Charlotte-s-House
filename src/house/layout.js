// Turns house.json's floors, walls, doors and windows into plain boxes in plan
// space: { id, role, x: [min, max], y: [min, max], z: [min, max], collide }.
// Pure data: the Three.js builder and the Node walk test both use it.
import { solidPieces, pieceRect, wallFrame } from "../data/geometry.js";

const SLAB = 0.02; // visual thickness of floor and ceiling slabs

export function houseBoxes(floor) {
  const boxes = [];
  const add = (b) => boxes.push(b);

  for (const r of floor.rooms) {
    add({ id: `floor:${r.id}`, role: "floor", room: r.id, x: r.x, y: r.y, z: [-SLAB, 0], collide: false });
    const h = r.ceilingHeight ?? floor.defaultCeilingHeight;
    add({ id: `ceiling:${r.id}`, role: "ceiling", room: r.id, x: r.x, y: r.y, z: [h, h + SLAB], collide: false });
  }

  for (const w of floor.walls) {
    const height = w.height ?? floor.defaultCeilingHeight;
    const openings = floor.doors.filter((d) => d.wall === w.id && d.type !== "dummy");
    const windows = floor.windows.filter((win) => win.wall === w.id);

    if (w.kind === "glazing") {
      addGlazing(add, w, windows, height);
      continue;
    }

    // Solid wall between the openings
    for (const p of solidPieces(w, openings, windows)) {
      add({ id: `wall:${w.id}:${p.from.toFixed(2)}`, role: "wall", wall: w.id, ...pieceRect(w, p), z: [0, height], collide: true });
    }
    // Header above each door, sill and header around each window
    for (const o of openings) {
      const r = pieceRect(w, { from: o.offsetAlongWall, to: o.offsetAlongWall + o.width });
      if (o.height < height) add({ id: `header:${o.id}`, role: "wall", wall: w.id, ...r, z: [o.height, height], collide: true });
      // Walls whose two sides are not both rooms (exterior, corridor) leave a gap in the floor under the opening
      if (w.kind !== "partition") add({ id: `threshold:${o.id}`, role: "floor", x: r.x, y: r.y, z: [-SLAB, 0], collide: false });
    }
    for (const win of windows) {
      const r = pieceRect(w, { from: win.offsetAlongWall, to: win.offsetAlongWall + win.width });
      const top = win.sillHeight + win.height;
      if (win.sillHeight > 0) add({ id: `sill:${win.id}`, role: "wall", wall: w.id, ...r, z: [0, win.sillHeight], collide: true });
      if (top < height) add({ id: `header:${win.id}`, role: "wall", wall: w.id, ...r, z: [top, height], collide: true });
      add({ id: `glass:${win.id}`, role: "glass", ...thinRect(w, win), z: [win.sillHeight, top], collide: true });
    }
  }

  // Decorative doors that do not open: a panel proud of the wall on both faces
  for (const d of floor.doors.filter((d) => d.type === "dummy")) {
    const w = floor.walls.find((w) => w.id === d.wall);
    const r = pieceRect({ ...w, thickness: w.thickness + 0.02 }, { from: d.offsetAlongWall, to: d.offsetAlongWall + d.width });
    add({ id: `dummy:${d.id}`, role: "dummyDoor", ...r, z: [0, d.height], collide: false });
  }

  return boxes;
}

// A wall made entirely of glass panels: mullions at each panel edge, top and
// bottom rails, and a pane in each panel. One invisible box the full depth of
// the wall blocks walking, so the body cannot press into the frame.
function addGlazing(add, w, windows, height) {
  add({ id: `collider:${w.id}`, role: "collider", wall: w.id, ...pieceRect(w, { from: -(w.extendStart ?? 0), to: wallFrame(w).len + (w.extendEnd ?? 0) }), z: [0, height], collide: true });
  const edges = [...new Set(windows.flatMap((win) => [win.offsetAlongWall, win.offsetAlongWall + win.width].map((v) => +v.toFixed(4))))];
  for (const win of windows) {
    const fw = win.frameWidth ?? 0.05;
    const top = win.sillHeight + win.height;
    const span = pieceRect(w, { from: win.offsetAlongWall, to: win.offsetAlongWall + win.width });
    add({ id: `rail-bottom:${win.id}`, role: "frame", ...span, z: [win.sillHeight, win.sillHeight + fw], collide: false });
    add({ id: `rail-top:${win.id}`, role: "frame", ...span, z: [top - fw, top], collide: false });
    add({ id: `glass:${win.id}`, role: "glass", ...thinRect(w, win, fw), z: [win.sillHeight + fw, top - fw], collide: false });
  }
  const fw = windows[0]?.frameWidth ?? 0.05;
  for (const e of edges) {
    const from = Math.max(e - fw / 2, -(w.extendStart ?? 0)), to = e + fw / 2;
    add({ id: `mullion:${w.id}:${e}`, role: "frame", ...pieceRect(w, { from, to }), z: [0, height], collide: false });
  }
}

// A pane 1 cm thick on the wall's centreline, inset by the frame at each side.
function thinRect(w, win, inset = 0) {
  return pieceRect({ ...w, thickness: 0.01 }, { from: win.offsetAlongWall + inset / 2, to: win.offsetAlongWall + win.width - inset / 2 });
}
