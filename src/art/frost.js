// Frost growing in from the corners of each pane on cold winter nights
// (timeOfDay.frost in house.json): a thin layer just inside each pane, with a
// feathery corner pattern drawn in code. Fades in after dark in the frost months.
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";

// Feathery frost drawn at real scale for a pane w x h metres: fern-like
// branches growing up from the bottom edge, longest in the corners, plus a
// thin haze along the bottom where the coldest air sits.
const PX_PER_M = 220;
function frostTexture(w, h, reach) {
  const W = Math.round(w * PX_PER_M), H = Math.round(h * PX_PER_M), R = reach * PX_PER_M;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const haze = x.createLinearGradient(0, H, 0, H - R * 0.6);
  haze.addColorStop(0, "rgba(255,255,255,0.55)");
  haze.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = haze;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(255,255,255,0.5)";
  x.lineCap = "round";
  const branch = (px, py, a, len, depth) => {
    const qx = px + Math.cos(a) * len, qy = py + Math.sin(a) * len;
    x.lineWidth = Math.max(0.6, depth * 0.45);
    x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke();
    if (depth <= 0 || len < 3) return;
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + 0.6 * rand(), side = k % 2 ? 1 : -1;
      branch(px + (qx - px) * t, py + (qy - py) * t, a + side * (0.5 + 0.5 * rand()), len * (0.35 + 0.25 * rand()), depth - 1);
    }
  };
  // From the bottom edge, pointing up; longer toward the corners.
  for (let px = 0; px <= W; px += 6 + rand() * 6) {
    const corner = 1 - Math.min(px, W - px) / (W / 2);
    branch(px, H, -Math.PI / 2 + (rand() - 0.5) * 1.2, R * (0.15 + 0.85 * corner * corner) * (0.6 + 0.4 * rand()), 3);
  }
  // Up the sides a little way, pointing in.
  for (const side of [0, 1])
    for (let py = H; py > H - R * 1.4; py -= 6 + rand() * 6) {
      const k = (py - (H - R * 1.4)) / (R * 1.4);
      branch(side ? W : 0, py, (side ? Math.PI : 0) + (rand() - 0.5) * 1.0, R * 0.5 * k * (0.5 + 0.5 * rand()), 3);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildFrost(house, glassBoxes) {
  const cfg = house.timeOfDay.frost;
  const group = new THREE.Group();
  group.name = "frost";
  const mats = [];
  const textures = new Map(); // one drawing per pane size
  const materialFor = (w, h) => {
    const key = `${w.toFixed(2)}x${h.toFixed(2)}`;
    if (!textures.has(key)) {
      // A faint glow of its own (city light caught in the ice), so it still reads on a dark night.
      const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(cfg.colour), emissive: new THREE.Color(cfg.colour).multiplyScalar(cfg.glow ?? 0), map: frostTexture(w, h, cfg.reach ?? 0.35), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      textures.set(key, m);
      mats.push(m);
    }
    return textures.get(key);
  };
  const unitY = (house.floors[0].rooms.find((r) => r.id === "main")?.y ?? [0, 10]);
  for (const b of glassBoxes) {
    const w = b.x[1] - b.x[0], h = b.z[1] - b.z[0];
    const inside = (b.y[0] + b.y[1]) / 2 > (unitY[0] + unitY[1]) / 2 ? -1 : 1; // nudge the layer toward the room
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materialFor(w, h));
    m.position.copy(planToThree((b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2 + inside * 0.012, (b.z[0] + b.z[1]) / 2));
    m.renderOrder = 2;
    m.raycast = () => {};
    group.add(m);
  }
  function update(env, date) {
    const month = +date.slice(5, 7);
    const cold = cfg.months.includes(month);
    const dark = Math.max(0, Math.min(1, (cfg.belowSunAltitude - env.sun.altitude) / 6));
    const opacity = cold ? cfg.maxOpacity * dark : 0;
    for (const m of mats) m.opacity = opacity;
    group.visible = opacity > 0.01;
  }
  return { group, update };
}
