// Plan-space boxes to Three.js meshes. Plan (x, y, z-up) maps to
// Three.js (x, y-up, -z): three.x = x, three.y = z, three.z = -y.
import * as THREE from "three";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitEdges = new THREE.EdgesGeometry(unitBox);

export function planToThree(x, y, z = 0) {
  return new THREE.Vector3(x, z, -y);
}

// Thin outline drawn as a child so it follows the box's scale.
export function addOutline(mesh, material) {
  const lines = new THREE.LineSegments(unitEdges, material);
  lines.raycast = () => {};
  mesh.add(lines);
  return mesh;
}

export function boxMesh(box, material) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.scale.set(box.x[1] - box.x[0], box.z[1] - box.z[0], box.y[1] - box.y[0]);
  mesh.position.copy(planToThree((box.x[0] + box.x[1]) / 2, (box.y[0] + box.y[1]) / 2, (box.z[0] + box.z[1]) / 2));
  mesh.name = box.id;
  mesh.userData.box = box;
  return mesh;
}
