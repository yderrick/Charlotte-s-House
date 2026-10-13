// Draws a top-down floor plan (floorplan.svg) from house.json.
// Usage: node tools/floorplan.mjs [state]   (default state A; the D-F desk is drawn dashed)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadHouse, solidPieces, pieceRect, placement, roomsById, hingedDoorGeom, wallFrame, pointOnWall, sunPosition, planDirFromBearing } from "./lib.mjs";

const house = loadHouse();
const state = process.argv[2] ?? house.states.default;
const floor = house.floors[0];
const rooms = roomsById(floor);
const walls = Object.fromEntries(floor.walls.map((w) => [w.id, w]));

const S = 80; // pixels per metre
const view = { x0: -1.3, x1: 9.3, y0: -2.4, y1: 12.9 }; // plan metres shown
const W = (view.x1 - view.x0) * S, H = (view.y1 - view.y0) * S;
const X = (x) => +((x - view.x0) * S).toFixed(1);
const Y = (y) => +((view.y1 - y) * S).toFixed(1); // windows at the top
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const rect = (r, attrs) => `<rect x="${X(r.x[0])}" y="${Y(r.y[1])}" width="${((r.x[1] - r.x[0]) * S).toFixed(1)}" height="${((r.y[1] - r.y[0]) * S).toFixed(1)}" ${attrs}/>`;
const text = (x, y, s, attrs = "") => `<text x="${X(x)}" y="${Y(y)}" ${attrs}>${esc(s)}</text>`;

