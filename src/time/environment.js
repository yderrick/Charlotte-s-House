// What the sky and the light are like at a moment: sun and moon directions in
// plan space, sky colours, light strengths and colours, all from the keyframes
// in house.json. Pure: no Three.js.
import { sunPosition, moonPosition, siderealTime } from "./astro.js";

const RAD = Math.PI / 180;

// Plan-space unit vector toward a body at a compass azimuth and altitude.
export function planDirection(azimuth, altitude, facing) {
  const t = (azimuth - facing) * RAD, a = altitude * RAD;
  return [Math.sin(t) * Math.cos(a), Math.cos(t) * Math.cos(a), Math.sin(a)];
}

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbToHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
export const mixHex = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Interpolate keyframes sorted by `key`: numbers linearly, "#rrggbb" colours in RGB.
export function sampleKeyframes(frames, key, value) {
  const fs = [...frames].sort((a, b) => a[key] - b[key]);
  if (value <= fs[0][key]) return fs[0];
  if (value >= fs.at(-1)[key]) return fs.at(-1);
  const i = fs.findIndex((f) => f[key] > value);
  const a = fs[i - 1], b = fs[i], t = (value - a[key]) / (b[key] - a[key]);
  const out = {};
  for (const k of Object.keys(a)) out[k] = typeof a[k] === "number" ? a[k] + (b[k] - a[k]) * t : typeof a[k] === "string" && a[k][0] === "#" ? mixHex(a[k], b[k], t) : a[k];
  return out;
}

export function environmentAt(house, utcMs) {
  const { latitude: lat, longitude: lon } = house.site;
  const facing = house.site.facing.bearingDeg;
  const tod = house.timeOfDay;
  const sun = sunPosition(utcMs, lat, lon);
  const moon = moonPosition(utcMs, lat, lon);
  const sunAlt = sun.altitude;

  const sky = sampleKeyframes(tod.sky.keyframes, "sunAltitude", sunAlt);
  const sunLight = sampleKeyframes(tod.sunLight.keyframes, "sunAltitude", sunAlt);
  const fillFrame = sampleKeyframes(tod.skyFill.keyframes, "sunAltitude", sunAlt);
  const daylight = smooth(-8, 10, sunAlt); // 0 at night, 1 in full day

  const ml = tod.moonLight;
  const moonUp = smooth(-1, 8, moon.altitude);
  const moonStrength = moonUp * moon.fraction * (1 - smooth(-6, 2, sunAlt)); // moonlight only matters once the sun is down
  const glow = tod.skyFill.nightGlow;
  const fillColour = daylight > 0.02 ? mixHex(glow.colour, sky.horizon, daylight) : glow.colour;

  const stars = tod.sky.stars;
  return {
    sun: { altitude: sunAlt, azimuth: sun.azimuth, dir: planDirection(sun.azimuth, sunAlt, facing) },
    moon: { altitude: moon.altitude, azimuth: moon.azimuth, fraction: moon.fraction, phase: moon.phase, dir: planDirection(moon.azimuth, moon.altitude, facing) },
    sky: { zenith: sky.zenith, horizon: sky.horizon, glow: sky.glow },
    starOpacity: 1 - smooth(stars.fullBelowSunAltitude, stars.goneAboveSunAltitude, sunAlt),
    siderealTime: siderealTime(utcMs, lon),
    daylight,
    // The one shadowed "key" light: the sun by day, the moon at night.
    key: sunLight.intensity > 0.001
      ? { body: "sun", intensity: sunLight.intensity, colour: sunLight.colour, dir: planDirection(sun.azimuth, sunAlt, facing) }
      : { body: "moon", intensity: ml.maxIntensity * moonStrength, colour: ml.colour, dir: planDirection(moon.azimuth, Math.max(moon.altitude, 0.5), facing) },
    fill: { intensity: fillFrame.intensity + glow.intensity * (1 - daylight) + ml.fillAtFullMoon * moonStrength, colour: fillColour },
    ambient: { intensity: tod.indoorAmbient.night + (tod.indoorAmbient.day - tod.indoorAmbient.night) * daylight, colour: tod.indoorAmbient.colour },
    exposure: tod.exposure.night + (tod.exposure.day - tod.exposure.night) * daylight,
  };
}
