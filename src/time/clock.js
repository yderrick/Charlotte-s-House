// The game clock: a local date plus minutes after midnight, advanced at a
// chosen speed (game seconds per real second). Pure: no DOM, no Three.js.
import { localToUtcMs, addDays } from "./zone.js";

export function createClock({ date, minutes, speed, speedSteps, timeZone }) {
  const state = { date, minutes, speed, lastSpeed: speed || 60 };
  const steps = [...speedSteps].sort((a, b) => a - b);

  function tick(realSeconds) {
    state.minutes += (realSeconds * state.speed) / 60;
    while (state.minutes >= 1440) { state.minutes -= 1440; state.date = addDays(state.date, 1); }
    while (state.minutes < 0) { state.minutes += 1440; state.date = addDays(state.date, -1); }
  }

  function setMinutes(m) {
    state.minutes = Math.max(0, Math.min(1440 - 1e-6, m));
  }

  function togglePause() {
    if (state.speed === 0) state.speed = state.lastSpeed;
    else { state.lastSpeed = state.speed; state.speed = 0; }
  }

  // Next step up or down the speed list (0 = paused is the slowest step).
  function changeSpeed(dir) {
    const i = steps.findIndex((s) => s >= state.speed - 1e-9);
    const cur = i < 0 ? steps.length - 1 : i;
    const next = Math.max(0, Math.min(steps.length - 1, (steps[cur] === state.speed ? cur : dir > 0 ? cur - 1 : cur) + dir));
    state.speed = steps[next];
    if (state.speed > 0) state.lastSpeed = state.speed;
  }

  return {
    state,
    tick,
    setMinutes,
    togglePause,
    changeSpeed,
    utcMs: () => localToUtcMs(state.date, state.minutes, timeZone),
    hhmm: () => {
      const m = Math.floor(state.minutes);
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    },
  };
}

// "HH:MM" -> minutes after midnight.
export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  return m ? +m[1] * 60 + +m[2] : null;
}