const roomFill = { hall: "#EEF0F2", bathroom: "#DCE8EE", laundry: "#ECE7DD", coat: "#ECE7DD", walkin: "#E9E4EE", bedroom: "#E7E5F0", main: "#F4F3EE", corridor: "#D9D9DB" };
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`);
out.push(`<style>text { paint-order: stroke; stroke: #FFFFFF; stroke-width: 3px; stroke-linejoin: round; }</style>`);
out.push(`<rect width="100%" height="100%" fill="#FFFFFF"/>`);

// Rooms
for (const r of floor.rooms) {
  out.push(rect(r, `fill="${roomFill[r.id] ?? "#F2F2F2"}" stroke="none"`));
}
// Zones in the main room (dotted)
for (const z of rooms.main.zones ?? []) out.push(rect(z, `fill="none" stroke="#B8B5AA" stroke-width="1" stroke-dasharray="2 4"`));

// Metre grid ticks around the unit
for (let x = 0; x <= 6.5 + 1e-9; x += 0.5) out.push(`<line x1="${X(x)}" y1="${Y(10.35)}" x2="${X(x)}" y2="${Y(x % 1 ? 10.28 : 10.22)}" stroke="#888"/>` + (x % 1 ? "" : text(x, 10.45, x.toFixed(0), `font-size="11" text-anchor="middle" fill="#666"`)));
for (let y = 0; y <= 10 + 1e-9; y += 0.5) out.push(`<line x1="${X(6.85)}" y1="${Y(y)}" x2="${X(y % 1 ? 6.78 : 6.72)}" y2="${Y(y)}" stroke="#888"/>` + (y % 1 ? "" : text(6.92, y - 0.05, y.toFixed(0), `font-size="11" fill="#666"`)));
out.push(text(-0.75, 10.45, "x (m)", `font-size="11" text-anchor="middle" fill="#666"`));
out.push(text(7.15, 10.0, "y (m)", `font-size="11" fill="#666"`));

// Furniture
const solidTypes = new Set(["bed_queen", "bedside_table", "desk", "task_chair", "fridge", "base_cabinets", "range", "island", "bar_stool", "media_unit", "couch_3seat", "low_shelf", "washer_dryer_stack", "bath", "ledge", "toilet", "vanity", "drawer_unit", "convector_heater", "boxes_open", "sink", "upper_cabinets", "tv_55", "turntable", "records", "shelf", "rail", "microwave"]);
const labels = { bed_queen: "bed", bedside_table: "bedside", desk: "desk", task_chair: "chair", fridge: "fridge", range: "range", island: "island", bar_stool: "stool", media_unit: "media unit + TV", couch_3seat: "couch", low_shelf: "records", washer_dryer_stack: "W/D", bath: "bath", toilet: "WC", vanity: "vanity", drawer_unit: "drawers", convector_heater: "", sink: "sink" };
function drawItem(p, style) {
  if (p.type === "upper_cabinets" || p.type === "microwave") return out.push(rect(p, `fill="none" stroke="#9A9A9A" stroke-width="1" stroke-dasharray="5 3"`));
  if (p.type === "rail") return out.push(rect(p, `fill="#777" stroke="none"`));
  if (p.type === "shelf") return out.push(rect(p, `fill="none" stroke="#9A9A9A" stroke-width="1" stroke-dasharray="1 3"`));
  out.push(rect(p, style));
  // Front marker: a short tick on the side the object faces
  const cx = (p.x[0] + p.x[1]) / 2, cy = (p.y[0] + p.y[1]) / 2;
  const r = ((p.rotationDeg ?? 0) * Math.PI) / 180, fx = -Math.sin(r), fy = Math.cos(r);
  const hx = (p.x[1] - p.x[0]) / 2, hy = (p.y[1] - p.y[0]) / 2;
  if (["couch_3seat", "bed_queen", "task_chair", "bar_stool", "toilet", "fridge", "range", "media_unit", "low_shelf", "desk", "vanity", "drawer_unit", "washer_dryer_stack"].includes(p.type)) {
    const ex = cx + fx * hx * 0.85, ey = cy + fy * hy * 0.85;
    out.push(`<circle cx="${X(ex)}" cy="${Y(ey)}" r="2.5" fill="#555"/>`);
  }
  const lab = labels[p.type];
  if (lab && (p.x[1] - p.x[0]) * S > 22) out.push(text(cx, cy - 0.04, lab, `font-size="10" text-anchor="middle" fill="#333"`));
}
for (const it of floor.furniture) {
  const p = placement(it, state);
  if (p && solidTypes.has(p.type)) {
    if (p.type === "island") {
      out.push(rect({ x: p.overhang.x, y: p.y }, `fill="#D9D7D0" stroke="#666" stroke-width="1" stroke-dasharray="3 2"`));
      drawItem({ ...p, x: p.base.x }, `fill="#CFCDC6" stroke="#555" stroke-width="1.2"`);
    } else drawItem(p, `fill="#D6D4CD" stroke="#555" stroke-width="1.2"`);
  }
}
// Items from other states that move or appear: drawn dashed for reference
const ghostStates = ["D"];
for (const it of floor.furniture) {
  if (placement(it, state)) continue;
  for (const st of ghostStates) {
    const p = placement(it, st);
    if (p && ["desk", "task_chair", "boxes_open"].includes(p.type)) {
      out.push(rect(p, `fill="none" stroke="#B04A2E" stroke-width="1.2" stroke-dasharray="4 3"`));
      out.push(text((p.x[0] + p.x[1]) / 2, (p.y[0] + p.y[1]) / 2 - 0.04, `${labels[p.type] ?? p.type} (${(it.states ?? []).join("")})`, `font-size="9" text-anchor="middle" fill="#B04A2E"`));
    }
  }
}

// Curtain track
const c = floor.curtains;
out.push(`<line x1="${X(c.track.x[0])}" y1="${Y(c.track.y)}" x2="${X(c.track.x[1])}" y2="${Y(c.track.y)}" stroke="#7A7C80" stroke-width="2" stroke-dasharray="8 3"/>`);

// Walls
for (const w of floor.walls) {
  if (w.kind === "glazing") {
    const r = pieceRect(w, { from: 0, to: wallFrame(w).len });
    out.push(rect(r, `fill="#CFE6F2" stroke="#1C1D1F" stroke-width="1"`));
    continue;
  }
  const fill = w.kind === "corridor" ? "#6B6B70" : w.kind === "exterior" ? "#2E2F33" : "#4A4B50";
  for (const piece of solidPieces(w, floor.doors)) out.push(rect(pieceRect(w, piece), `fill="${fill}" stroke="none"`));
}
// Window mullions
for (const win of floor.windows) {
  const w = walls[win.wall];
  for (const off of [win.offsetAlongWall, win.offsetAlongWall + win.width]) {
    const p = pointOnWall(w, off);
    out.push(`<line x1="${X(p[0])}" y1="${Y(w.a[1] - w.thickness / 2)}" x2="${X(p[0])}" y2="${Y(w.a[1] + w.thickness / 2)}" stroke="#1C1D1F" stroke-width="3"/>`);
  }
  if (win.vent) out.push(`<line x1="${X(win.vent.x[0])}" y1="${Y(w.a[1])}" x2="${X(win.vent.x[1])}" y2="${Y(w.a[1])}" stroke="#1C1D1F" stroke-width="2" stroke-dasharray="2 2"/>`);
}

// Doors
for (const d of floor.doors) {
  const w = walls[d.wall];
  if (d.type === "dummy") {
    const a = pointOnWall(w, d.offsetAlongWall), b = pointOnWall(w, d.offsetAlongWall + d.width);
    out.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="#A0A0A6" stroke-width="5"/>`);
    continue;
  }
  if (d.type === "opening") {
    const a = pointOnWall(w, d.offsetAlongWall), b = pointOnWall(w, d.offsetAlongWall + d.width);
    out.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="#888" stroke-width="1" stroke-dasharray="3 3"/>`);
    continue;
  }
  const g = hingedDoorGeom(w, d, rooms);
  const along = [(g.free[0] - g.hinge[0]) / d.width, (g.free[1] - g.hinge[1]) / d.width];
  if (d.type === "bifold") {
    // Folded open: two short leaves in a V into the hall
    const r = d.width / 2;
    const p1 = [g.hingeFace[0] + g.n[0] * r * 0.8 + along[0] * r * 0.5, g.hingeFace[1] + g.n[1] * r * 0.8 + along[1] * r * 0.5];
    const p2 = [g.hingeFace[0] + along[0] * r * 0.2, g.hingeFace[1] + along[1] * r * 0.2];
    out.push(`<polyline points="${X(g.hingeFace[0])},${Y(g.hingeFace[1])} ${X(p1[0])},${Y(p1[1])} ${X(p2[0])},${Y(p2[1])}" fill="none" stroke="#333" stroke-width="2"/>`);
    out.push(`<line x1="${X(g.hinge[0])}" y1="${Y(g.hinge[1])}" x2="${X(g.free[0])}" y2="${Y(g.free[1])}" stroke="#333" stroke-width="1" stroke-dasharray="2 2"/>`);
    continue;
  }
  // Hinged: leaf drawn open at 90 degrees, swing arc dashed
  const open = [g.hingeFace[0] + g.n[0] * d.width, g.hingeFace[1] + g.n[1] * d.width];
  out.push(`<line x1="${X(g.hingeFace[0])}" y1="${Y(g.hingeFace[1])}" x2="${X(open[0])}" y2="${Y(open[1])}" stroke="#222" stroke-width="2.5"/>`);
  const cross = along[0] * g.n[1] - along[1] * g.n[0]; // sweep direction in plan
  const sweep = cross > 0 ? 0 : 1; // SVG y is flipped
  out.push(`<path d="M ${X(g.freeFace[0])} ${Y(g.freeFace[1])} A ${d.width * S} ${d.width * S} 0 0 ${sweep} ${X(open[0])} ${Y(open[1])}" fill="none" stroke="#555" stroke-width="1" stroke-dasharray="4 3"/>`);
  out.push(`<circle cx="${X(g.hingeFace[0])}" cy="${Y(g.hingeFace[1])}" r="2.5" fill="#222"/>`);
}

