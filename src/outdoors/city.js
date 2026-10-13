// The view from the window, built from house.json's outdoors items: ground with
// the street grid, the main street and its trees, low houses in the sector the
// notes describe, parking lots, the near block, the church and spire, the two
// buildings that frame the lake sliver, the hills to the right and the radio
// mast. Instanced, so thousands of houses cost a few draw calls. Seasons (snow,
// bare trees, frozen lake) and night lights (windows, street lights, mast) follow
// the clock. Items beyond the camera's reach are pulled in and scaled down so they
// keep the same size in view.
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";
import { twilightMinutes } from "../lighting/schedule.js";
import { parseHHMM } from "../time/clock.js";

const RAD = Math.PI / 180;
const FAR = 5200; // the camera sees about 6 km; anything further is brought in to here

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Day of the year for "MM-DD", to test seasonal ranges that may wrap the new year.
const dayOf = (mmdd) => { const [m, d] = mmdd.split("-").map(Number); return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5); };
const inSeason = ([from, to], date) => { const d = dayOf(date.slice(5)), a = dayOf(from), b = dayOf(to); return a <= b ? d >= a && d <= b : d >= a || d <= b; };

// A gabled roof: a triangular prism one unit wide, deep and tall, ridge along z.
function roofGeometry() {
  const g = new THREE.BufferGeometry();
  const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
  const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed(); // flat-shaded slopes and gables
  flat.computeVertexNormals();
  return flat;
}

