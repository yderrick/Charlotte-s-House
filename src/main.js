// Boot: load house.json, build the scene, start the first-person loop.
import * as THREE from "three";
import house from "../house.json";
import { buildHouse } from "./house/builder.js";
import { buildFurniture } from "./furniture/builder.js";
import { addFlatLighting } from "./lighting/flat.js";
import { addDaylight, enableShadows } from "./lighting/daylight.js";
import { createClock, parseHHMM } from "./time/clock.js";
import { environmentAt } from "./time/environment.js";
import { buildSky } from "./time/sky.js";
import { buildColliders } from "./player/collision.js";
import { createPlayer } from "./player/controls.js";
import { createDoorSystem } from "./doors/doors.js";
import { buildDoorMeshes } from "./doors/builder.js";
import { createCurtainSystem } from "./curtains/curtains.js";
import { buildCurtainMeshes } from "./curtains/builder.js";
import { createInteraction } from "./interact/interaction.js";
import { createHud } from "./ui/hud.js";
import { createTimebar } from "./ui/timebar.js";

const params = new URLSearchParams(location.search);
const validStates = house.states.list.map((s) => s.id);
const state = validStates.includes(params.get("state")) ? params.get("state") : house.states.default;
const flatLight = params.get("light") === "flat"; // ?light=flat: the stage 1 even lighting, for checking geometry

// Game clock: starts at the story state's date and time unless ?date= / ?time= say otherwise.
const tod = house.timeOfDay;
const [stateDate, stateTime] = house.states.list.find((s) => s.id === state).defaultDateTime.split("T");
const clock = createClock({
  date: /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date") : stateDate,
  minutes: parseHHMM(params.get("time")) ?? parseHHMM(stateTime),
  speed: params.has("speed") ? Math.max(0, +params.get("speed")) : tod.clockSpeed,
  speedSteps: tod.speedSteps,
  timeZone: house.site.timeZone,
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = !flatLight;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Each light decides when its shadow re-renders (see lighting/daylight.js).
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 6000);

const shell = buildHouse(house);
const furniture = buildFurniture(house, state);
const doors = createDoorSystem(house);
const doorMeshes = buildDoorMeshes(house, doors);
const curtains = createCurtainSystem(house, state);
const curtainMeshes = curtains ? buildCurtainMeshes(curtains) : null;
scene.add(shell.group, furniture.group, doorMeshes.group);
if (curtainMeshes) scene.add(curtainMeshes.group);
const sky = buildSky(house);
scene.add(sky.group);
const daylight = flatLight ? null : addDaylight(scene, house, params.get("shadows") ?? "medium");
if (flatLight) {
  addFlatLighting(scene);
  renderer.toneMapping = THREE.NoToneMapping;
} else {
  for (const g of [shell.group, furniture.group, doorMeshes.group, curtainMeshes?.group]) if (g) enableShadows(g);
  shell.group.getObjectByName("ground").castShadow = false;
}

const settings = house.player;
const staticColliders = buildColliders([...shell.boxes, ...furniture.boxes], settings);
const getColliders = () => [...staticColliders, ...doors.segments(), ...(curtains ? curtains.colliders() : [])];
const player = createPlayer({ camera, dom: renderer.domElement, settings, getColliders });
const hud = createHud(house, state);
const timebar = createTimebar(house, clock);
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

let env = null;
function step(dt, render = true) {
  clock.tick(dt);
  env = environmentAt(house, clock.utcMs());
  const somethingMoving = doors.moving() || curtains?.moving();
  doors.update(dt, { ...player.state.pos, radius: settings.radius });
  curtains?.update(dt);
  player.update(dt);
  doorMeshes.update();
  curtainMeshes?.update();
  sky.update(env, camera.position);
  daylight?.update(env, renderer, somethingMoving);
  interaction.update();
  hud.update(player);
  timebar.update(env);
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
// .doors.toggle(id), .interaction.activate(), .step(dt, render) to advance without waiting for frames,
// .clock.setMinutes(m), .env() for the current sun, moon and light values.
window.__house = { player, doors, curtains, interaction, clock, scene, camera, renderer, state, step, render: () => step(0), env: () => env };
