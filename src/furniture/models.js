// Low-poly furniture built in code, one builder per furniture type in house.json.
// Every builder fills its item's footprint exactly: W (width, local x), H (height,
// local y, from the floor of the footprint) and D (depth, local z), with the
// item's front facing local -z. Parts go into a batch (art/batch.js) through the
// kit k: k.box(material, centre, size), k.span(material, [x0,x1], [y0,y1], [z0,z1]),
// k.cyl(material, centre, radiusTop, radiusBottom, height), k.sphere(...), k.geom(...).
// Materials are house.json's (M.<id>) plus a few helpers (M._shadow, M._screen, ...).
import * as THREE from "three";
import { tinted } from "../art/materials.js";

const T = 0.018; // panel thickness for doors and drawer fronts
const GAP = 0.003; // gap between doors

// Doors and drawers across a cabinet front, with bar handles.
function cabinetFronts(k, M, { x0, x1, y0, y1, z, mat, handle = "top", count }) {
  const w = x1 - x0, n = count ?? Math.max(1, Math.round(w / 0.6));
  for (let i = 0; i < n; i++) {
    const a = x0 + (w * i) / n + GAP, b = x0 + (w * (i + 1)) / n - GAP;
    k.span(mat, [a, b], [y0 + GAP, y1 - GAP], [z - T, z]);
    const hy = handle === "top" ? y1 - 0.06 : handle === "bottom" ? y0 + 0.06 : (y0 + y1) / 2;
    const hl = Math.min(0.3, (b - a) * 0.5);
    k.box(M.stainless, [(a + b) / 2, hy, z - T - 0.012], [hl, 0.012, 0.012]);
  }
}

// A pleated sheet (shower curtain), x across, y down from the rail.
function pleatGeometry(width, height, folds, depth) {
  const g = new THREE.PlaneGeometry(width, height, folds * 6, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(((p.getX(i) / width) + 0.5) * folds * Math.PI * 2) * depth);
  g.computeVertexNormals();
  return g;
}

function shoeShape(k, M, x, z, len, side) {
  k.box(M.black_matte, [x, 0.03, z], [0.09, 0.06, len]);
  k.sphere(M.black_matte, [x, 0.055, z - len * 0.3 * side], 0.05, [0.9, 0.5, 1.2]);
}

