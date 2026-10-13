// Furniture from house.json as plain boxes for one story state.
// Each item becomes one or more boxes: { id, role: "furniture", solid, x, y, z, collide }.
// Pure data: used by the Three.js builder and the Node walk test.
import { placement } from "../data/geometry.js";

// Large pieces drawn in a darker grey; everything else is a small prop.
export const SOLID_TYPES = new Set(["bed_queen", "bedside_table", "desk", "task_chair", "fridge", "base_cabinets", "upper_cabinets", "range", "microwave", "island", "bar_stool", "media_unit", "tv_55", "couch_3seat", "low_shelf", "washer_dryer_stack", "bath", "ledge", "toilet", "vanity", "drawer_unit", "convector_heater", "boxes_open", "sink"]);

const MIN = 0.005; // keep paper-thin items visible
const BACKREST_DEPTH = 0.22; // seats with a seatHeight get a back on the side away from their front
const WORKTOP = 0.03; // island worktop thickness

export function furnitureBoxes(floor, state) {
  const all = [...floor.furniture, ...(floor.corridorProps ?? [])];
  const boxes = [];
  for (const item of all) {
    const p = placement(item, state);
    if (!p || !p.x || !p.y || !p.z) continue;
    const solid = SOLID_TYPES.has(p.type);
    const add = (suffix, x, y, z) => boxes.push({ id: suffix ? `${p.id}:${suffix}` : p.id, item: p.id, type: p.type, role: "furniture", solid, x: pad(x), y: pad(y), z: pad(z), collide: true });

    if (p.base && p.overhang) {
      // Island: cupboard base below the worktop, worktop over base and overhang
      add("base", p.base.x ?? p.x, p.base.y ?? p.y, [p.z[0], p.z[1] - WORKTOP]);
      add("top", p.x, p.y, [p.z[1] - WORKTOP, p.z[1]]);
      continue;
    }
    if (p.cutout) {
      // Counter run with a sink dropped into it: full cupboards either side, short cupboard under the sink
      const sink = all.find((s) => s.id === p.cutout.for);
      const under = sink ? sink.z[0] : p.z[1];
      const [c0, c1] = p.cutout.y;
      if (c0 > p.y[0]) add("a", p.x, [p.y[0], c0], p.z);
      add("under", p.x, [c0, c1], [p.z[0], under]);
      if (p.y[1] > c1) add("b", p.x, [c1, p.y[1]], p.z);
      continue;
    }
    if (p.seatHeight) {
      add("seat", p.x, p.y, [p.z[0], p.seatHeight]);
      add("back", ...backrest(p), [p.seatHeight, p.z[1]]);
      continue;
    }
    add("", p.x, p.y, p.z);
    if (p.headboard) add("headboard", p.headboard.x ?? p.x, p.headboard.y ?? p.y, p.headboard.z);
    if (p.stand) add("stand", p.stand.x, p.stand.y, p.stand.z);
  }
  return boxes;
}

// Strip along the side opposite the item's front (rotationDeg 0 = front faces +y).
function backrest(p) {
  const r = (((p.rotationDeg ?? 0) % 360) + 360) % 360;
  const d = BACKREST_DEPTH;
  if (r === 0) return [p.x, [p.y[0], p.y[0] + d]];
  if (r === 180) return [p.x, [p.y[1] - d, p.y[1]]];
  if (r === 90) return [[p.x[1] - d, p.x[1]], p.y];
  return [[p.x[0], p.x[0] + d], p.y];
}

function pad([a, b]) {
  return b - a >= MIN ? [a, b] : [a, a + MIN];
}
