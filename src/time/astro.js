// Sun and moon positions for a place and moment. Pure: no Three.js.
// Angles in degrees; azimuth is a compass bearing (0 = north, 90 = east).

// NOAA solar position (accurate to about a minute). Returns degrees.
export function sunPosition(dateUtcMs, lat, lon) {
  const r = Math.PI / 180;
  const jd = dateUtcMs / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * r) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * r) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * r) * 0.000289;
  const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * r);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * r);
  const dec = Math.asin(Math.sin(eps * r) * Math.sin(lam * r));
  const y = Math.tan((eps * r) / 2) ** 2;
  const eot = (4 / r) * (y * Math.sin(2 * L0 * r) - 2 * e * Math.sin(M * r) + 4 * e * y * Math.sin(M * r) * Math.cos(2 * L0 * r) - 0.5 * y * y * Math.sin(4 * L0 * r) - 1.25 * e * e * Math.sin(2 * M * r));
  const d = new Date(dateUtcMs), mins = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let tst = (mins + eot + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  const ha = tst / 4 - 180;
  const zen = Math.acos(Math.sin(lat * r) * Math.sin(dec) + Math.cos(lat * r) * Math.cos(dec) * Math.cos(ha * r));
  const az = (Math.atan2(Math.sin(ha * r), Math.cos(ha * r) * Math.sin(lat * r) - Math.tan(dec) * Math.cos(lat * r)) / r + 180) % 360;
  return { altitude: 90 - zen / r, azimuth: az };
}

const RAD = Math.PI / 180;
const OBLIQUITY = 23.4397 * RAD;
const raOf = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const decOf = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const daysSinceJ2000 = (ms) => ms / 86400000 - 10957.5;

// Local sidereal time in radians (also turns the star field).
export function siderealTime(dateUtcMs, lon) {
  return RAD * (280.16 + 360.9856235 * daysSinceJ2000(dateUtcMs)) + lon * RAD;
}

function moonCoords(d) {
  // Low-precision lunar theory (about 1 degree), as used by the SunCalc library.
  const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
  return { ra: raOf(l, b), dec: decOf(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  return { ra: raOf(L, 0), dec: decOf(L, 0) };
}

// Moon altitude/azimuth, the lit fraction of its disc (0 new .. 1 full) and its
// phase (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter).
export function moonPosition(dateUtcMs, lat, lon) {
  const d = daysSinceJ2000(dateUtcMs), phi = lat * RAD;
  const m = moonCoords(d);
  const H = siderealTime(dateUtcMs, lon) - m.ra;
  let alt = Math.asin(Math.sin(phi) * Math.sin(m.dec) + Math.cos(phi) * Math.cos(m.dec) * Math.cos(H));
  alt += (RAD * 0.017) / Math.tan(alt + (RAD * 10.26) / (alt + RAD * 5.1)); // refraction
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(m.dec) * Math.cos(phi));
  const s = sunCoords(d), sdist = 149598000;
  const elong = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(elong), m.dist - sdist * Math.cos(elong));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return {
    altitude: alt / RAD,
    azimuth: ((az / RAD + 180) % 360 + 360) % 360,
    fraction: (1 + Math.cos(inc)) / 2,
    phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
  };
}
