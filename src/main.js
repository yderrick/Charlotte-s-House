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
import { createLightState } from "./lighting/lightstate.js";
import { buildFixtures } from "./lighting/fixtures.js";
import { createRoomMask } from "./lighting/roomMask.js";
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
const roomMask = createRoomMask(house);
const lightState = createLightState(house, state, { date: clock.state.date, hhmm: clock.hhmm() });
const fixtures = buildFixtures(house, state, lightState, roomMask.graph);
scene.add(fixtures.group);
const daylight = flatLight ? null : addDaylight(scene, house, params.get("shadows") ?? "medium");
if (flatLight) {
  addFlatLighting(scene);
  renderer.toneMapping = THREE.NoToneMapping;
} else {
  for (const g of [shell.group, furniture.group, doorMeshes.group, curtainMeshes?.group]) if (g) enableShadows(g);
  shell.group.getObjectByName("ground").castShadow = false;
}
roomMask.patchAll(scene); // indoor lights stop at walls (see lighting/roomMask.js)
roomMask.tagLights(scene);

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
  switch: (obj) => ({ condition: () => lightState.condition(obj.id), run: () => lightState.toggle(obj.id) }),
  lamp: (obj) => ({ condition: () => lightState.condition(obj.id), run: () => lightState.toggle(obj.id) }),
};
const interaction = createInteraction({
  house,
  camera,
  roots: [shell.group, furniture.group, doorMeshes.group, fixtures.group, ...(curtainMeshes ? [curtainMeshes.group] : [])],
  handlers,
  hud,
  isActive: () => player.state.locked,
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// How open each doorway is (0..1), for light passing between rooms.
const openness = (doorId) => {
  const d = doors.byId[doorId];
  return d ? d.angle / d.frame.maxAngle : 1;
};

// The eye adapting: dark-adapted at night, brought down when indoor lights are bright around you.
const adapt = house.indoorLighting.adaptation;
let exposure = null;
function adaptExposure(dt) {
  const p = player.state.pos;
  const level = fixtures.lightLevelAt([p.x, p.y, settings.eyeHeight], openness);
  const t = Math.max(0, Math.min(1, (level - adapt.levelStart) / (adapt.levelForFullAdaptation - adapt.levelStart)));
  const k = t * t * (3 - 2 * t);
  const target = env.exposure + (Math.min(env.exposure, adapt.litExposure) - env.exposure) * k;
  exposure = exposure === null ? target : exposure + (target - exposure) * (1 - Math.exp(-dt / adapt.seconds));
  renderer.toneMappingExposure = flatLight ? 1 : exposure;
}

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
  daylight?.update(env, somethingMoving);
  if (fixtures.update(lightState.levels(clock.state.date, clock.state.minutes)) || somethingMoving) fixtures.markShadows();
  interaction.update();
  roomMask.update(camera, openness, fixtures.roomFill(openness));
  adaptExposure(dt);
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
// .lights (switch state), .fixtures, .exposure() for the eye adaptation.
window.__house = { player, doors, curtains, interaction, clock, lights: lightState, fixtures, scene, camera, renderer, state, step, render: () => step(0), env: () => env, exposure: () => exposure };