// Lights and switches
for (const l of floor.lights) {
  const pos = l.position ?? l.byState?.[state]?.position;
  if (l.type === "under-cabinet") {
    out.push(`<line x1="${X(l.from[0])}" y1="${Y(l.from[1])}" x2="${X(l.to[0])}" y2="${Y(l.to[1])}" stroke="#E0A800" stroke-width="2.5" stroke-dasharray="1 3"/>`);
    continue;
  }
  if (!pos || l.type === "indicator" || l.type === "appliance") continue;
  const [x, y] = pos;
  if (l.type === "lamp") out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="#E0A800" stroke="#7A5C00"/>`);
  else out.push(`<g stroke="#B08400" stroke-width="1.2"><circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="#FFF3C4"/><line x1="${X(x) - 4}" y1="${Y(y) - 4}" x2="${X(x) + 4}" y2="${Y(y) + 4}"/><line x1="${X(x) - 4}" y1="${Y(y) + 4}" x2="${X(x) + 4}" y2="${Y(y) - 4}"/></g>`);
}
for (const s of floor.switches) out.push(`<rect x="${X(s.position[0]) - 3}" y="${Y(s.position[1]) - 3}" width="6" height="6" fill="#B08400"/>`);

// Room labels
const net = (r) => (r.inUnit && r.id !== "main" ? `${(r.x[1] - r.x[0]).toFixed(1)} x ${(r.y[1] - r.y[0]).toFixed(1)} m` : "");
const labelAt = { hall: [0.6, 2.2], bathroom: [2.3, 1.72], laundry: [1.6, 2.5], coat: [1.6, 3.55], walkin: [2.62, 2.75], bedroom: [4.9, 3.75], main: [4.6, 5.6], corridor: [4.5, -1.5] };
for (const r of floor.rooms) {
  const [lx, ly] = labelAt[r.id] ?? [(r.x[0] + r.x[1]) / 2, (r.y[0] + r.y[1]) / 2];
  const small = ["laundry", "coat", "walkin"].includes(r.id);
  const name = { main: "MAIN ROOM", corridor: "CORRIDOR (floor 21, common)", walkin: "walk-in", laundry: "laundry", coat: "coats" }[r.id] ?? r.name.toUpperCase();
  out.push(text(lx, ly, name, `font-size="${small ? 9 : 13}" font-weight="bold" text-anchor="middle" fill="#2B2B30"`));
  if (net(r) && !small) out.push(text(lx, ly - (r.id === "bathroom" ? 0.17 : 0.2), net(r), `font-size="10" text-anchor="middle" fill="#555"`));
}
out.push(text(1.55, 5.95, "kitchen", `font-size="10" text-anchor="middle" fill="#8A877C" font-style="italic"`));
out.push(text(4.8, 5.35, "living (5.6 x 6.5 m main room)", `font-size="10" text-anchor="middle" fill="#8A877C" font-style="italic"`));
out.push(text(4.8, 9.0, "window corner", `font-size="10" text-anchor="middle" fill="#8A877C" font-style="italic"`));
out.push(text(0.6, 0.35, "front door", `font-size="9" text-anchor="middle" fill="#333"`));
out.push(text(-0.65, 5.0, "neighbour", `font-size="10" text-anchor="middle" fill="#888" transform="rotate(-90 ${X(-0.65)} ${Y(5.0)})"`));
out.push(text(7.6, 5.0, "neighbour", `font-size="10" text-anchor="middle" fill="#888" transform="rotate(-90 ${X(7.6)} ${Y(5.0)})"`));
out.push(text(6.95, 10.62, "glass wall faces SE", `font-size="12" fill="#1C5A7A" font-weight="bold"`));
out.push(text(6.95, 10.42, "6 floor-to-ceiling panels", `font-size="10" fill="#1C5A7A"`));

// Compass: north arrow
const facing = house.site.facing.bearingDeg;
const [nx, ny] = planDirFromBearing(0, facing);
const cc = [8.3, 1.2], L = 0.6;
out.push(`<g><circle cx="${X(cc[0])}" cy="${Y(cc[1])}" r="${L * S}" fill="none" stroke="#999"/>`);
for (const [b, lab] of [[0, "N"], [90, "E"], [180, "S"], [270, "W"], [135, "SE"]]) {
  const [dx, dy] = planDirFromBearing(b, facing);
  const tip = [cc[0] + dx * L, cc[1] + dy * L], lp = [cc[0] + dx * (L + 0.2), cc[1] + dy * (L + 0.2) - 0.05];
  out.push(`<line x1="${X(cc[0])}" y1="${Y(cc[1])}" x2="${X(tip[0])}" y2="${Y(tip[1])}" stroke="${b === 0 ? "#B0302A" : "#888"}" stroke-width="${b === 0 ? 3 : 1}"/>`);
  out.push(text(lp[0], lp[1], lab, `font-size="${b === 0 ? 13 : 10}" font-weight="${b === 0 ? "bold" : "normal"}" text-anchor="middle" fill="${b === 0 ? "#B0302A" : "#666"}"`));
}
out.push(`</g>`);

