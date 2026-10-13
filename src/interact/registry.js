// Reads every interactive object from house.json (doors, curtains, furniture,
// switches) and resolves its type, action and prompts. Pure: no Three.js.

export function collectInteractives(house) {
  const floor = house.floors[0];
  const out = [];
  const add = (id, interact, source) => interact && out.push({ id, interact, source });
  for (const d of floor.doors) add(d.id, d.interact, "door");
  if (floor.curtains) add(floor.curtains.id, floor.curtains.interact, "curtains");
  for (const f of floor.furniture) add(f.id, f.interact, "furniture");
  for (const s of floor.switches ?? []) {
    // A plate with several gangs is one control per gang, each with its own prompts.
    if (s.gangs) for (const g of s.gangs) add(`${s.id}.${g.id}`, { ...s.interact, prompts: g.prompts ?? s.interact.prompts }, "switch");
    else add(s.id, s.prompts ? { ...s.interact, prompts: s.prompts } : s.interact, "switch");
  }
  return out;
}

// The prompt for an object in a given condition ("open", "closed", "on", ...):
// the object's own prompts first, then its type's.
export function promptFor(house, interact, condition) {
  const type = house.interaction?.types?.[interact.type];
  return interact.prompts?.[condition] ?? type?.prompts?.[condition] ?? null;
}
