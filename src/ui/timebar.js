// The time bar: current time and date, a slider to jump to any hour, pause and
// speed buttons, and where the sun and moon are. Keys (from house.json) work too.
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (az) => COMPASS[Math.round(az / 22.5) % 16];

export function createTimebar(house, clock) {
  const ctl = house.timeOfDay.controls;
  const el = document.getElementById("timebar");
  el.innerHTML = `
    <div class="row">
      <span class="clock" id="tb-clock"></span>
      <span class="date" id="tb-date"></span>
      <button id="tb-slower" title="Slower (${ctl.labels.slower})">«</button>
      <button id="tb-pause" title="Pause / play (${ctl.labels.pause})"></button>
      <button id="tb-faster" title="Faster (${ctl.labels.faster})">»</button>
      <span class="speed" id="tb-speed"></span>
    </div>
    <input id="tb-slider" type="range" min="0" max="1439" step="1" aria-label="Time of day" />
    <div class="ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    <div class="sky" id="tb-sky"></div>
    <div class="keys">${ctl.labels.pause} pause · ${ctl.labels.slower} ${ctl.labels.faster} slower / faster · Esc frees the mouse for the slider</div>`;
  const $ = (id) => document.getElementById(id);
  const slider = $("tb-slider");
  let dragging = false;

  slider.addEventListener("input", () => { dragging = true; clock.setMinutes(+slider.value); });
  slider.addEventListener("change", () => { dragging = false; });
  $("tb-pause").addEventListener("click", () => clock.togglePause());
  $("tb-slower").addEventListener("click", () => clock.changeSpeed(-1));
  $("tb-faster").addEventListener("click", () => clock.changeSpeed(1));
  document.addEventListener("keydown", (e) => {
    if (e.target === slider && e.code.startsWith("Arrow")) return; // let the slider use arrow keys
    if (e.code === ctl.pause) clock.togglePause();
    else if (e.code === ctl.slower) clock.changeSpeed(-1);
    else if (e.code === ctl.faster) clock.changeSpeed(1);
  });

  const realMinutesPerDay = (s) => (s > 0 ? (1440 * 60) / s / 60 : Infinity);
  return {
    update(env) {
      const s = clock.state;
      $("tb-clock").textContent = clock.hhmm();
      $("tb-date").textContent = new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      $("tb-pause").textContent = s.speed === 0 ? "▶" : "❚❚";
      const mins = realMinutesPerDay(s.speed);
      $("tb-speed").textContent = s.speed === 0 ? "paused" : `×${s.speed} · 1 day = ${mins >= 1 ? `${+mins.toFixed(1)} min` : `${Math.round(mins * 60)} s`}`;
      if (!dragging) slider.value = Math.floor(s.minutes);
      const sun = env.sun, moon = env.moon;
      const sunText = sun.altitude > -0.8 ? `Sun ${sun.altitude.toFixed(0)}° high in the ${compass(sun.azimuth)}` : `Sun down (${sun.altitude.toFixed(0)}°)`;
      const moonText = moon.altitude > 0 ? ` · Moon ${moon.altitude.toFixed(0)}° ${compass(moon.azimuth)}, ${Math.round(moon.fraction * 100)}% lit` : "";
      $("tb-sky").textContent = sunText + moonText;
    },
  };
}