// Sun rays through the glass on 18 Jun 2026 (clock time, EDT = UTC-4)
const { latitude, longitude } = house.site;
for (const hhmm of ["07:00", "09:00", "11:00", "13:00", "15:00"]) {
  const [h, m] = hhmm.split(":").map(Number);
  const s = sunPosition(Date.UTC(2026, 5, 18, h + 4, m), latitude, longitude);
  const [dx, dy] = planDirFromBearing(s.azimuth, facing); // direction toward the sun
  if (dy <= 0 || s.altitude <= 0) continue;
  const start = [3.25 + dx * 1.6, 10.15 + dy * 1.6], end = [3.25 + dx * 0.6, 10.15 + dy * 0.6];
  out.push(`<line x1="${X(start[0])}" y1="${Y(start[1])}" x2="${X(end[0])}" y2="${Y(end[1])}" stroke="#E08A00" stroke-width="1.5" marker-end="url(#arrow)"/>`);
  out.push(text(start[0] + dx * 0.15, start[1] + dy * 0.15, `${hhmm}`, `font-size="9" text-anchor="middle" fill="#B06A00"`));
}
out.push(text(3.25, 12.12, "sun on 18 Jun 2026 (clock time): low from the left in the morning, gone from the glass by about 15:45", `font-size="10" text-anchor="middle" fill="#B06A00"`));
out.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#E08A00"/></marker></defs>`);

