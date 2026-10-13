// Light from outside: the sun (or the moon at night) as one shadow-casting
// directional light, diffuse daylight coming in through the glass as a row of
// shadow-casting spots just outside the window plus a shadowed bounce light in
// each windowed room, and a faint everywhere-light.
// Walls block both shadowed lights, so rooms without windows stay dark.
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";

// Shadow quality presets (engine constants). ?shadows=low|medium|high
export const SHADOW_QUALITY = {
  low: { key: 1024, fill: 512, bounce: 256 },
  medium: { key: 2048, fill: 1024, bounce: 512 },
  high: { key: 4096, fill: 2048, bounce: 1024 },
};

export function addDaylight(scene, house, quality = "medium") {
  const q = SHADOW_QUALITY[quality] ?? SHADOW_QUALITY.medium;
  const floor = house.floors[0];
  const unit = floor.rooms.filter((r) => r.inUnit);
  const minX = Math.min(...unit.map((r) => r.x[0])), maxX = Math.max(...unit.map((r) => r.x[1]));
  const minY = Math.min(...unit.map((r) => r.y[0])), maxY = Math.max(...unit.map((r) => r.y[1]));
  const centre = planToThree((minX + maxX) / 2, (minY + maxY) / 2, 1.3);
  const halfSpan = Math.hypot(maxX - minX, maxY - minY) / 2 + 2;

  // Key light: follows the sun by day and the moon at night.
  const key = new THREE.DirectionalLight(0xffffff, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(q.key, q.key);
  Object.assign(key.shadow.camera, { left: -halfSpan, right: halfSpan, top: halfSpan, bottom: -halfSpan, near: 0.5, far: 80 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.target.position.copy(centre);
  scene.add(key, key.target);

  // Sky fill: diffuse daylight entering through the glazed wall, as a row of
  // spots outside the glass (each casts its own faint frame shadows, so they blur).
  const sf = house.timeOfDay.skyFill;
  const fills = [];
  for (const glazing of floor.walls.filter((w) => w.kind === "glazing")) {
    const n = sf.source.count ?? 1;
    const cy = (glazing.a[1] + glazing.b[1]) / 2, cx = (glazing.a[0] + glazing.b[0]) / 2;
    const vertical = Math.abs(glazing.b[0] - glazing.a[0]) < Math.abs(glazing.b[1] - glazing.a[1]);
    const out = vertical ? Math.sign(cx - (minX + maxX) / 2) || 1 : Math.sign(cy - (minY + maxY) / 2) || 1;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const ax = glazing.a[0] + (glazing.b[0] - glazing.a[0]) * t, ay = glazing.a[1] + (glazing.b[1] - glazing.a[1]) * t;
      const [ox, oy] = vertical ? [out, 0] : [0, out];
      const spot = new THREE.SpotLight(0xffffff, 0, 0, (sf.source.coneDeg / 2) * (Math.PI / 180), 0.9, sf.source.decay ?? 2);
      spot.position.copy(planToThree(ax + ox * sf.source.behindGlass, ay + oy * sf.source.behindGlass, sf.source.height));
      spot.target.position.copy(planToThree(ax - ox * sf.source.aimAt.intoRoom, ay - oy * sf.source.aimAt.intoRoom, sf.source.aimAt.height));
      spot.castShadow = true;
      spot.shadow.mapSize.set(q.fill, q.fill);
      spot.shadow.camera.near = 0.3;
      spot.shadow.camera.far = 30;
      spot.shadow.bias = -0.0008;
      spot.shadow.normalBias = 0.05;
      spot.shadow.radius = 2;
      scene.add(spot, spot.target);
      fills.push(spot);
    }
  }

  // Bounce: light off the sunlit floor and walls, from the middle of each room with windows.
  const glazedWalls = floor.walls.filter((w) => w.kind === "glazing").map((w) => w.id);
  const windowRooms = floor.rooms.filter((r) => floor.windows.some((win) => glazedWalls.includes(win.wall)) && floor.walls.some((w) => glazedWalls.includes(w.id) && (w.between ?? []).some((side) => side.split("|").includes(r.id))));
  const bounces = windowRooms.map((r) => {
    const light = new THREE.PointLight(0xffffff, 0, 0, 1.2);
    light.position.copy(planToThree((r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2, sf.bounce.height));
    light.castShadow = true;
    light.shadow.mapSize.set(q.bounce, q.bounce);
    light.shadow.camera.near = 0.2;
    light.shadow.camera.far = 25;
    light.shadow.bias = -0.002;
    light.shadow.normalBias = 0.05;
    scene.add(light);
    return light;
  });

  const ambient = new THREE.AmbientLight(0xffffff, 0);
  scene.add(ambient);

  // Each shadow re-renders only when it has to: the key light's when the sun or moon
  // moves, the fixed lights' (fill, bounce) only when something that casts shadows moves.
  const fixed = [...fills, ...bounces];
  for (const l of [key, ...fixed]) {
    l.shadow.autoUpdate = false;
    l.shadow.needsUpdate = true;
  }
  let lastDir = new THREE.Vector3();
  const setCast = (light, on) => {
    if (light.castShadow !== on) light.shadow.needsUpdate = true;
    light.castShadow = on;
  };

  // castersMoved: a door or curtain is moving, so every shadow is stale.
  function update(env, renderer, castersMoved = false) {
    key.color.set(env.key.colour);
    key.intensity = env.key.intensity;
    const dir = planToThree(...env.key.dir).normalize();
    key.position.copy(centre).addScaledVector(dir, 40);
    setCast(key, env.key.intensity > 0.002);
    for (const f of fills) {
      f.color.set(env.fill.colour);
      f.intensity = env.fill.intensity / fills.length;
      setCast(f, env.fill.intensity > 0.01);
    }
    for (const b of bounces) {
      b.color.set(env.fill.colour);
      b.intensity = env.fill.intensity * sf.bounce.fractionOfFill;
      setCast(b, b.intensity > 0.005);
    }
    ambient.color.set(env.ambient.colour);
    ambient.intensity = env.ambient.intensity;
    renderer.toneMappingExposure = env.exposure;
    if (dir.angleTo(lastDir) > 0.0008) { // about 0.05 degrees
      lastDir.copy(dir);
      key.shadow.needsUpdate = true;
    }
    if (castersMoved) for (const l of [key, ...fixed]) l.shadow.needsUpdate = true;
  }

  return { key, fills, bounces, ambient, update };
}

// Every mesh casts and receives shadows, except see-through and sky things.
export function enableShadows(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const glass = o.material?.transparent && o.material.opacity < 0.5;
    o.castShadow = !glass;
    o.receiveShadow = !glass;
  });
}
