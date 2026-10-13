// Builds the grey-box shell (floors, ceilings, walls, glass) from house.json.
import * as THREE from "three";
import { houseBoxes } from "./layout.js";
import { boxMesh, planToThree } from "../scene/boxes.js";

// Stage 1 grey-box palette: greys only.
const MATERIALS = {
  floor: new THREE.MeshLambertMaterial({ color: 0x8c8c8c }),
  ceiling: new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
  wall: new THREE.MeshLambertMaterial({ color: 0xdcdcdc }),
  frame: new THREE.MeshLambertMaterial({ color: 0x505050 }),
  dummyDoor: new THREE.MeshLambertMaterial({ color: 0xa8a8a8 }),
  glass: new THREE.MeshLambertMaterial({ color: 0xe8ecee, transparent: true, opacity: 0.18, depthWrite: false }),
};

export function buildHouse(house) {
  const group = new THREE.Group();
  group.name = "house";
  const floor = house.floors[0];
  const boxes = houseBoxes(floor);
  for (const b of boxes) {
    const mat = MATERIALS[b.role];
    if (!mat) continue; // invisible colliders
    const mesh = boxMesh(b, mat);
    if (b.role === "glass") mesh.renderOrder = 1;
    group.add(mesh);
  }

  // Ground far below the window so the view is not empty (outdoors comes in stage 5).
  const groundZ = house.outdoors?.groundZ ?? -60;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(planToThree(3.25, 10, groundZ));
  ground.name = "ground";
  group.add(ground);

  return { group, boxes };
}
