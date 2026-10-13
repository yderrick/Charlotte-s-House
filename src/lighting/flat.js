// Stage 1 lighting: flat and even so everything is visible. A soft sky/ground
// fill plus one weak directional light so walls facing different ways get
// slightly different shades. Real fixtures arrive in stage 4.
import * as THREE from "three";

export function addFlatLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc4c4c4, 2.0);
  const fill = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 5, 2); // from the right, above, toward the viewer: shades the four wall directions differently
  scene.add(hemi, fill, key);
  return { hemi, fill, key };
}
