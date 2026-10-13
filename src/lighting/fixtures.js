// Indoor light fittings from house.json: the visible fitting (recessed downlight,
// flush ceiling light, light bar, under-cupboard strip, desk lamp), the light it
// gives off, small glowing indicators, and the switch plates on the walls.
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";
import { lightReach, roomIndexAt } from "./rooms.js";

const DEG = Math.PI / 180;
const WHITE = 0xf2f2f0, DARK = 0x1c1c1c;
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const NORMALS = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], down: [0, 0, -1], up: [0, 0, 1] };
const PLATE = { w: 0.08, h: 0.12, t: 0.01, gangGap: 0.075, rocker: [0.028, 0.05, 0.012], tiltDeg: 8 };

// A fitting's glowing part: white when off, the light's colour when on.
function glowMaterial(colour) {
  return new THREE.MeshLambertMaterial({ color: 0xf6f6f4, emissive: new THREE.Color(colour), emissiveIntensity: 0 });
}

// A mesh placed in plan space: centre (x, y, z), size along plan x, y, z.
function placedBox(material, [x, y, z], [sx, sy, sz]) {
  const m = new THREE.Mesh(unitBox, material);
  m.scale.set(sx, sz, sy);
  m.position.copy(planToThree(x, y, z));
  return m;
}

