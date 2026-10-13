// Boot: load house.json, build the grey box, start the first-person loop.
import * as THREE from "three";
import house from "../house.json";
import { buildHouse } from "./house/builder.js";
import { buildFurniture } from "./furniture/builder.js";
import { addFlatLighting } from "./lighting/flat.js";
import { buildColliders } from "./player/collision.js";
import { createPlayer } from "./player/controls.js";
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
scene.add(shell.group, furniture.group);
addFlatLighting(scene);

const settings = house.player;
const colliders = buildColliders([...shell.boxes, ...furniture.boxes], settings);
const player = createPlayer({ camera, dom: renderer.domElement, settings, colliders });
const hud = createHud(house, state);
player.onLockChange((locked) => hud.setLocked(locked));
document.getElementById("overlay").addEventListener("click", () => renderer.domElement.requestPointerLock?.());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
function frame(time) {
  timer.update(time);
  const dt = timer.getDelta();
  player.update(dt);
  hud.update(player);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug and test hooks: window.__house.player.teleport(x, y, facingDeg), .walk(forward, right, seconds)
window.__house = { player, scene, camera, renderer, state, colliders, render: () => { player.update(0); hud.update(player); renderer.render(scene, camera); } };