// Facade texture: rows of windows on a wall.
function windowTexture(wall, glass) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = wall; x.fillRect(0, 0, 64, 64);
  x.fillStyle = glass;
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) x.fillRect(4 + k * 16, 4 + r * 16, 9, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ground texture: one 110 m block of grass with the road along two edges.
function groundTexture(look, spacing, road, snow = false) {
  const n = 256, c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d");
  x.fillStyle = snow ? look.snow : look.grass; x.fillRect(0, 0, n, n);
  const rand = rng(5);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.06})`; x.fillRect(rand() * n, rand() * n, 3 + rand() * 8, 3 + rand() * 8); }
  const r = (road / spacing) * n;
  x.fillStyle = snow ? look.snowRoads ?? look.asphalt : look.asphalt; x.fillRect(0, 0, n, r); x.fillRect(0, 0, r, n);
  x.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < n; i += 12) { x.fillRect(i, r / 2 - 0.5, 6, 1); x.fillRect(r / 2 - 0.5, i, 1, 6); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function buildOutdoors(house) {
  const od = house.outdoors, look = od.look, gz = od.groundZ;
  const facing = house.site.facing.bearingDeg;
  const glass = house.floors[0].walls.find((w) => w.kind === "glazing");
  const origin = glass ? [(glass.a[0] + glass.b[0]) / 2, (glass.a[1] + glass.b[1]) / 2] : [0, 0];
  const at = (bearing, d) => { const t = (bearing - facing) * RAD; return [origin[0] + d * Math.sin(t), origin[1] + d * Math.cos(t)]; };
  const bearingOf = (x, y) => (((facing + Math.atan2(x - origin[0], y - origin[1]) / RAD) % 360) + 360) % 360;
  const items = Object.fromEntries(od.items.map((i) => [i.id, i]));
  const group = new THREE.Group();
  group.name = "outdoors";
  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), ...extra });
  const mats = [];
  const keep = (m) => (mats.push(m), m);

  // Rectangles already taken by named features (no houses there).
  const taken = [];
  const takeRect = (cx, cy, w, d, pad = 10) => taken.push([cx - w / 2 - pad, cx + w / 2 + pad, cy - d / 2 - pad, cy + d / 2 + pad]);
  const isTaken = (x, y) => taken.some(([a, b, c, d]) => x >= a && x <= b && y >= c && y <= d);

  // Ground with the road grid, aligned so the main street is one of its roads.
  const grid = items.low_roofs?.streetSpacing ?? 110;
  const street = items.street_main;
  const [sx, sy] = street ? at(street.bearingDeg, street.distance) : origin;
  const gtex = groundTexture(look, grid, street?.width ?? 12);
  const gtexSnow = groundTexture(look, grid, street?.width ?? 12, true);
  const size = 2 * FAR;
  gtex.repeat.set(size / grid, size / grid);
  gtexSnow.repeat.copy(gtex.repeat);
  gtex.offset.set(((origin[0] - size / 2 - (sx - (street?.width ?? 12) / 2)) / grid) % 1, ((origin[1] - size / 2 - (sy + (street?.width ?? 12) / 2)) / grid) % 1);
  gtexSnow.offset.copy(gtex.offset);
  const groundMat = keep(lam("#ffffff", { map: gtex }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(planToThree(origin[0], origin[1], gz));
  ground.name = "ground";
  group.add(ground);

  // Flat lots (the tower's forecourt and the parking lots).
  for (const it of od.items.filter((i) => i.type === "parking_lot")) {
    const [x, y] = at(it.bearingDeg, it.distance);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(it.size[0], it.size[1]), keep(lam(look.parking)));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(planToThree(x, y, gz + 0.05));
    group.add(m);
    takeRect(x, y, it.size[0], it.size[1]);
  }

  // Plain blocks (the near block and the two that frame the lake sliver).
  const facadeTex = windowTexture(look.tallBuildings, look.tallBuildingsGlass);
  for (const it of od.items.filter((i) => i.type === "building")) {
    const [x, y] = at(it.bearingDeg, it.distance);
    const [w, d, h] = it.size;
    const tex = facadeTex.clone();
    tex.repeat.set(w / 12, h / 12);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), keep(lam("#ffffff", { map: tex })));
    m.position.copy(planToThree(x, y, gz + h / 2));
    group.add(m);
    takeRect(x, y, w, d);
  }

  // The church: nave, gabled roof, tower and spire.
  const church = items.church;
  if (church) {
    const [x, y] = at(church.bearingDeg, church.distance);
    const [w, d, h] = church.nave;
    const cm = keep(lam(look.church)), sm = keep(lam(look.spire));
    const nave = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cm);
    nave.position.copy(planToThree(x, y, gz + h / 2));
    const roof = new THREE.Mesh(roofGeometry(), sm);
    roof.scale.set(w, h * 0.5, d);
    roof.position.copy(planToThree(x, y, gz + h));
    const towerH = church.spireHeight * 0.55;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, towerH, w * 0.45), cm);
    tower.position.copy(planToThree(x, y - d / 2 - w * 0.2, gz + towerH / 2));
    const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, church.spireHeight - towerH, 4), sm);
    spire.rotation.y = Math.PI / 4;
    spire.position.copy(planToThree(x, y - d / 2 - w * 0.2, gz + towerH + (church.spireHeight - towerH) / 2));
    group.add(nave, roof, tower, spire);
    takeRect(x, y, w + 10, d + 20);
  }

  // Houses: lots along both sides of each road in the sector, thinning with distance.
  const rr = items.low_roofs;
  const houses = [];
  if (rr) {
    const rand = rng(rr.seed ?? 21);
    const [b0, b1] = rr.bearingRange, [d0, d1] = rr.distanceRange.map((d) => Math.min(d, FAR));
    const [lotW, lotD] = rr.lot, road = street?.width ?? 12;
    const gx0 = sx - Math.ceil((sx - origin[0] + d1) / grid) * grid, gy0 = sy - Math.ceil((sy - origin[1] + d1) / grid) * grid;
    for (let gx = gx0; gx < origin[0] + d1; gx += grid)
      for (let gy = gy0; gy < origin[1] + d1; gy += grid) {
        // Two rows of lots in each block, facing the roads above and below it.
        for (const row of [0, 1]) {
          for (let lx = gx + road / 2 + 2; lx + lotW <= gx + grid - road / 2; lx += lotW) {
            const ly = row === 0 ? gy + road / 2 + lotD / 2 + 2 : gy + grid - road / 2 - lotD / 2 - 2;
            const cx = lx + lotW / 2, cy = ly;
            const dist = Math.hypot(cx - origin[0], cy - origin[1]), b = bearingOf(cx, cy);
            if (dist < d0 || dist > d1 || b < b0 || b > b1 || isTaken(cx, cy)) continue;
            if (dist > 1200 && rand() > 1200 / dist) continue; // thinner far away
            houses.push({ x: cx, y: cy, w: lotW * (0.62 + rand() * 0.18), d: 9 + rand() * 4, h: rr.height[0] + rand() * (rr.height[1] - rr.height[0]), front: row === 0 ? -1 : 1, r: rand() });
          }
        }
      }
    houses.sort((a, b) => Math.hypot(a.x - origin[0], a.y - origin[1]) - Math.hypot(b.x - origin[0], b.y - origin[1]));
    houses.length = Math.min(houses.length, look.maxHouses ?? 9000);
  }
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), keep(lam("#ffffff")), Math.max(1, houses.length));
  const roofMesh = new THREE.InstancedMesh(roofGeometry(), keep(lam("#ffffff")), Math.max(1, houses.length));
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  const roofColours = houses.map((h) => look.roofs[Math.floor(h.r * look.roofs.length) % look.roofs.length]);
  houses.forEach((h, i) => {
    mtx.compose(planToThree(h.x, h.y, gz + h.h / 2), new THREE.Quaternion(), new THREE.Vector3(h.w, h.h, h.d));
    wallMesh.setMatrixAt(i, mtx);
    wallMesh.setColorAt(i, col.set(look.walls[Math.floor(h.r * 97) % look.walls.length]));
    const flat = h.r > 0.75;
    mtx.compose(planToThree(h.x, h.y, gz + h.h), new THREE.Quaternion(), new THREE.Vector3(h.w + 0.6, flat ? 0.4 : h.d * 0.35, h.d + 0.6));
    roofMesh.setMatrixAt(i, mtx);
    roofMesh.setColorAt(i, col.set(roofColours[i]));
  });
  wallMesh.count = roofMesh.count = houses.length;
  group.add(wallMesh, roofMesh);

  // Trees: a row each side of the main street, and some in the nearer yards.
  const trees = [];
  const st = items.street_trees;
  if (st && street) {
    for (const off of st.offsets) for (let t = -st.length / 2; t <= st.length / 2; t += st.spacing) trees.push([sx + t, sy + off, st.height]);
  }
  const yardRand = rng(77);
  for (const h of houses) if (Math.hypot(h.x - origin[0], h.y - origin[1]) < 900 && yardRand() < 0.7) trees.push([h.x + (yardRand() - 0.5) * 8, h.y - h.front * (h.d / 2 + 6 + yardRand() * 6), 7 + yardRand() * 5]);
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), keep(lam(look.treesBare)), Math.max(1, trees.length));
  const crownMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), keep(lam(look.trees, { flatShading: true })), Math.max(1, trees.length));
  trees.forEach(([x, y, h], i) => {
    mtx.compose(planToThree(x, y, gz + h * 0.3), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.6, 1));
    trunkMesh.setMatrixAt(i, mtx);
    mtx.compose(planToThree(x, y, gz + h * 0.7), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0)), new THREE.Vector3(h * 0.32, h * 0.38, h * 0.32));
    crownMesh.setMatrixAt(i, mtx);
  });
  group.add(trunkMesh, crownMesh);

  // The lake sliver: a narrow wedge of water.
  const lake = items.lake_sliver;
  let lakeMat = null;
  if (lake) {
    const [a0, a1] = lake.bearingRange, [r0, r1] = lake.distanceRange.map((d) => Math.min(d, FAR));
    const shape = new THREE.Shape();
    const pts = [[a0, r0], [a1, r0], [a1, r1], [a0, r1]].map(([b, r]) => at(b, r));
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) shape.lineTo(p[0], p[1]);
    lakeMat = keep(lam(lake.colour ?? look.water));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), lakeMat);
    m.rotation.x = -Math.PI / 2; // shape is drawn in plan x/y; lay it flat (three z = -plan y)
    m.position.y = gz + 0.2;
    group.add(m);
  }

  // Hills to the right: a low-poly ridge, pulled in and scaled to keep its size in view.
  const hills = items.hills;
  let hillMat = null;
  if (hills) {
    const [a0, a1] = hills.bearingRange, [h0, h1] = hills.height, rand = rng(9);
    const dist = Math.min(FAR, hills.distanceRange[0]), k = dist / hills.distanceRange[0];
    const steps = 40, pos = [];
    const peak = Array.from({ length: steps + 1 }, () => h0 + rand() * (h1 - h0));
    for (let i = 0; i < steps; i++) {
      const ba = a0 + ((a1 - a0) * i) / steps, bb = a0 + ((a1 - a0) * (i + 1)) / steps;
      const [ax, ay] = at(ba, dist), [bx, by] = at(bb, dist), [cx, cy] = at(ba, dist * 1.08), [ex, ey] = at(bb, dist * 1.08);
      const A = planToThree(ax, ay, gz), B = planToThree(bx, by, gz), C = planToThree(cx, cy, gz + peak[i] * k), E = planToThree(ex, ey, gz + peak[i + 1] * k);
      pos.push(...A.toArray(), ...C.toArray(), ...B.toArray(), ...B.toArray(), ...C.toArray(), ...E.toArray());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    hillMat = keep(lam(look.hills, { flatShading: true, side: THREE.DoubleSide }));
    group.add(new THREE.Mesh(g, hillMat));
  }

  // The radio mast and its red lights.
  const mast = items.radio_mast;
  const mastLights = [];
  if (mast) {
    const [x, y] = at(mast.bearingDeg, mast.distance);
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, mast.height, 2), keep(lam(look.mast)));
    m.position.copy(planToThree(x, y, gz + mast.height / 2));
    group.add(m);
    for (const h of mast.lights.heights) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: mast.lights.colour, transparent: true }));
      l.position.copy(planToThree(x, y, gz + h));
      group.add(l);
      mastLights.push(l);
    }
  }

  // Night lights as points: house windows (some) and street lights along the nearer roads.
  const winPts = [], nw = look.nightWindows, wr = rng(31);
  for (const h of houses) if (wr() < nw.litFraction) winPts.push(...planToThree(h.x + (wr() - 0.5) * h.w * 0.6, h.y + h.front * (h.d / 2 + 0.2), gz + 2 + wr() * (h.h - 3)).toArray());
  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute("position", new THREE.Float32BufferAttribute(winPts, 3));
  const winMat = new THREE.PointsMaterial({ color: nw.colour, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const lamps = [], ls = look.streetLights;
  for (let gy = sy - grid * 12; gy <= sy + grid * 12; gy += grid) for (let t = -1500; t <= 1500; t += ls.spacing) {
    const [px, py] = [sx + t, gy];
    const dist = Math.hypot(px - origin[0], py - origin[1]);
    if (dist > 120 && dist < 2500 && Math.abs(bearingOf(px, py) - facing) < 100) lamps.push(...planToThree(px, py, gz + 6).toArray());
  }
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute("position", new THREE.Float32BufferAttribute(lamps, 3));
  const lampMat = new THREE.PointsMaterial({ color: ls.colour, size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  group.add(new THREE.Points(winGeo, winMat), new THREE.Points(lampGeo, lampMat));

  group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.raycast = () => {}; });

  // Seasons and night, from the date and the sky.
  let season = "";
  const night = (env) => Math.max(0, Math.min(1, (-env.sun.altitude - 1) / 6));
  function update(env, date, minutes, seconds) {
    const tod = house.timeOfDay.season;
    const snow = inSeason(tod.snowCover, date), frozen = inSeason(tod.harbourFrozen, date);
    const leaves = inSeason(od.leafOn ?? ["05-15", "10-25"], date);
    const key = `${snow}${frozen}${leaves}`;
    if (key !== season) {
      season = key;
      groundMat.map = snow ? gtexSnow : gtex;
      const snowCol = new THREE.Color(look.snow);
      roofColours.forEach((c, i) => roofMesh.setColorAt(i, col.set(c).lerp(snowCol, snow ? 0.85 : 0)));
      if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
      if (hillMat) hillMat.color.set(snow ? look.hillsSnow : look.hills);
      if (lakeMat) lakeMat.color.set(frozen ? look.waterFrozen : lake.colour ?? look.water);
      crownMesh.visible = leaves;
    }
    const n = night(env);
    const tw = twilightMinutes(house, date);
    const winOn = minutes >= (nw.from === "dusk" ? tw.dusk : parseHHMM(nw.from)) && minutes < (parseHHMM(nw.to) ?? 1440);
    winMat.opacity = winOn ? n : 0;
    lampMat.opacity = n;
    const blink = Math.floor((seconds * (mast?.lights.blinkPerMinute ?? 30)) / 60) % 2 === 0;
    for (const l of mastLights) { l.visible = n > 0.2; l.material.opacity = blink ? 1 : 0.15; }
  }

  return { group, update, houses: houses.length, trees: trees.length };
}
