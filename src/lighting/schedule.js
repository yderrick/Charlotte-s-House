// Automatic lights: dusk and dawn for a date (from the real sun) and the level a
// schedule asks for at a time. Pure.
import { sunPosition } from "../time/astro.js";
import { localToUtcMs } from "../time/zone.js";
import { parseHHMM } from "../time/clock.js";

const cache = new Map();

// Minutes after local midnight when the sun crosses the twilight altitudes.
export function twilightMinutes(house, date) {
  const tw = house.indoorLighting.twilight;
  const key = `${date}:${tw.dawnSunAltitude}:${tw.duskSunAltitude}`;
  if (cache.has(key)) return cache.get(key);
  const { latitude, longitude, timeZone } = house.site;
  const alt = (m) => sunPosition(localToUtcMs(date, m, timeZone), latitude, longitude).altitude;
  let dawn = null, dusk = null, prev = alt(0);
  for (let m = 1; m <= 1440; m++) {
    const a = alt(m);
    if (dawn === null && prev < tw.dawnSunAltitude && a >= tw.dawnSunAltitude) dawn = m;
    if (prev >= tw.duskSunAltitude && a < tw.duskSunAltitude) dusk = m;
    prev = a;
  }
  const out = { dawn: dawn ?? 0, dusk: dusk ?? 1440 };
  cache.set(key, out);
  return out;
}

function resolve(when, tw) {
  if (when === "dusk") return tw.dusk;
  if (when === "dawn") return tw.dawn;
  return parseHHMM(when);
}

// The level (0..1) a schedule gives at `minutes`; periods may wrap past midnight.
export function scheduleLevel(schedule, minutes, tw) {
  for (const p of schedule.periods ?? []) {
    const a = resolve(p.from, tw), b = resolve(p.to, tw);
    const inside = a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
    if (inside) return p.level;
  }
  return schedule.default ?? 0;
}
