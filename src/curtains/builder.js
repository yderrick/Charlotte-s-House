// Curtains as pleated grey fabric hanging from the ceiling track. The pleat
// count is fixed, so drawing a half open squeezes its folds into a stack.
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";

const FABRIC = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, side: THREE.DoubleSide });
const FOLD_DEPTH = { closed: 0.025, open: 0.06 }; // fold amplitude in metres

function pleatedGeometry(folds, height) {
  const geo = new THREE.PlaneGeometry(1, height, Math.max(8, folds * 6), 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5; // 0..1 across the half
    pos.setZ(i, Math.sin(u * folds * Math.PI * 2));
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildCurtainMeshes(curtains) {
  const group = new THREE.Group();
  group.name = "curtains";
  const { track, bottom, pleatSpacing = 0.12 } = curtains.def;
  const height = track.z - bottom;
  const meshes = curtains.halves.map((h) => {
    const mesh = new THREE.Mesh(pleatedGeometry(Math.round(h.closedWidth / pleatSpacing), height), FABRIC);
    mesh.name = h.id;
    mesh.userData.interactId = curtains.def.id;
    group.add(mesh);
    return mesh;
  });

  function update() {
    curtains.halves.forEach((h, i) => {
      const [x0, x1] = curtains.extent(h);
      const m = meshes[i];
      m.position.copy(planToThree((x0 + x1) / 2, track.y, bottom + height / 2));
      m.scale.set(x1 - x0, 1, FOLD_DEPTH.closed + (FOLD_DEPTH.open - FOLD_DEPTH.closed) * h.openness);
    });
  }
  update();
  return { group, update };
}
