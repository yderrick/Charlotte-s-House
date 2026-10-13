// Door state: each leafed door has an angle that moves toward a target.
// Pure (no Three.js): the browser and the walk test drive the same logic.
import { doorFrame, leafPlacements, leafSegments, distanceToSegment, hasLeaf, startAngle } from "./kinematics.js";

export function createDoorSystem(house) {
  const floor = house.floors[0];
  const motion = house.doorMotion ?? {};
  const doors = floor.doors.filter(hasLeaf).map((def) => {
    const frame = doorFrame(floor, def, motion);
    const angle = startAngle(frame, def);
    return {
      id: def.id,
      def,
      frame,
      angle,
      target: angle,
      speed: frame.maxAngle / (motion.openSeconds ?? 0.9), // radians per second when opened by hand
      openedFor: 0, // seconds spent fully open (for self-closing)
      locked: !!def.locked && angle === 0,
      blocked: false,
    };
  });
  const byId = Object.fromEntries(doors.map((d) => [d.id, d]));

  const isOpen = (d) => d.target > 0;

  function toggle(id) {
    const d = byId[id];
    if (!d) return;
    if (isOpen(d)) d.target = 0;
    else {
      d.target = d.frame.maxAngle;
      d.locked = false; // the tenant's biometrics open it from either side
    }
    d.openedFor = 0;
  }

  // Would the leaves at this angle overlap the player's body?
  function hits(d, angle, player) {
    if (!player) return false;
    return leafSegments(d.frame, angle).some((s) => distanceToSegment(player.x, player.y, s) < player.radius + s.half + 0.005);
  }

  function update(dt, player) {
    for (const d of doors) {
      // Self-closing doors (the front door) shut slowly after being held open.
      if (d.def.selfClosing && d.target > 0 && d.angle >= d.target - 1e-6) {
        d.openedFor += dt;
        if (d.openedFor >= (d.def.holdOpenSeconds ?? 4)) d.target = 0;
      }
      if (d.angle === d.target) {
        d.blocked = false;
        continue;
      }
      const closingSlowly = d.def.selfClosing && d.target === 0;
      const speed = closingSlowly ? d.frame.maxAngle / (d.def.closeSeconds ?? 5) : d.speed;
      const step = Math.sign(d.target - d.angle) * speed * dt;
      const next = Math.abs(d.target - d.angle) <= Math.abs(step) ? d.target : d.angle + step;
      // A door stops against the player instead of pushing through them.
      if (hits(d, next, player) && !hits(d, d.angle, player)) {
        d.blocked = true;
        continue;
      }
      d.blocked = false;
      d.angle = next;
      if (d.angle === 0 && d.target === 0) {
        d.openedFor = 0;
        if (d.def.locked) d.locked = true;
      }
    }
  }

  function segments() {
    return doors.flatMap((d) => leafSegments(d.frame, d.angle));
  }

  // Set a door straight to an angle (tests and story states).
  function setAngle(id, angle) {
    const d = byId[id];
    d.angle = d.target = Math.max(0, Math.min(d.frame.maxAngle, angle));
  }

  function condition(id) {
    return isOpen(byId[id]) ? "open" : "closed";
  }

  // Plan point at the middle of the door's first leaf, where it is now (for aiming in tests).
  function leafCentre(id, z = 1.2) {
    const p = leafPlacements(byId[id].frame, byId[id].angle)[0];
    return [p.start[0] + (p.dir[0] * p.length) / 2, p.start[1] + (p.dir[1] * p.length) / 2, z];
  }

  const moving = () => doors.some((d) => d.angle !== d.target);

  return { doors, byId, toggle, update, segments, setAngle, condition, leafCentre, moving };
}
