// Door leaves that follow the door system's angles, plus the front door's
// status lights (red locked, green open). Each face of a leaf takes the
// material house.json gives for that side (faceInside / faceOutside).
import * as THREE from "three";
import { leafPlacements } from "./kinematics.js";
import { planToThree } from "../scene/boxes.js";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const HANDLE_SIZE = { length: 0.12, height: 0.02, depth: 0.03, inset: 0.07 }; // lever handle

export function buildDoorMeshes(house, doorSystem, materials) {
  const group = new THREE.Group();
  group.name = "doors";
  const handleHeight = house.doorMotion?.handleHeight ?? 1.0;
  const items = [];

  const HANDLE = materials.stainless;
  for (const d of doorSystem.doors) {
    const { frame } = d;
    const def = house.floors[0].doors.find((x) => x.id === d.id) ?? {};
    const inside = materials[def.faceInside ?? "door_white"], outside = materials[def.faceOutside ?? def.faceInside ?? "door_white"];
    // A leaf's local +z face looks to the right of its direction; when closed that is the swing room's side or not.
    const plusZIntoSwing = frame.along[1] * frame.n[0] - frame.along[0] * frame.n[1] > 0;
    const swingIsInside = house.floors[0].rooms.find((r) => r.id === def.swingsInto)?.inUnit !== false; // faceInside looks into the flat
    const faceIn = swingIsInside ? inside : outside, faceOut = swingIsInside ? outside : inside;
    const edge = inside;
    const leafMats = [edge, edge, edge, edge, plusZIntoSwing ? faceIn : faceOut, plusZIntoSwing ? faceOut : faceIn];
    const zc = (frame.z[0] + frame.z[1]) / 2, h = frame.z[1] - frame.z[0];
    const leaves = leafPlacements(frame, d.angle).map((p, i) => {
      const leafGroup = new THREE.Group();
      leafGroup.name = `${d.id}:leaf${i}`;
      leafGroup.userData.interactId = d.id;
      const panel = new THREE.Mesh(unitBox, leafMats);
      panel.scale.set(p.length, h, p.thickness);
      panel.userData.interactId = d.id;
      leafGroup.add(panel);
      // Handles near the free end of the first leaf (the fold, on a bifold), both faces.
      if (i === 0) {
        for (const side of [1, -1]) {
          const handle = new THREE.Mesh(unitBox, HANDLE);
          handle.scale.set(HANDLE_SIZE.length, HANDLE_SIZE.height, HANDLE_SIZE.depth);
          handle.position.set(p.length / 2 - HANDLE_SIZE.inset - HANDLE_SIZE.length / 2, handleHeight - zc, side * (p.thickness / 2 + HANDLE_SIZE.depth / 2));
          handle.userData.interactId = d.id;
          leafGroup.add(handle);
        }
      }
      group.add(leafGroup);
      return leafGroup;
    });
    items.push({ door: d, leaves, zc });
  }

  // Status lights that follow a door's lock (indicators with followsDoorLock).
  const lockLights = [];
  for (const l of house.floors[0].lights.filter((l) => l.followsDoorLock)) {
    const door = doorSystem.byId[l.followsDoorLock];
    if (!door) continue;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), mat);
    dot.position.copy(planToThree(...l.position));
    dot.name = l.id;
    group.add(dot);
    lockLights.push({ door, mat });
  }
  const colours = house.floors[0].doors.find((d) => d.lock)?.lock.statusLight ?? {};

  function update() {
    for (const { door, leaves, zc } of items) {
      leafPlacements(door.frame, door.angle).forEach((p, i) => {
        const g = leaves[i];
        const cx = p.start[0] + (p.dir[0] * p.length) / 2, cy = p.start[1] + (p.dir[1] * p.length) / 2;
        g.position.copy(planToThree(cx, cy, zc));
        g.rotation.y = Math.atan2(p.dir[1], p.dir[0]);
      });
    }
    for (const { door, mat } of lockLights) mat.color.set(door.locked ? colours.locked ?? "#FF2A2A" : colours.open ?? "#2AFF5A");
  }
  update();
  return { group, update };
}
