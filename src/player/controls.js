// First-person controls: click to capture the mouse, mouse to look, W/A/S/D
// (or arrow keys) to walk, Shift to walk faster. Position is kept in plan
// coordinates (x, y) and copied to the camera every frame.
import { move, resolve } from "./collision.js";
import { planToThree } from "../scene/boxes.js";

const LOOK_SENSITIVITY = 0.0022; // radians per mouse pixel
const MAX_PITCH = (85 * Math.PI) / 180;

export function createPlayer({ camera, dom, settings, colliders }) {
  const state = {
    pos: { x: settings.spawn.x, y: settings.spawn.y },
    yaw: ((settings.spawn.facingDeg ?? 0) * Math.PI) / 180, // 0 = facing +y (the windows); CCW from above
    pitch: 0,
    keys: new Set(),
    locked: false,
    colliders,
  };
  let onLockChange = null;
  resolve(state.pos, settings.radius, state.colliders);
  camera.rotation.order = "YXZ";

  dom.addEventListener("click", () => {
    if (!state.locked) dom.requestPointerLock?.();
  });
  document.addEventListener("pointerlockchange", () => {
    state.locked = document.pointerLockElement === dom;
    if (!state.locked) state.keys.clear();
    onLockChange?.(state.locked);
  });
  document.addEventListener("mousemove", (e) => {
    if (!state.locked) return;
    state.yaw -= e.movementX * LOOK_SENSITIVITY;
    state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch - e.movementY * LOOK_SENSITIVITY));
  });
  document.addEventListener("keydown", (e) => {
    if (state.locked) state.keys.add(e.code);
  });
  document.addEventListener("keyup", (e) => state.keys.delete(e.code));
  window.addEventListener("blur", () => state.keys.clear());

  function update(dt) {
    const k = state.keys;
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const s = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    if (f || s) {
      const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? settings.runSpeed : settings.walkSpeed;
      const len = Math.hypot(f, s);
      // Forward in plan space is (-sin yaw, cos yaw); right is (cos yaw, sin yaw).
      const fx = -Math.sin(state.yaw), fy = Math.cos(state.yaw);
      const rx = Math.cos(state.yaw), ry = Math.sin(state.yaw);
      const step = (speed * Math.min(dt, 0.1)) / len;
      move(state.pos, (fx * f + rx * s) * step, (fy * f + ry * s) * step, settings.radius, state.colliders);
    }
    camera.position.copy(planToThree(state.pos.x, state.pos.y, settings.eyeHeight));
    camera.rotation.set(state.pitch, state.yaw, 0);
  }

  return {
    state,
    update,
    onLockChange: (fn) => (onLockChange = fn),
    setColliders: (c) => {
      state.colliders = c;
      resolve(state.pos, settings.radius, c);
    },
    // Test and debug hooks
    teleport(x, y, facingDeg = null) {
      state.pos.x = x;
      state.pos.y = y;
      if (facingDeg !== null) {
        state.yaw = (facingDeg * Math.PI) / 180;
        state.pitch = 0;
      }
      resolve(state.pos, settings.radius, state.colliders);
    },
    walk(forward, right, seconds, fast = false) {
      const fx = -Math.sin(state.yaw), fy = Math.cos(state.yaw), rx = Math.cos(state.yaw), ry = Math.sin(state.yaw);
      const speed = fast ? settings.runSpeed : settings.walkSpeed;
      const dt = 1 / 60;
      for (let t = 0; t < seconds; t += dt) {
        const len = Math.hypot(forward, right) || 1;
        move(state.pos, ((fx * forward + rx * right) * speed * dt) / len, ((fy * forward + ry * right) * speed * dt) / len, settings.radius, state.colliders);
      }
    },
  };
}
