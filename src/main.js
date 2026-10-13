// Boot: load house.json, build the scene, start the first-person loop.
import * as THREE from "three";
import house from "../house.json";
import { buildHouse } from "./house/builder.js";
import { buildFurniture } from "./furniture/builder.js";
import { addFlatLighting } from "./lighting/flat.js";
import { buildColliders } from "./player/collision.js";
import { createPlayer } from "./player/controls.js";
import { createDoorSystem } from "./doors/doors.js";
import { buildDoorMeshes } from "./doors/builder.js";
import { createCurtainSystem } from "./curtains/curtains.js";
import { buildCurtainMeshes } from "./curtains/builder.js";
import { createInteraction } from "./interact/interaction.js";
import { createHud } from "./ui/hud.js";

const params = new URLSearchParams(location.search);
const validStates = house.states.list.map((s) => s.id);
const state = validStates.includes(params.get("state")) ? params.get("state") : house.states.default;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8ccd0);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 6000);

const shell = buildHouse(house);
const furniture = buildFurniture(house, state);
const doors = createDoorSystem(house);
const doorMeshes = buildDoorMeshes(house, doors);
const curtains = createCurtainSystem(house, state);
const curtainMeshes = curtains ? buildCurtainMeshes(curtains) : null;
scene.add(shell.group, furniture.group, doorMeshes.group);
if (curtainMeshes) scene.add(curtainMeshes.group);
addFlatLighting(scene);

const settings = house.player;
const staticColliders = buildColliders([...shell.boxes, ...furniture.boxes], settings);
const getColliders = () => [...staticColliders, ...doors.segments(), ...(curtains ? curtains.colliders() : [])];
const player = createPlayer({ camera, dom: renderer.domElement, settings, getColliders });
const hud = createHud(house, state);
player.onLockChange((locked) => hud.setLocked(locked));
document.getElementById("overlay").addEventListener("click", () => renderer.domElement.requestPointerLock?.());

// Handlers by interaction type (types and prompts come from house.json).
const toggleDoor = (obj) => ({ condition: () => doors.condition(obj.id), run: () => doors.toggle(obj.id) });
const handlers = {
  door: toggleDoor,
  bifold: toggleDoor,
  curtains: () => ({ condition: () => curtains.condition(), run: () => curtains.toggle() }),
};
const interaction = createInteraction({
  house,
  camera,
  roots: [shell.group, furniture.group, doorMeshes.group, ...(curtainMeshes ? [curtainMeshes.group] : [])],
  handlers,
  hud,
  isActive: () => player.state.locked,
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function step(dt, render = true) {
  doors.update(dt, { ...player.state.pos, radius: settings.radius });
  curtains?.update(dt);
  player.update(dt);
  doorMeshes.update();
  curtainMeshes?.update();
  interaction.update();
  hud.update(player);
  if (render) renderer.render(scene, camera);
}

const timer = new THREE.Timer();
function frame(time) {
  timer.update(time);
  step(timer.getDelta());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug and test hooks: window.__house.player.teleport(x, y, facingDeg), .walk(forward, right, seconds),
// .doors.toggle(id), .interaction.activate(), .step(dt, render) to advance without waiting for frames.
window.__house = { player, doors, curtains, interaction, scene, camera, renderer, state, step, render: () => step(0) };
