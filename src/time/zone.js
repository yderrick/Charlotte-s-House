// Local clock time in a named time zone <-> UTC, using the platform's time-zone
// data (Intl). Pure: works in the browser and in Node.

const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }
  return formatters.get(timeZone);
}

// Minutes the zone is ahead of UTC at a UTC instant (e.g. -240 for EDT).
export function zoneOffsetMinutes(utcMs, timeZone) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

// UTC instant for a local date ("YYYY-MM-DD") and minutes after local midnight.
export function localToUtcMs(date, minutes, timeZone) {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d) + minutes * 60000;
  let utc = naive - zoneOffsetMinutes(naive, timeZone) * 60000;
  utc = naive - zoneOffsetMinutes(utc, timeZone) * 60000; // second pass settles DST changeovers
  return utc;
}

// Calendar date string n days after a date string.
export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
