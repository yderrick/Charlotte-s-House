// Furniture as plain grey boxes for one story state.
import * as THREE from "three";
import { furnitureBoxes } from "./layout.js";
import { boxMesh, addOutline } from "../scene/boxes.js";

const SOLID = new THREE.MeshLambertMaterial({ color: 0xa6a6a6 });
const PROP = new THREE.MeshLambertMaterial({ color: 0x6e6e6e });
const EDGE = new THREE.LineBasicMaterial({ color: 0x3a3a3a });

export function buildFurniture(house, state) {
  const group = new THREE.Group();
  group.name = `furniture:${state}`;
  const boxes = furnitureBoxes(house.floors[0], state);
  for (const b of boxes) {
    const mesh = addOutline(boxMesh(b, b.solid ? SOLID : PROP), EDGE);
    if (b.interactive) mesh.userData.interactId = b.item; // picked up by the interaction system once its type has a handler
    group.add(mesh);
  }
  return { group, boxes };
}
