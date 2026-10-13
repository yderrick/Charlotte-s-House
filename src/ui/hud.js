// Small on-screen display: which room you are in, where, and which way you face.
import { roomAt, bearingOf } from "../data/geometry.js";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function createHud(house, state) {
  const floor = house.floors[0];
  const facing = house.site.facing.bearingDeg;
  const el = document.getElementById("hud");
  const overlay = document.getElementById("overlay");
  let lastRoom = "";

  return {
    setLocked(locked) {
      overlay.hidden = locked;
    },
    update(player) {
      const { pos, yaw } = player.state;
      const hit = roomAt(floor, pos.x, pos.y);
      if (hit) lastRoom = hit.zone && hit.zone.id !== hit.room.id ? `${hit.room.name} · ${hit.zone.id}` : hit.room.name;
      const bearing = bearingOf(-Math.sin(yaw), Math.cos(yaw), facing);
      const dir = COMPASS[Math.round(bearing / 45) % 8];
      el.innerHTML = `<div class="room">${lastRoom}</div><div class="meta">x ${pos.x.toFixed(2)} · y ${pos.y.toFixed(2)} · facing ${dir} ${Math.round(bearing)}° · state ${state}</div>`;
    },
  };
}