export function buildFixtures(house, state, lightState, roomGraph) {
  const floor = house.floors[0];
  const cfg = house.indoorLighting;
  const group = new THREE.Group();
  group.name = "fixtures";
  const body = new THREE.MeshLambertMaterial({ color: WHITE });
  const black = new THREE.MeshLambertMaterial({ color: DARK });
  const entries = [];

  const ceilingOf = (roomId) => floor.rooms.find((r) => r.id === roomId)?.ceilingHeight ?? floor.defaultCeilingHeight;

  for (const l of lightState.lights) {
    const colour = new THREE.Color(l.colour);
    const glow = glowMaterial(l.colour);
    const e = { def: l, lights: [], glow, level: -1 };
    const drop = cfg.emitterDrop;

    const addSpot = (from, to, halfAngle, penumbra) => {
      const s = new THREE.SpotLight(colour, 0, 0, halfAngle, penumbra, 2);
      s.position.copy(planToThree(...from));
      s.target.position.copy(planToThree(...to));
      group.add(s, s.target);
      e.lights.push(s);
      return s;
    };
    const addPoint = (at) => {
      const p = new THREE.PointLight(colour, 0, 0, 2);
      p.position.copy(planToThree(...at));
      group.add(p);
      e.lights.push(p);
      return p;
    };

    if (l.fitting === "recessed") {
      const [x, y, z] = l.position;
      const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), body);
      trim.position.copy(planToThree(x, y, z - 0.006));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 24), glow);
      lens.rotation.x = Math.PI / 2; // face down
      lens.position.copy(planToThree(x, y, z - 0.013));
      group.add(trim, lens);
      addSpot([x, y, z - drop], [x, y, 0], ((l.beamDeg ?? 90) / 2) * DEG, 0.7);
    } else if (l.fitting === "flush") {
      const [x, y, z] = l.position;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.16, 0.07, 32), glow);
      shade.position.copy(planToThree(x, y, z - 0.035));
      group.add(shade);
      addPoint([x, y, z - 0.07 - drop]);
    } else if (l.fitting === "bar") {
      // On the nearest wall of its room, running along it.
      const [x, y, z] = l.position;
      const r = floor.rooms.find((r) => r.id === l.room);
      const d = { "-x": x - r.x[0], "+x": r.x[1] - x, "-y": y - r.y[0], "+y": r.y[1] - y };
      const wallSide = Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
      const alongX = wallSide.endsWith("y");
      const bar = placedBox(glow, [x, y, z], alongX ? [0.6, 0.05, 0.05] : [0.05, 0.6, 0.05]);
      group.add(bar);
      const out = NORMALS[wallSide].map((v) => -v); // into the room
      addPoint([x + out[0] * (cfg.barOffset ?? 0.1), y + out[1] * (cfg.barOffset ?? 0.1), z - 0.02]);
    } else if (l.fitting === "strip") {
      const [a, b] = [l.from, l.to];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
      group.add(placedBox(glow, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] - 0.004], alongX ? [len, 0.02, 0.008] : [0.02, len, 0.008]));
      const n = l.emitters ?? 1;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
        addSpot([px, py, a[2] - drop], [px, py, 0], 75 * DEG, 1);
      }
    } else if (l.fitting === "taskLamp") {
      // Base on the desk, a stem, and a shade around the bulb pointing at aimAt.
      const item = floor.furniture.find((f) => f.light === l.id);
      const place = item?.byState?.[state] ?? item;
      const lamp = new THREE.Group();
      lamp.userData.interactId = item?.id;
      if (place) {
        const bx = (place.x[0] + place.x[1]) / 2, by = (place.y[0] + place.y[1]) / 2, bz = place.z[0];
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 24), black);
        base.position.copy(planToThree(bx, by, bz + 0.01));
        const top = planToThree(...l.position), foot = planToThree(bx, by, bz + 0.02);
        const stem = new THREE.Mesh(unitBox, black);
        stem.scale.set(0.012, foot.distanceTo(top), 0.012);
        stem.position.copy(foot).lerp(top, 0.5);
        stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
        lamp.add(base, stem);
      }
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 24, 1, true), new THREE.MeshLambertMaterial({ color: DARK, side: THREE.DoubleSide }));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 10), glow);
      const head = planToThree(...l.position), aim = planToThree(...l.aimAt);
      const dir = aim.clone().sub(head).normalize();
      shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); // cone opens toward the aim
      shade.position.copy(head).addScaledVector(dir, 0.03);
      bulb.position.copy(head);
      lamp.add(shade, bulb);
      if (place) {
        // An invisible box over the lamp's footprint, so it is easy to aim at (rays still hit invisible meshes).
        const pick = placedBox(body, [(place.x[0] + place.x[1]) / 2, (place.y[0] + place.y[1]) / 2, (place.z[0] + place.z[1]) / 2], [place.x[1] - place.x[0], place.y[1] - place.y[0], place.z[1] - place.z[0]]);
        pick.visible = false;
        lamp.add(pick);
      }
      lamp.traverse((o) => (o.userData.interactId = item?.id));
      group.add(lamp);
      const s = addSpot(l.position, l.aimAt, ((l.beamDeg ?? 55) / 2) * DEG, 0.5);
      s.position.copy(head).addScaledVector(dir, 0.04);
    } else {
      addPoint(l.position); // appliance lights and anything else: no visible fitting
    }

    if (l.castShadow) {
      for (const lt of e.lights) {
        lt.castShadow = true;
        const size = lt.isPointLight ? cfg.shadows.pointMapSize : cfg.shadows.spotMapSize;
        lt.shadow.mapSize.set(size, size);
        lt.shadow.camera.near = 0.05;
        lt.shadow.camera.far = 12;
        lt.shadow.bias = -0.0015;
        lt.shadow.normalBias = 0.03;
        lt.shadow.autoUpdate = false;
        lt.shadow.needsUpdate = true;
      }
    }
    entries.push(e);
  }

  // Indicators: small glows with no light of their own (TV standby, climate panel, screens).
  const indicators = floor.lights.filter((l) => l.type === "indicator" && !l.followsDoorLock && (!l.states || l.states.includes(state)));
  for (const ind of indicators) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ind.colour).multiplyScalar(Math.min(1, 0.4 + ind.lumens / 10)) });
    const item = ind.screenOf && floor.furniture.find((f) => f.id === ind.screenOf.item);
    if (item && (!item.states || item.states.includes(state))) {
      // Light up a face of the item: its front (by rotationDeg) or its top.
      const cx = (item.x[0] + item.x[1]) / 2, cy = (item.y[0] + item.y[1]) / 2, cz = (item.z[0] + item.z[1]) / 2;
      let screen;
      if (ind.screenOf.face === "top") {
        screen = placedBox(mat, [cx, cy, item.z[1] + 0.001], [(item.x[1] - item.x[0]) * 0.85, (item.y[1] - item.y[0]) * 0.85, 0.001]);
      } else {
        const r = (((item.rotationDeg ?? 0) % 360) + 360) % 360;
        const n = { 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] }[r] ?? [0, 1];
        const fx = n[0] < 0 ? item.x[0] - 0.002 : n[0] > 0 ? item.x[1] + 0.002 : cx;
        const fy = n[1] < 0 ? item.y[0] - 0.002 : n[1] > 0 ? item.y[1] + 0.002 : cy;
        const h = (item.z[1] - item.z[0]) * 0.8;
        screen = placedBox(mat, [fx, fy, cz], n[0] !== 0 ? [0.002, (item.y[1] - item.y[0]) * 0.92, h] : [(item.x[1] - item.x[0]) * 0.92, 0.002, h]);
      }
      group.add(screen);
    } else if (!ind.screenOf) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), mat);
      dot.position.copy(planToThree(...ind.position));
      group.add(dot);
    }
  }

  // Switch plates: one rocker per control (a two-gang plate has two).
  const rockers = [];
  for (const s of floor.switches ?? []) {
    const n = NORMALS[s.facing] ?? [0, 0, 1];
    const controls = s.gangs ? s.gangs.map((g) => `${s.id}.${g.id}`) : [s.id];
    const flat = n[2] !== 0; // on the underside of a cupboard
    const tangent = flat ? [0, 1, 0] : [Math.abs(n[0]) > 0 ? 0 : 1, Math.abs(n[0]) > 0 ? 1 : 0, 0];
    const width = PLATE.w + (controls.length - 1) * PLATE.gangGap;
    const [px, py, pz] = s.position;
    // Size in plan (x, y, z) of a part `along` wide (along the wall), `up` tall and `thick` deep.
    const sizeOf = (along, up, thick) => (flat ? [up, along, thick] : [tangent[0] ? along : thick, tangent[1] ? along : thick, up]);
    const plate = placedBox(body, [px + n[0] * PLATE.t / 2, py + n[1] * PLATE.t / 2, pz + n[2] * PLATE.t / 2], sizeOf(width, PLATE.h, PLATE.t));
    if (controls.length === 1) plate.userData.interactId = controls[0];
    group.add(plate);
    controls.forEach((id, i) => {
      const off = (i - (controls.length - 1) / 2) * PLATE.gangGap;
      const [rw, rh, rt] = PLATE.rocker;
      const c = [px + tangent[0] * off + n[0] * (PLATE.t + rt / 2), py + tangent[1] * off + n[1] * (PLATE.t + rt / 2), pz + n[2] * (PLATE.t + rt / 2)];
      const rocker = placedBox(new THREE.MeshLambertMaterial({ color: 0xe4e4e2 }), c, sizeOf(rw, rh, rt));
      rocker.userData.interactId = id;
      group.add(rocker);
      rockers.push({ id, mesh: rocker, axis: planToThree(...tangent).normalize() });
    });
  }

  // Glowing parts don't cast shadows (they would shade their own light); everything else does.
  const glows = new Set(entries.map((e) => e.glow));
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !glows.has(o.material) && !o.material.isMeshBasicMaterial;
  });

  // Per frame: brightness of every light and fitting from the light state.
  function update(levels) {
    let shadowsDirty = false;
    for (const e of entries) {
      const level = levels[e.def.id] ?? 0;
      if (level === e.level) continue;
      for (const lt of e.lights) {
        lt.intensity = lightState.intensity(e.def, level);
        if (lt.castShadow && level > 0 && !(e.level > 0)) { lt.shadow.needsUpdate = true; shadowsDirty = true; }
      }
      e.glow.emissiveIntensity = cfg.fittingGlow * level;
      e.level = level;
    }
    for (const r of rockers) {
      const on = lightState.condition(r.id) === "on";
      r.mesh.setRotationFromAxisAngle(r.axis, (on ? -1 : 1) * PLATE.tiltDeg * DEG);
    }
    return shadowsDirty;
  }

  // Something that casts shadows moved: refresh the indoor shadow maps of lights that are on.
  function markShadows() {
    for (const e of entries) if (e.level > 0) for (const lt of e.lights) if (lt.castShadow) lt.shadow.needsUpdate = true;
  }

  // How much indoor light reaches a plan point (for the eye adapting): inverse square, walls respected.
  function lightLevelAt(p, openness) {
    const room = roomIndexAt(roomGraph, p[0], p[1]);
    let sum = 0;
    for (const e of entries) {
      if (!(e.level > 0)) continue;
      for (const lt of e.lights) {
        const q = [lt.position.x, -lt.position.z, lt.position.y];
        const d2 = Math.max(0.25, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2);
        sum += (lt.intensity / d2) * lightReach(roomGraph, q, p, room, openness);
      }
    }
    return sum;
  }

  // Bounced light per room (linear RGB): lumens switched on in the room over its floor area,
  // plus a share from next-door rooms through their open doorways.
  const roomArea = roomGraph.rooms.map((r) => (r.x[1] - r.x[0]) * (r.y[1] - r.y[0]));
  const lightRoom = entries.map((e) => roomIndexAt(roomGraph, ...(e.def.position ?? e.def.from)));
  function roomFill(openness) {
    const own = roomGraph.rooms.map(() => [0, 0, 0]);
    entries.forEach((e, i) => {
      const r = lightRoom[i];
      if (r < 0 || !(e.level > 0)) return;
      const k = (e.def.lumens * e.level * cfg.bounce.perLumenPerSquareMetre) / roomArea[r];
      const c = new THREE.Color(e.def.colour); // converted to linear by Three.js
      own[r][0] += c.r * k; own[r][1] += c.g * k; own[r][2] += c.b * k;
    });
    const out = own.map((c) => [...c]);
    for (const q of roomGraph.portals) {
      const share = (q.always ? 1 : openness(q.doorId)) * cfg.bounce.throughOpenDoor;
      if (share <= 0) continue;
      for (let ch = 0; ch < 3; ch++) {
        out[q.b][ch] += own[q.a][ch] * share * Math.min(1, roomArea[q.a] / roomArea[q.b]);
        out[q.a][ch] += own[q.b][ch] * share * Math.min(1, roomArea[q.b] / roomArea[q.a]);
      }
    }
    return out;
  }

  return { group, entries, update, markShadows, lightLevelAt, roomFill };
}
