// Furniture as low-poly models (furniture/models.js) for one story state, each
// filling its footprint from house.json. Items you can interact with keep their
// own meshes (tagged with userData.interactId); everything else is batched into
// one mesh per material to keep draw calls low. Collision still uses the plain
// footprint boxes from furniture/layout.js.
import * as THREE from "three";
import { placement } from "../data/geometry.js";
import { planToThree } from "../scene/boxes.js";
import { createBatch } from "../art/batch.js";
import { MODELS } from "./models.js";

// The kit: parts placed in an item's local frame (x across, y up, z depth, front at -z).
function makeKit(batch, base) {
  const place = (c, rot = [0, 0, 0], scale = [1, 1, 1]) =>
    base.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
  const kit = {
    box(mat, c, size, rot) {
      batch.box(mat, place(c, rot), size);
    },
    span(mat, [x0, x1], [y0, y1], [z0, z1], rot) {
      kit.box(mat, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [Math.max(1e-4, x1 - x0), Math.max(1e-4, y1 - y0), Math.max(1e-4, z1 - z0)], rot);
    },
    cyl(mat, c, rTop, rBottom, h, seg = 16, rot) {
      const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
      batch.add(g, mat, place(c, rot), [2 * Math.PI * Math.max(rTop, rBottom), h]);
      g.dispose();
    },
    sphere(mat, c, r, scale = [1, 1, 1], seg = 14) {
      const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
      batch.add(g, mat, place(c, [0, 0, 0], scale), [2 * Math.PI * r * Math.max(...scale), Math.PI * r * scale[1]]);
      g.dispose();
    },
    geom(g, mat, c, rot, scale, uvScale) {
      batch.add(g, mat, place(c, rot, scale), uvScale);
    },
  };
  return kit;
}

export function buildFurniture(house, state, materials) {
  const floor = house.floors[0];
  const group = new THREE.Group();
  group.name = `furniture:${state}`;
  const shared = createBatch();
  const items = [...floor.furniture, ...(floor.corridorProps ?? [])];

  for (const item of items) {
    const p = placement(item, state);
    if (!p || !p.x || !p.y || !p.z || p.light) continue; // lamps are drawn by lighting/fixtures.js
    const rot = ((((p.rotationDeg ?? 0) % 360) + 360) % 360);
    const quarter = rot === 90 || rot === 270;
    const W = quarter ? p.y[1] - p.y[0] : p.x[1] - p.x[0];
    const D = quarter ? p.x[1] - p.x[0] : p.y[1] - p.y[0];
    const H = p.z[1] - p.z[0];
    const base = new THREE.Matrix4().compose(
      planToThree((p.x[0] + p.x[1]) / 2, (p.y[0] + p.y[1]) / 2, p.z[0]),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rot * Math.PI) / 180),
      new THREE.Vector3(1, 1, 1),
    );
    const inverse = base.clone().invert();
    const planToLocal = (px, py, pz = p.z[0]) => planToThree(px, py, pz).applyMatrix4(inverse);
    const own = p.interact ? createBatch() : null;
    const k = makeKit(own ?? shared, base);
    (MODELS[p.type] ?? MODELS.default)({ k, W, H, D, item: p, M: materials, planToLocal, state, house });
    if (own) {
      const g = new THREE.Group();
      g.name = p.id;
      own.build(g, { interactId: p.id, name: p.id });
      group.add(g);
    }
  }
  shared.build(group, { name: "furniture" });
  return { group };
}
