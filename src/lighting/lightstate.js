// Which indoor lights are on, how bright, and which switch (or lamp) works which
// lights. Pure: the Three.js fixtures read it every frame.
import { scheduleLevel, twilightMinutes } from "./schedule.js";

export function emittingLights(floor, state) {
  return floor.lights
    .filter((l) => l.emit)
    .map((l) => (l.byState ? { ...l, ...l.byState[state], byState: undefined } : l))
    .filter((l) => l.position || l.from);
}

export function createLightState(house, state, start) {
  const floor = house.floors[0];
  const cfg = house.indoorLighting;
  const lights = emittingLights(floor, state);
  const byId = Object.fromEntries(lights.map((l) => [l.id, l]));

  // Switch (or switch gang, or lamp) id -> light ids
  const controls = {};
  for (const s of floor.switches ?? []) {
    if (s.gangs) for (const g of s.gangs) controls[`${s.id}.${g.id}`] = g.controls;
    else controls[s.id] = s.controls;
  }
  for (const f of floor.furniture) if (f.light && f.interact) controls[f.id] = [f.light];

  // Start: the lighting preset for this state and moment, if the notes give one.
  const preset = (house.lightingPresets ?? []).find((p) => p.state === state && p.dateTime === `${start.date}T${start.hhmm}`);
  const on = Object.fromEntries(lights.map((l) => [l.id, !!preset?.lightsOn?.includes(l.id) && l.startsOn !== false]));

  function toggle(controlId) {
    const ids = (controls[controlId] ?? []).filter((id) => byId[id]);
    const anyOn = ids.some((id) => on[id]);
    for (const id of ids) on[id] = !anyOn;
  }

  const condition = (controlId) => ((controls[controlId] ?? []).some((id) => on[id]) ? "on" : "off");

  // Level 0..1 of each light at a moment (manual lights are on or off; scheduled ones follow their schedule).
  function levels(date, minutes) {
    const tw = twilightMinutes(house, date);
    const out = {};
    for (const l of lights) out[l.id] = l.schedule ? scheduleLevel(cfg.schedules[l.schedule], minutes, tw) : on[l.id] ? 1 : 0;
    return out;
  }

  // Three.js intensity for a light at a level (per emitter, for lights with several).
  function intensity(l, level) {
    const lm = (l.lumens * level * cfg.photometricScale) / (l.emitters ?? 1);
    return l.emit === "point" ? lm / (4 * Math.PI) : lm / Math.PI;
  }

  return { lights, byId, controls, on, toggle, condition, levels, intensity, preset };
}
