// Look-at interaction: a ray from the centre of the view finds the nearest
// thing within reach. If it belongs to an interactive object with a handler,
// the HUD shows its prompt and the interaction key runs its action.
//
// To make something new interactive later (cupboards, switches, the kettle):
//   1. give it `interact: { type, action }` in house.json (types live in house.interaction.types),
//   2. tag its meshes with userData.interactId = <object id>,
//   3. add a handler for the type: handlers[type] = (obj) => ({ condition(), run() }).
import * as THREE from "three";
import { collectInteractives, promptFor } from "./registry.js";

export function createInteraction({ house, camera, roots, handlers, hud, isActive }) {
  const cfg = house.interaction ?? {};
  const raycaster = new THREE.Raycaster();
  raycaster.far = cfg.maxDistance ?? 2.0;
  const centre = new THREE.Vector2(0, 0);
  const key = cfg.key ?? "KeyE", keyLabel = cfg.keyLabel ?? "E";

  // id -> { id, interact, condition(), run() } for every object whose type has a handler
  const targets = new Map();
  const waiting = []; // objects whose type has no handler yet (a later stage)
  for (const obj of collectInteractives(house)) {
    const make = handlers[obj.interact.type];
    if (!make) {
      waiting.push(obj);
      continue;
    }
    targets.set(obj.id, { ...obj, ...make(obj) });
  }

  let current = null;

  function findTarget() {
    camera.updateMatrixWorld(); // the player moved the camera this frame; don't aim with last frame's view
    raycaster.setFromCamera(centre, camera);
    const hit = raycaster.intersectObjects(roots, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      const id = o.userData?.interactId;
      if (id) return targets.get(id) ?? null;
    }
    return null; // the nearest thing in view is not interactive (a wall in the way)
  }

  function update() {
    current = findTarget();
    const text = current ? promptFor(house, current.interact, current.condition()) : null;
    hud.setPrompt(text ? `${keyLabel} – ${text}` : "");
  }

  function activate() {
    if (current) current.run();
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === key && !e.repeat && isActive()) activate();
  });

  return { update, activate, targets, waiting, current: () => current };
}