// Title, legend, scale bar
out.push(`<text x="12" y="22" font-size="16" font-weight="bold" fill="#222">${esc(house.meta.name)} — state ${state}</text>`);
out.push(`<text x="12" y="40" font-size="11" fill="#555">Drawn from house.json by tools/floorplan.mjs. Inside box 6.5 x 10.0 m, ceiling 2.6 m, 65.0 m².</text>`);
const lg = [[7.05, 9.6, "dot = front of object"], [7.05, 9.35, "red dashed = desk, chair"], [7.05, 9.15, "   in states D-F"], [7.05, 8.9, "circled x = ceiling light"], [7.05, 8.65, "yellow dot = desk lamp"], [7.05, 8.4, "square = switch"], [7.05, 8.15, "dashed = cupboards above"], [7.05, 7.9, "grey dash line = curtain track"]];
for (const [x, y, s] of lg) out.push(text(x + 0.1, y, s, `font-size="10" fill="#444"`));
out.push(`<line x1="${X(7.4)}" y1="${Y(7.4)}" x2="${X(8.4)}" y2="${Y(7.4)}" stroke="#222" stroke-width="3"/>`);
out.push(text(7.9, 7.5, "1 m", `font-size="10" text-anchor="middle" fill="#222"`));
out.push(`</svg>`);

const file = join(ROOT, "floorplan.svg");
writeFileSync(file, out.join("\n"));
console.log(`wrote ${file} (state ${state})`);
