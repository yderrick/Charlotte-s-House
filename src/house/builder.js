// Builds the shell (floors, ceilings, walls, glass, slabs) from house.json with
// the art materials. Each wall face takes the finish of the room it faces: the
// room's wall material inside the flat, the corridor's finish in the corridor,
// the tower's facade outside. Faces are batched into one mesh per material.
import * as THREE from "three";
import { houseBoxes } from "./layout.js";
import { createBatch } from "../art/batch.js";
import { inRect } from "../data/geometry.js";

export function buildHouse(house, materials) {
  const group = new THREE.Group();
  group.name = "house";
  const floor = house.floors[0];
  const boxes = houseBoxes(floor);
  const M = materials;
  const roomAt = (x, y) => floor.rooms.find((r) => inRect(x, y, r));
  const batch = createBatch();
  const glass = createBatch();

  // Which finish a wall face shows: look just beyond the face, into whatever is there.
  const wallFace = (n, c) => {
    if (n[1] !== 0) return M.paint_white; // tops and bottoms are hidden
    const px = c[0] + n[0] * 0.3, py = -(c[2] + n[2] * 0.3);
    const r = roomAt(px, py);
    if (!r) return M.facade;
    return M[r.walls] ?? M.paint_white;
  };

  for (const b of boxes) {
    const range = [b.x, [b.z[0], b.z[1]], [-b.y[1], -b.y[0]]];
    if (b.role === "floor") {
      const r = b.room ? floor.rooms.find((r) => r.id === b.room) : roomAt((b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2 + 0.3) ?? roomAt((b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2 - 0.3);
      const m = M[r?.floor] ?? M.vinyl_grey_wood;
      batch.worldBox((n) => (n[1] > 0 ? m : M.concrete), ...range);
    } else if (b.role === "ceiling") {
      const r = floor.rooms.find((r) => r.id === b.room);
      batch.worldBox(() => M[r?.ceiling] ?? M.paint_white, ...range);
    } else if (b.role === "wall") batch.worldBox(wallFace, ...range);
    else if (b.role === "frame") batch.worldBox(() => M.aluminium_black, ...range);
    else if (b.role === "slab") batch.worldBox(() => M.concrete, ...range);
    else if (b.role === "dummyDoor") batch.worldBox((n) => (n[1] ? M.door_charcoal : M.door_charcoal), ...range);
    else if (b.role === "glass") glass.worldBox(() => M.glass, ...range);
  }
  batch.build(group, { name: "shell" });
  glass.build(group, { name: "glass" });
  group.traverse((o) => { if (o.isMesh && o.material === M.glass) o.renderOrder = 1; });
  return { group, boxes };
}