export const MODELS = {
  default({ k, W, H, D, item, M }) {
    k.box(M[item.material] ?? M.furniture_white, [0, H / 2, 0], [W, H, D]);
  },

  bed_queen({ k, W, H, D, item, M }) {
    const hb = item.headboard ? item.headboard.x[1] - item.headboard.x[0] : 0.08;
    const back = D / 2 - hb;
    k.span(M.headboard_grey, [-W / 2, W / 2], [0.1, 0.3], [-D / 2, back]); // upholstered base
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(M._wood_dark, [x * (W / 2 - 0.05), 0.05, z * (D / 2 - hb - 0.06) - (z < 0 ? 0 : 0)], [0.05, 0.1, 0.05]);
    k.span(M.sheet_white, [-W / 2 + 0.01, W / 2 - 0.01], [0.3, H - 0.03], [-D / 2 + 0.01, back - 0.01]); // mattress
    k.span(M.duvet_grey, [-W / 2 - 0.02, W / 2 + 0.02], [0.33, H + 0.02], [-D / 2 - 0.02, back - 0.55]); // duvet, turned down at the head
    k.span(M.duvet_grey, [-W / 2 - 0.02, W / 2 + 0.02], [H - 0.03, H + 0.035], [back - 0.62, back - 0.52]); // the fold
    for (const s of [-1, 1]) k.sphere(M.sheet_white, [s * W * 0.24, H + 0.04, back - 0.27], 1, [W * 0.22, 0.07, 0.19]); // two pillows
    k.span(M.headboard_grey, [-W / 2 - 0.03, W / 2 + 0.03], [0, item.headboard?.z?.[1] ?? 1.1], [back, D / 2]);
  },

  bedside_table({ k, W, H, D, M }) {
    k.span(M.furniture_white, [-W / 2, W / 2], [0.06, H], [-D / 2 + T, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.06], [-D / 2 + 0.03, D / 2 - 0.02]);
    k.span(M.furniture_white, [-W / 2 + GAP, W / 2 - GAP], [H - 0.17, H - 0.03], [-D / 2, -D / 2 + T]);
    k.cyl(M.stainless, [0, H - 0.1, -D / 2 - 0.012], 0.012, 0.012, 0.02, 12, [Math.PI / 2, 0, 0]);
  },

  desk({ k, W, H, D, M, item }) {
    const mat = M[item.material] ?? M.furniture_white;
    k.span(mat, [-W / 2, W / 2], [H - 0.03, H], [-D / 2, D / 2]);
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.box(mat, [x * (W / 2 - 0.04), (H - 0.03) / 2, z * (D / 2 - 0.04)], [0.04, H - 0.03, 0.04]);
    k.span(mat, [-W / 2 + 0.04, W / 2 - 0.04], [H - 0.12, H - 0.03], [D / 2 - 0.05, D / 2 - 0.03]); // back rail
    k.span(M._cable, [-W / 2 + 0.1, W / 2 - 0.1], [H, H + 0.004], [D / 2 - 0.04, D / 2 - 0.03]); // cables taped along the back edge
  },

  task_chair({ k, W, D, M }) {
    const seatY = 0.47;
    k.span(M.black_matte, [-0.24, 0.24], [seatY - 0.06, seatY], [-0.22, 0.22]);
    k.span(M.black_matte, [-0.22, 0.22], [seatY + 0.08, 0.95], [0.2, 0.25], [-0.12, 0, 0]);
    k.box(M.black_matte, [0, seatY + 0.04, 0.23], [0.06, 0.12, 0.03]);
    k.cyl(M.black_metal, [0, (seatY - 0.06 + 0.08) / 2, 0], 0.025, 0.025, seatY - 0.14);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.box(M.black_metal, [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], [0.04, 0.03, 0.3], [0, a, 0]);
      k.sphere(M._rubber, [Math.sin(a) * 0.28, 0.025, Math.cos(a) * 0.28], 0.025);
    }
  },

  fridge({ k, W, H, D, M, item, planToLocal }) {
    k.span(M.stainless, [-W / 2, W / 2], [0.04, H], [-D / 2 + 0.02, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.04], [-D / 2 + 0.05, D / 2]);
    k.span(M.stainless, [-W / 2 + GAP, W / 2 - GAP], [0.05, 0.6], [-D / 2, -D / 2 + 0.02]); // freezer drawer
    k.span(M.stainless, [-W / 2 + GAP, W / 2 - GAP], [0.62, H - 0.01], [-D / 2, -D / 2 + 0.02]); // door
    // Handle on the side away from the hinge (the hinge is on the side the notes name).
    const hingePlanY = parseFloat(String(item.doorHinge ?? "").match(/y = ([\d.]+)/)?.[1] ?? NaN);
    const hingeSide = Number.isFinite(hingePlanY) ? Math.sign(planToLocal((item.x[0] + item.x[1]) / 2, hingePlanY).x) || 1 : 1;
    k.box(M.stainless, [-hingeSide * (W / 2 - 0.06), 1.2, -D / 2 - 0.035], [0.025, 0.6, 0.025]);
    k.box(M.stainless, [0, 0.52, -D / 2 - 0.035], [W * 0.6, 0.025, 0.025]);
  },

  base_cabinets({ k, W, H, D, M, item, planToLocal }) {
    const top = H - 0.03;
    k.span(M.cabinet_white, [-W / 2, W / 2], [0.1, top], [-D / 2 + T + 0.02, D / 2]);
    k.span(M._shadow, [-W / 2, W / 2], [0, 0.1], [-D / 2 + 0.07, D / 2]);
    cabinetFronts(k, M, { x0: -W / 2, x1: W / 2, y0: 0.1, y1: top, z: -D / 2 + 0.02, mat: M.cabinet_white });
    // The worktop, cut round the sink if there is one.
    const front = -D / 2 - 0.02;
    if (item.cutout) {
      const a = planToLocal(item.x[0], item.cutout.y[0]).x, b = planToLocal(item.x[0], item.cutout.y[1]).x;
      const [c0, c1] = [Math.min(a, b), Math.max(a, b)];
      k.span(M.counter_grey, [-W / 2, c0], [top, H], [front, D / 2]);
      k.span(M.counter_grey, [c1, W / 2], [top, H], [front, D / 2]);
      k.span(M.counter_grey, [c0, c1], [top, H], [front, front + 0.06]);
      k.span(M.counter_grey, [c0, c1], [top, H], [D / 2 - 0.05, D / 2]);
    } else k.span(M.counter_grey, [-W / 2, W / 2], [top, H], [front, D / 2]);
  },

  upper_cabinets({ k, W, H, D, M }) {
    k.span(M.cabinet_white, [-W / 2, W / 2], [0, H], [-D / 2 + T, D / 2]);
    cabinetFronts(k, M, { x0: -W / 2, x1: W / 2, y0: 0, y1: H, z: -D / 2 + T, mat: M.cabinet_white, handle: "bottom", count: Math.max(1, Math.round(W / 0.45)) });
  },

  range({ k, W, H, D, M }) {
    k.span(M.stainless, [-W / 2, W / 2], [0, H - 0.012], [-D / 2 + 0.02, D / 2]);
    k.span(M.black_glass, [-W / 2, W / 2], [H - 0.012, H], [-D / 2, D / 2]);
    for (const [x, z, r] of [[-0.18, -0.1, 0.09], [0.18, -0.1, 0.08], [-0.18, 0.15, 0.08], [0.18, 0.15, 0.1]]) {
      k.cyl(M._shadow, [x * (W / 0.76), H + 0.001, z * (D / 0.65)], r, r, 0.002, 24);
      k.cyl(M.black_glass, [x * (W / 0.76), H + 0.0015, z * (D / 0.65)], r - 0.01, r - 0.01, 0.002, 24);
    }
    k.span(M.stainless, [-W / 2 + GAP, W / 2 - GAP], [0.1, H - 0.16], [-D / 2, -D / 2 + 0.02]); // oven door
    k.span(M.black_glass, [-W / 2 + 0.08, W / 2 - 0.08], [0.25, H - 0.3], [-D / 2 - 0.002, -D / 2]); // window
    k.box(M.stainless, [0, H - 0.2, -D / 2 - 0.04], [W - 0.12, 0.02, 0.02]); // handle
    for (let i = 0; i < 4; i++) k.cyl(M.black_matte, [-W / 2 + 0.12 + i * ((W - 0.24) / 3), H - 0.08, -D / 2 - 0.015], 0.018, 0.018, 0.025, 12, [Math.PI / 2, 0, 0]);
    k.span(M._shadow, [-W / 2 + 0.03, W / 2 - 0.03], [0, 0.09], [-D / 2 + 0.03, -D / 2 + 0.04]);
  },

  microwave({ k, W, H, D, M }) {
    k.span(M.stainless, [-W / 2, W / 2], [0, H], [-D / 2 + 0.02, D / 2]);
    k.span(M.black_glass, [-W / 2 + 0.03, W * 0.2], [0.04, H - 0.04], [-D / 2, -D / 2 + 0.02]);
    k.span(M.stainless, [W * 0.22, W / 2 - 0.02], [0.04, H - 0.04], [-D / 2 + 0.005, -D / 2 + 0.02]);
    k.span(M._screen, [W * 0.27, W / 2 - 0.06], [H - 0.12, H - 0.07], [-D / 2 + 0.002, -D / 2 + 0.006]);
  },

  sink({ k, W, H, D, M }) {
    // A stainless bowl dropped into the worktop, the tap at the back.
    const wall = 0.012;
    k.span(M.stainless, [-W / 2, W / 2], [0, wall], [-D / 2, D / 2]);
    k.span(M.stainless, [-W / 2, -W / 2 + wall], [0, H], [-D / 2, D / 2]);
    k.span(M.stainless, [W / 2 - wall, W / 2], [0, H], [-D / 2, D / 2]);
    k.span(M.stainless, [-W / 2, W / 2], [0, H], [-D / 2, -D / 2 + wall]);
    k.span(M.stainless, [-W / 2, W / 2], [0, H], [D / 2 - wall, D / 2]);
    k.span(M.stainless, [-W / 2 - 0.015, W / 2 + 0.015], [H - 0.004, H + 0.002], [-D / 2 - 0.015, -D / 2]); // front rim
    k.cyl(M._shadow, [0, wall + 0.001, 0], 0.03, 0.03, 0.002, 16);
    const tapZ = D / 2 + 0.03, tapTop = H + 0.3;
    k.cyl(M.stainless, [0, (H + tapTop) / 2, tapZ], 0.018, 0.022, tapTop - H, 16);
    k.cyl(M.stainless, [0, tapTop, tapZ - 0.1], 0.012, 0.012, 0.2, 12, [Math.PI / 2, 0, 0]);
    k.box(M.stainless, [0.04, tapTop - 0.02, tapZ], [0.08, 0.012, 0.02]);
  },

  island({ k, W, H, D, M, item, planToLocal }) {
    // Cupboards on the kitchen side, worktop over base and overhang.
    const top = H - 0.03;
    const a = planToLocal(item.base.x[0], (item.y[0] + item.y[1]) / 2).z, b = planToLocal(item.base.x[1], (item.y[0] + item.y[1]) / 2).z;
    const [z0, z1] = [Math.min(a, b), Math.max(a, b)];
    k.span(M.cabinet_white, [-W / 2, W / 2], [0.1, top], [z0 + T, z1]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.1], [z0 + 0.06, z1 - 0.02]);
    cabinetFronts(k, M, { x0: -W / 2, x1: W / 2, y0: 0.1, y1: top, z: z0 + T, mat: M.cabinet_white });
    k.span(M.counter_grey, [-W / 2 - 0.02, W / 2 + 0.02], [top, H], [-D / 2 - 0.02, D / 2 + 0.02]);
  },

  bar_stool({ k, H, M }) {
    k.cyl(M.seat_grey, [0, H - 0.03, 0], 0.18, 0.17, 0.06, 24);
    k.cyl(M.black_metal, [0, H - 0.07, 0], 0.16, 0.16, 0.02, 24);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      k.cyl(M.black_metal, [Math.sin(a) * 0.15, (H - 0.08) / 2, Math.cos(a) * 0.15], 0.012, 0.012, H - 0.08, 8, [Math.cos(a) * 0.08, 0, -Math.sin(a) * 0.08]);
    }
    k.cyl(M.black_metal, [0, 0.25, 0], 0.17, 0.17, 0.015, 24);
  },

  media_unit({ k, W, H, D, M }) {
    k.span(M.furniture_white, [-W / 2, W / 2], [0.05, H], [-D / 2 + T, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.03, W / 2 - 0.03], [0, 0.05], [-D / 2 + 0.05, D / 2 - 0.02]);
    for (let i = 0; i < 3; i++) k.span(M.furniture_white, [-W / 2 + (W * i) / 3 + GAP, -W / 2 + (W * (i + 1)) / 3 - GAP], [0.05 + GAP, H - GAP], [-D / 2, -D / 2 + T]);
  },

  tv_55({ k, W, H, D, M, item, planToLocal }) {
    k.span(M.black_glass, [-W / 2, W / 2], [0, H], [-D / 2 + 0.01, D / 2]);
    k.span(M._screen, [-W / 2 + 0.012, W / 2 - 0.012], [0.012, H - 0.012], [-D / 2 + 0.008, -D / 2 + 0.01]);
    if (item.stand) {
      // The pedestal, from its own footprint in house.json.
      const s = item.stand, c = planToLocal((s.x[0] + s.x[1]) / 2, (s.y[0] + s.y[1]) / 2, s.z[0]);
      k.box(M.black_matte, [c.x, c.y + (s.z[1] - s.z[0]) / 2, c.z], [s.x[1] - s.x[0], s.z[1] - s.z[0], s.y[1] - s.y[0]]);
      k.box(M.black_matte, [c.x, (c.y + 0.1) / 2, D / 2 - 0.005], [0.06, 0.2, 0.01]);
    }
  },

  game_console({ k, W, H, D, M }) {
    k.span(M.plastic_white, [-W / 2, -W * 0.12], [0, H], [-D / 2, D / 2]);
    k.span(M.plastic_white, [W * 0.12, W / 2], [0, H], [-D / 2, D / 2]);
    k.span(M.black_glass, [-W * 0.12, W * 0.12], [0.01, H - 0.02], [-D / 2 + 0.01, D / 2 - 0.01]);
  },

  game_controllers({ k, W, D, M, item }) {
    const n = item.count ?? 2;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / n;
      k.box(M.plastic_white, [x, 0.02, 0], [0.11, 0.035, 0.05], [0, 0.2 * (i ? 1 : -1), 0]);
      for (const s of [-1, 1]) k.sphere(M.plastic_white, [x + s * 0.05, 0.02, 0.02], 0.025, [1, 0.8, 1.4]);
    }
  },

  game_cases({ k, W, D, M, item, house }) {
    const n = item.count ?? 3, cols = house.art.recordSleeveColours;
    for (let i = 0; i < n; i++) k.box(tinted(M, "plastic_white", cols[(i * 3 + 1) % cols.length]), [0.005 * i, 0.007 + i * 0.015, 0.004 * i], [Math.min(W, 0.135), 0.014, Math.min(D, 0.17)], [0, 0.06 * i, 0]);
  },

  couch_3seat({ k, W, H, D, M, item, planToLocal, house }) {
    const arm = 0.18, seatH = item.seatHeight ?? 0.45, backT = 0.2;
    const fabric = M.couch_bluegreen;
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.box(M._wood_dark, [x * (W / 2 - 0.06), 0.04, z * (D / 2 - 0.06)], [0.04, 0.08, 0.04]);
    k.span(fabric, [-W / 2, W / 2], [0.08, seatH - 0.12], [-D / 2, D / 2]); // base
    k.span(fabric, [-W / 2 + arm, W / 2 - arm], [seatH - 0.12, H], [D / 2 - backT, D / 2]); // back frame
    for (const s of [-1, 1]) k.span(fabric, s < 0 ? [-W / 2, -W / 2 + arm] : [W / 2 - arm, W / 2], [0.08, seatH + 0.17], [-D / 2, D / 2]); // arms
    // Michael's end (the notes name its plan x): the worn cushion, flatter and a touch paler.
    const wornX = parseFloat(String(item.wornEnd ?? "").match(/x = ([\d.]+)/)?.[1] ?? NaN);
    const wornSide = Number.isFinite(wornX) ? Math.sign(planToLocal(wornX, (item.y[0] + item.y[1]) / 2).x) : 0;
    const seatW = (W - 2 * arm) / 3;
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + arm + seatW * (i + 0.5);
      const worn = wornSide !== 0 && Math.sign(x) === wornSide && Math.abs(x) > seatW / 2;
      const mat = worn ? tinted(M, "couch_bluegreen", item.wornColour ?? house.materials.couch_bluegreen.colour) : fabric;
      k.span(mat, [x - seatW / 2 + 0.005, x + seatW / 2 - 0.005], [seatH - 0.12, seatH - (worn ? 0.025 : 0)], [-D / 2 + 0.02, D / 2 - backT]);
      k.box(fabric, [x, seatH + 0.17, D / 2 - backT - 0.07], [seatW - 0.02, 0.36, 0.16], [-0.18, 0, 0]); // loose back cushions
    }
  },

  low_shelf({ k, W, H, D, M }) {
    // Open cubbies facing front, where the records stand.
    const t = 0.018;
    k.span(M.furniture_white, [-W / 2, W / 2], [H - t, H], [-D / 2, D / 2]);
    k.span(M.furniture_white, [-W / 2, W / 2], [0.04, 0.04 + t], [-D / 2, D / 2]);
    k.span(M.furniture_white, [-W / 2, W / 2], [H / 2, H / 2 + t], [-D / 2, D / 2]);
    for (const x of [-W / 2, -t / 2, W / 2 - t]) k.span(M.furniture_white, [x, x + t], [0.04, H], [-D / 2, D / 2]);
    k.span(M.furniture_white, [-W / 2, W / 2], [0.04, H], [D / 2 - 0.006, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.04], [-D / 2 + 0.03, D / 2 - 0.02]);
  },

  turntable({ k, W, H, D, M }) {
    k.span(M.furniture_white, [-W / 2, W / 2], [0, 0.07], [-D / 2, D / 2]);
    k.cyl(M.black_matte, [-W * 0.08, 0.075, 0], 0.15, 0.15, 0.01, 40);
    k.cyl(M._vinyl, [-W * 0.08, 0.082, 0], 0.148, 0.148, 0.003, 40); // the one record on the platter
    k.cyl(M._label, [-W * 0.08, 0.084, 0], 0.045, 0.045, 0.002, 24);
    k.box(M.stainless, [W * 0.3, 0.09, -D * 0.05], [0.012, 0.012, 0.22], [0, 0.35, 0]); // tonearm
    k.cyl(M.stainless, [W * 0.32, 0.08, D * 0.25], 0.02, 0.02, 0.02, 12);
    k.span(M._clear, [-W / 2, W / 2], [0.07, H], [-D / 2, D / 2]); // dust lid, closed
  },

  speaker({ k, W, H, D, M }) {
    k.span(M.black_matte, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
    k.cyl(M._rubber, [0, H * 0.35, -D / 2 - 0.002], Math.min(W, H) * 0.3, Math.min(W, H) * 0.3, 0.006, 20, [Math.PI / 2, 0, 0]);
    k.cyl(M._rubber, [0, H * 0.78, -D / 2 - 0.002], Math.min(W, H) * 0.12, Math.min(W, H) * 0.12, 0.006, 16, [Math.PI / 2, 0, 0]);
  },

  records({ k, W, H, D, M, item, state, house }) {
    // Eight sleeves standing in their shop wrap; in state A a new one stands at the front.
    const n = item.count ?? 8, cols = house.art.recordSleeveColours;
    const thick = Math.max(0.003, W / (n + 1));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + thick * (i + 0.5);
      k.box(tinted(M, "paper", cols[i % cols.length]), [x, H / 2, 0], [thick * 0.9, H, Math.min(D, 0.315)], [0, 0, (i % 3 - 1) * 0.01]);
    }
    if (state === "A") k.box(tinted(M, "paper", cols[(n + 2) % cols.length]), [-W / 2 - 0.004, H / 2, 0], [0.004, H, Math.min(D, 0.315)], [0, 0, -0.04]);
  },

  convector_heater({ k, W, H, D, M }) {
    k.span(M.grille_grey, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },

  paper_sheets({ k, W, D, M, item }) {
    // Handwritten sheets laid edge to edge, a few out of line.
    const sw = 0.21, sd = 0.297, cols = Math.max(1, Math.floor(W / sw)), rows = Math.max(1, Math.floor(D / sd));
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -W / 2 + sw * (c + 0.5) + (cols * sw < W ? (W - cols * sw) / 2 : 0), z = -D / 2 + sd * (r + 0.5);
      k.box(M.pages_written, [x, 0.001 + (i % 3) * 0.0006, z], [sw * 0.98, 0.0008, sd * 0.98], [0, ((i * 37) % 7 - 3) * 0.012, 0]);
      i++;
    }
    if (cols * rows === 0) k.box(M.pages_written, [0, 0.001, 0], [W, 0.001, D]);
  },

  pill_strip({ k, W, D, M }) {
    k.box(M.stainless, [0, 0.001, 0], [W, 0.002, D]);
    for (let i = 0; i < 5; i++) k.cyl(M._clear, [0, 0.003, -D / 2 + (D * (i + 0.5)) / 5], 0.006, 0.006, 0.003, 10);
  },

  mug({ k, W, H, M }) {
    const r = W * 0.42;
    k.cyl(M.porcelain_white, [0, H / 2, 0], r, r * 0.95, H, 20);
    k.cyl(M._wood_dark, [0, H - 0.012, 0], r * 0.9, r * 0.9, 0.002, 20); // the skin
    k.box(M.porcelain_white, [r + 0.012, H * 0.55, 0], [0.012, H * 0.5, 0.01]);
  },

  boxes_open({ k, W, H, D, M, item }) {
    const n = item.count ?? 3, bw = W / n;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + bw * (i + 0.5), h = H * (0.75 + 0.25 * ((i * 5) % 3) / 2), w = bw * 0.92, d = D * (0.8 + 0.1 * (i % 2));
      for (const [px, pz, sx, sz] of [[x - w / 2, 0, 0.006, d], [x + w / 2, 0, 0.006, d], [x, -d / 2, w, 0.006], [x, d / 2, w, 0.006]]) k.box(M.cardboard, [px, h / 2, pz], [sx, h, sz]);
      k.box(M.cardboard, [x, 0.003, 0], [w, 0.006, d]);
      k.box(M.cardboard, [x, h + 0.06, -d / 2 - 0.06], [w, 0.006, 0.18], [1.1, 0, 0]); // flaps up
      k.box(M.cardboard, [x, h + 0.06, d / 2 + 0.06], [w, 0.006, 0.18], [-1.1, 0, 0]);
    }
  },

  box({ k, W, H, D, M, item, house }) {
    const mat = M[item.material] ?? M.cardboard;
    k.span(mat, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
    if (item.material === "cardboard") k.span(M._label, [-0.03, 0.03], [H, H + 0.002], [-D / 2, D / 2]); // tape
    else k.span(tinted(M, "paper", house.art.boxLabelColour), [-W / 2, W / 2], [H * 0.3, H * 0.7], [-D / 2 - 0.001, -D / 2]); // label band
  },

  shelf({ k, W, H, D, M }) {
    k.span(M.furniture_white, [-W / 2, W / 2], [0, Math.max(H, 0.018)], [-D / 2, D / 2]);
  },

  rail({ k, W, H, D, M }) {
    const len = Math.max(W, D), alongX = W >= D;
    k.cyl(M.stainless, [0, H / 2, 0], 0.012, 0.012, len, 12, alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]);
  },

  hanging_clothes({ k, W, H, D, M, item, house }) {
    // A row of garments on hangers, in the few dark colours the notes give her.
    const tones = house.art.garmentTones;
    const n = Math.max(3, Math.round(W / (house.art.garmentSpacing ?? 0.1)));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / n, len = H * (0.75 + 0.25 * (((i * 7) % 5) / 4));
      k.box(M.plastic_white, [x, H - 0.02, 0], [0.012, 0.03, D * 0.8], [0.1, 0, 0]);
      k.box(tinted(M, "fabric_dark", tones[i % tones.length]), [x, H - 0.04 - len / 2, 0], [0.025, len, D * (0.85 + 0.1 * (i % 2))]);
    }
  },

  bare_hangers({ k, W, H, D, M }) {
    const n = Math.max(3, Math.round(W / 0.08));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (W * (i + 0.5)) / n;
      k.box(M.plastic_white, [x, H - 0.03, -D * 0.2], [0.008, 0.008, D * 0.45], [0.45, 0, 0]);
      k.box(M.plastic_white, [x, H - 0.03, D * 0.2], [0.008, 0.008, D * 0.45], [-0.45, 0, 0]);
      k.box(M.plastic_white, [x, H - 0.11, 0], [0.008, 0.008, D * 0.8]);
    }
  },

  coat({ k, W, H, D, M }) {
    k.box(M.fabric_dark, [0, H / 2, 0], [W * 0.9, H, D * 0.6]);
    k.box(M.fabric_dark, [0, H - 0.05, 0], [W, 0.1, D * 0.8]);
    k.box(M.plastic_white, [0, H + 0.02, 0], [W * 0.8, 0.02, 0.012]);
  },

  shoes({ k, W, D, M }) {
    shoeShape(k, M, -W * 0.22, 0, Math.min(D, 0.27), 1);
    shoeShape(k, M, W * 0.22, 0.02, Math.min(D, 0.27), 1);
  },

  bath({ k, W, H, D, M }) {
    // An open-topped tub: walls, floor and a rolled rim.
    const t = 0.07;
    k.span(M.porcelain_white, [-W / 2, W / 2], [0, 0.06], [-D / 2, D / 2]);
    k.span(M.porcelain_white, [-W / 2, W / 2], [0, H], [-D / 2, -D / 2 + t]);
    k.span(M.porcelain_white, [-W / 2, W / 2], [0, H], [D / 2 - t, D / 2]);
    k.span(M.porcelain_white, [-W / 2, -W / 2 + t], [0, H], [-D / 2, D / 2]);
    k.span(M.porcelain_white, [W / 2 - t, W / 2], [0, H], [-D / 2, D / 2]);
    k.span(M.porcelain_white, [-W / 2 + t, W / 2 - t], [0.06, 0.12], [-D / 2 + t, D / 2 - t]);
    k.cyl(M.stainless, [-W / 2 + 0.16, 0.121, 0], 0.025, 0.025, 0.003, 16); // drain
  },

  ledge({ k, W, H, D, M }) {
    k.span(M.tile_grey, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },

  shower_head({ k, W, H, D, M }) {
    k.cyl(M.stainless, [0, H / 2, 0], Math.min(W, D) * 0.45, Math.min(W, D) * 0.45, 0.02, 20, [0.6, 0, 0]);
    k.cyl(M.stainless, [0, H / 2 + 0.01, D / 2], 0.01, 0.01, D, 8, [Math.PI / 2, 0, 0]);
  },

  mixer_lever({ k, W, H, D, M }) {
    k.cyl(M.stainless, [0, H / 2, D / 2 - 0.005], 0.035, 0.035, 0.01, 20, [Math.PI / 2, 0, 0]);
    k.box(M.stainless, [0, H / 2 + 0.02, D / 2 - 0.04], [0.015, 0.015, 0.07], [0.3, 0, 0]);
  },

  shower_curtain({ k, W, H, D, M }) {
    k.cyl(M.stainless, [0, H - 0.01, 0], 0.01, 0.01, W, 10, [0, 0, Math.PI / 2]);
    const g = pleatGeometry(W, H - 0.04, Math.round(W / 0.1), 0.025);
    k.geom(g, M.sheet_white, [0, (H - 0.04) / 2, 0], [0, 0, 0], [1, 1, 1], [W, H]);
    g.dispose();
  },

  toilet({ k, W, H, D, M }) {
    k.span(M.porcelain_white, [-W * 0.42, W * 0.42], [0.36, H], [D / 2 - 0.17, D / 2]); // cistern
    k.span(M.porcelain_white, [-W * 0.45, W * 0.45], [H - 0.02, H], [D / 2 - 0.19, D / 2]);
    k.cyl(M.porcelain_white, [0, 0.19, -D * 0.05], W * 0.28, W * 0.22, 0.38, 20); // pedestal
    k.sphere(M.porcelain_white, [0, 0.36, -D * 0.05], 1, [W * 0.45, 0.06, D * 0.42]);
    k.sphere(M.plastic_white, [0, 0.42, -D * 0.05], 1, [W * 0.46, 0.02, D * 0.43]); // seat
  },

  vanity({ k, W, H, D, M }) {
    k.span(M.cabinet_white, [-W / 2, W / 2], [0.1, H - 0.03], [-D / 2 + T, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.1], [-D / 2 + 0.05, D / 2]);
    cabinetFronts(k, M, { x0: -W / 2, x1: W / 2, y0: 0.1, y1: H - 0.03, z: -D / 2 + T, mat: M.cabinet_white, count: 1 });
    k.span(M.counter_grey, [-W / 2, W / 2], [H - 0.03, H], [-D / 2, D / 2]);
    k.sphere(M.porcelain_white, [0, H + 0.002, -D * 0.05], 1, [W * 0.32, 0.035, D * 0.33]); // basin
    k.cyl(M._shadow, [0, H + 0.004, -D * 0.05], 0.02, 0.02, 0.003, 12);
    k.cyl(M.stainless, [0, H + 0.1, D / 2 - 0.08], 0.015, 0.018, 0.2, 12);
    k.cyl(M.stainless, [0, H + 0.19, D / 2 - 0.13], 0.01, 0.01, 0.1, 10, [Math.PI / 2, 0, 0]);
  },

  mirror_cabinet({ k, W, H, D, M }) {
    k.span(M.cabinet_white, [-W / 2, W / 2], [0, H], [-D / 2 + 0.01, D / 2]);
    k.span(M.mirror, [-W / 2 + 0.005, W / 2 - 0.005], [0.005, H - 0.005], [-D / 2, -D / 2 + 0.01]);
  },

  towel_rail({ k, W, H, D, M }) {
    k.cyl(M.stainless, [0, H - 0.02, 0], 0.01, 0.01, W, 10, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) k.box(M.towel_grey, [s * W * 0.23, H - 0.32, -0.005], [W * 0.44, 0.6, 0.02]);
  },

  extractor_fan({ k, W, H, D, M }) {
    k.span(M.plastic_white, [-W / 2, W / 2], [H / 2, H], [-D / 2, D / 2]);
    k.span(M.grille_grey, [-W / 2 + 0.02, W / 2 - 0.02], [H / 2 - 0.002, H / 2], [-D / 2 + 0.02, D / 2 - 0.02]);
  },

  drawer_unit({ k, W, H, D, M, item }) {
    const n = item.drawers ?? 4;
    k.span(M.furniture_white, [-W / 2, W / 2], [0.04, H], [-D / 2 + T, D / 2]);
    k.span(M._shadow, [-W / 2 + 0.02, W / 2 - 0.02], [0, 0.04], [-D / 2 + 0.04, D / 2]);
    for (let i = 0; i < n; i++) {
      const y0 = 0.04 + ((H - 0.04) * i) / n, y1 = 0.04 + ((H - 0.04) * (i + 1)) / n;
      k.span(M.furniture_white, [-W / 2 + GAP, W / 2 - GAP], [y0 + GAP, y1 - GAP], [-D / 2, -D / 2 + T]);
      k.box(M.stainless, [0, (y0 + y1) / 2, -D / 2 - 0.01], [0.16, 0.012, 0.012]);
    }
  },

  ribbon({ k, W, D, M }) {
    k.box(M.sheet_white, [0, 0.002, 0], [W, 0.003, 0.025], [0, 0.4, 0]);
    k.box(M.sheet_white, [W * 0.1, 0.004, 0.02], [W * 0.7, 0.003, 0.025], [0, -0.7, 0]);
  },

  phone({ k, W, H, D, M }) {
    k.span(M.black_glass, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },

  keyboard({ k, W, H, D, M }) {
    k.span(M.black_matte, [-W / 2, W / 2], [0, H * 0.5], [-D / 2, D / 2]);
    for (let r = 0; r < 4; r++) k.span(M._rubber, [-W / 2 + 0.01, W / 2 - 0.01], [H * 0.5, H], [-D / 2 + 0.012 + r * (D - 0.024) / 4, -D / 2 + 0.012 + (r + 0.8) * (D - 0.024) / 4]);
  },

  laptop({ k, W, H, D, M, state }) {
    // Open on the desk; shut on her knees in state B (the notes have it there).
    k.span(M.black_matte, [-W / 2, W / 2], [0, 0.015], [-D / 2, D / 2]);
    if (state !== "B") k.box(M.black_matte, [0, 0.13, D / 2 + 0.02], [W, 0.24, 0.008], [-0.2, 0, 0]);
    else k.span(M.black_matte, [-W / 2, W / 2], [0.015, 0.025], [-D / 2, D / 2]);
  },

  monitor({ k, W, H, D, M }) {
    const panelH = H * 0.7;
    k.box(M.black_matte, [0, H - panelH / 2, -D * 0.1], [W, panelH, 0.025]);
    k.box(M._screen, [0, H - panelH / 2, -D * 0.1 - 0.013], [W - 0.02, panelH - 0.02, 0.002]);
    k.box(M.black_matte, [0, (H - panelH) / 2 + 0.01, D * 0.15], [0.04, H - panelH + 0.02, 0.03]);
    k.box(M.black_matte, [0, 0.006, D * 0.1], [0.2, 0.012, Math.min(D, 0.16)]);
  },

  climate_panel({ k, W, H, D, M }) {
    k.span(M.plastic_white, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },

  grille({ k, W, H, D, M }) {
    k.span(M.grille_grey, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },

  thermostat({ k, W, H, D, M }) {
    k.span(M.plastic_white, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
    k.span(M._screen, [-W * 0.3, W * 0.3], [H * 0.45, H * 0.8], [-D / 2 - 0.001, -D / 2]);
  },

  door_panel({ k, W, H, D, M }) {
    // Glass reader, keypad, intercom grille; the status light comes from the door builder.
    k.span(M.plastic_white, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
    k.span(M.black_glass, [-W * 0.38, W * 0.38], [H * 0.72, H * 0.93], [-D / 2 - 0.002, -D / 2]);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) k.box(M._rubber, [(c - 1) * W * 0.25, H * (0.32 + r * 0.09), -D / 2 - 0.002], [W * 0.18, H * 0.06, 0.003]);
    k.span(M.grille_grey, [-W * 0.35, W * 0.35], [H * 0.06, H * 0.2], [-D / 2 - 0.002, -D / 2]);
  },

  drying_rack({ k, W, H, D, M, item, state }) {
    k.span(M.stainless, [-W / 2, W / 2], [0, 0.01], [-D / 2, D / 2]);
    const n = Math.round(W / 0.03);
    for (let i = 0; i <= n; i++) k.box(M.stainless, [-W / 2 + (W * i) / n, H * 0.5, 0], [0.003, H, 0.003]);
    for (const s of [-1, 1]) k.box(M.stainless, [0, H, s * D * 0.3], [W, 0.004, 0.004]);
    if (item.contentsByState?.[state]?.length) k.cyl(M.porcelain_white, [0, H * 0.55, 0], 0.12, 0.12, 0.012, 24, [Math.PI / 2, Math.PI / 2, 0]); // one plate, dry
  },

  kettle({ k, W, H, D, M }) {
    const r = Math.min(W, D) * 0.42;
    k.cyl(M.plastic_white, [0, 0.01, 0], r * 1.05, r * 1.05, 0.02, 20);
    k.cyl(M.plastic_white, [0, H * 0.5, 0], r * 0.85, r, H * 0.8, 20);
    k.cyl(M.plastic_white, [0, H * 0.92, 0], r * 0.6, r * 0.85, H * 0.08, 20);
    k.box(M.plastic_white, [0, H * 0.55, r + 0.02], [0.025, H * 0.65, 0.03]);
    k.box(M.plastic_white, [0, H * 0.82, -r - 0.02], [0.02, 0.03, 0.05], [0.4, 0, 0]); // spout
  },

  keys({ k, W, D, M }) {
    k.cyl(M.stainless, [0, 0.003, 0], 0.015, 0.015, 0.003, 16);
    k.box(M.black_matte, [W * 0.25, 0.006, 0], [0.035, 0.01, 0.025]); // building fob
    k.box(M.stainless, [-W * 0.25, 0.002, 0.005], [0.05, 0.002, 0.012], [0, 0.4, 0]); // mailbox key
  },

  sign({ k, W, H, D, M }) {
    k.span(M.stainless, [-W / 2, W / 2], [0, H], [-D / 2, D / 2]);
  },
};
