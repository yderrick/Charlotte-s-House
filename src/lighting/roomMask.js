// Room-aware lighting for every MeshLambertMaterial. Each pixel works out which
// room it faces (its position nudged along its normal), and each point or spot
// light inside the flat only reaches it if the light is in the same room, or in
// a neighbouring room seen straight through an open doorway (scaled by how open
// the door is). Lights outside every room (daylight through the glass) are not
// affected. This is what stops light passing through walls without needing a
// shadow map per light. The same rule in JavaScript is lightReach() in rooms.js.
import * as THREE from "three";
import { buildRoomGraph, MAX_ROOMS, MAX_PORTALS } from "./rooms.js";

// Each indoor light carries its room in its cutoff distance: distance = ROOM_TAG + room index.
// A cutoff that far away changes its fall-off by less than one part in a million.
export const ROOM_TAG = 1000;

const DECLS = /* glsl */ `
#define RL_MAX_ROOMS ${MAX_ROOMS}
#define RL_MAX_PORTALS ${MAX_PORTALS}
uniform vec4 rlRooms[RL_MAX_ROOMS];     // x0, y0, x1, y1 in plan metres
uniform int rlRoomCount;
uniform vec4 rlPortalA[RL_MAX_PORTALS]; // planeIsY, plane coordinate, along lo, along hi
uniform vec4 rlPortalB[RL_MAX_PORTALS]; // top z, room a, room b, openness 0..1
uniform vec4 rlPairs[RL_MAX_ROOMS * RL_MAX_ROOMS / 4]; // doorway index + 1 between two rooms (0 = none)
uniform mat4 rlViewToWorld;
uniform float rlNormalOffset;
uniform vec3 rlRoomFill[RL_MAX_ROOMS]; // bounced light in each room from its own lamps (and open doorways)
int rlRoomAt(vec2 p) {
  for (int r = 0; r < RL_MAX_ROOMS; r++) {
    if (r >= rlRoomCount) break;
    vec4 b = rlRooms[r];
    if (p.x >= b.x && p.x <= b.z && p.y >= b.y && p.y <= b.w) return r;
  }
  return -1;
}
vec3 rlPlan(vec3 viewPos) { vec3 w = (rlViewToWorld * vec4(viewPos, 1.0)).xyz; return vec3(w.x, -w.z, w.y); }
float rlMask(vec3 lightView, float lightTag, vec3 fragPlan, int fragRoom) {
  if (lightTag < ${ROOM_TAG - 0.5}) return 1.0; // not an indoor light (daylight through the glass)
  int lr = int(lightTag - ${ROOM_TAG.toFixed(1)} + 0.5);
  if (lr == fragRoom) return 1.0;
  if (fragRoom < 0) return 0.0;
  int k = lr * RL_MAX_ROOMS + fragRoom;
  int i = int(rlPairs[k / 4][k % 4] + 0.5) - 1;
  if (i < 0) return 0.0;
  vec4 a = rlPortalA[i], b = rlPortalB[i];
  vec3 lp = rlPlan(lightView);
  float fa = a.x > 0.5 ? fragPlan.y : fragPlan.x;
  float den = (a.x > 0.5 ? lp.y : lp.x) - fa;
  if (abs(den) < 1e-5) return 0.0;
  float t = (a.y - fa) / den;
  if (t <= 0.0 || t >= 1.0) return 0.0;
  vec3 c = fragPlan + (lp - fragPlan) * t;
  float along = a.x > 0.5 ? c.x : c.y;
  return (along >= a.z && along <= a.w && c.z >= 0.0 && c.z <= b.x) ? b.w : 0.0;
}
`;

// Once per pixel: which room the surface faces (its position nudged along its normal).
const FRAGMENT_ROOM = /* glsl */ `
vec3 rlFragPlan = rlPlan(geometryPosition);
vec3 rlN = (rlViewToWorld * vec4(geometryNormal, 0.0)).xyz;
int rlFragRoom = rlRoomAt(rlFragPlan.xy + vec2(rlN.x, -rlN.z) * rlNormalOffset);
`;

function patchedLightsChunk() {
  let c = THREE.ShaderChunk.lights_fragment_begin;
  const anchors = [
    ["vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );", "vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\tif ( rlFragRoom >= 0 ) irradiance += rlRoomFill[ rlFragRoom ];"],
    ["vec3 geometryNormal = normal;", "vec3 geometryNormal = normal;\n" + FRAGMENT_ROOM],
    ["getPointLightInfo( pointLight, geometryPosition, directLight );", "getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= rlMask( pointLight.position, pointLight.distance, rlFragPlan, rlFragRoom );"],
    ["getSpotLightInfo( spotLight, geometryPosition, directLight );", "getSpotLightInfo( spotLight, geometryPosition, directLight );\n\t\tdirectLight.color *= rlMask( spotLight.position, spotLight.distance, rlFragPlan, rlFragRoom );"],
  ];
  for (const [a, b] of anchors) {
    if (!c.includes(a)) throw new Error(`roomMask: Three.js lights chunk changed, cannot find "${a}"`);
    c = c.replace(a, b);
  }
  return c;
}

export function createRoomMask(house) {
  const floor = house.floors[0];
  const graph = buildRoomGraph(floor);
  const uniforms = {
    rlRooms: { value: Array.from({ length: MAX_ROOMS }, (_, i) => { const r = graph.rooms[i]; return r ? new THREE.Vector4(r.x[0], r.y[0], r.x[1], r.y[1]) : new THREE.Vector4(); }) },
    rlRoomCount: { value: graph.rooms.length },
    rlPortalA: { value: Array.from({ length: MAX_PORTALS }, (_, i) => { const q = graph.portals[i]; return q ? new THREE.Vector4(q.planeIsY ? 1 : 0, q.c, q.lo, q.hi) : new THREE.Vector4(); }) },
    rlPortalB: { value: Array.from({ length: MAX_PORTALS }, (_, i) => { const q = graph.portals[i]; return q ? new THREE.Vector4(q.top, q.a, q.b, q.always ? 1 : 0) : new THREE.Vector4(); }) },
    rlPairs: { value: Array.from({ length: (MAX_ROOMS * MAX_ROOMS) / 4 }, () => new THREE.Vector4()) },
    rlViewToWorld: { value: new THREE.Matrix4() },
    rlNormalOffset: { value: house.indoorLighting.roomMask.normalOffset },
    rlRoomFill: { value: Array.from({ length: MAX_ROOMS }, () => new THREE.Color(0, 0, 0)) },
  };
  // Doorway lookup between each pair of rooms (the first doorway, if a pair has several).
  graph.portals.forEach((q, i) => {
    for (const [r1, r2] of [[q.a, q.b], [q.b, q.a]]) {
      const k = r1 * MAX_ROOMS + r2, v = uniforms.rlPairs.value[k >> 2];
      const comp = ["x", "y", "z", "w"][k & 3];
      if (v[comp] === 0) v[comp] = i + 1;
    }
  });
  const chunk = patchedLightsChunk();
  const patched = new WeakSet();

  function patch(material) {
    if (!material?.isMeshLambertMaterial || patched.has(material)) return;
    patched.add(material);
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", DECLS + "\nvoid main() {")
        .replace("#include <lights_fragment_begin>", chunk);
    };
    material.customProgramCacheKey = () => "room-light-mask-v1";
    material.needsUpdate = true;
  }

  // Tag every point and spot light standing inside a room with that room (see ROOM_TAG).
  function tagLights(root) {
    root.traverse((o) => {
      if (!(o.isPointLight || o.isSpotLight)) return;
      const r = graph.rooms.findIndex((r) => o.position.x >= r.x[0] && o.position.x <= r.x[1] && -o.position.z >= r.y[0] && -o.position.z <= r.y[1]);
      o.distance = r >= 0 ? ROOM_TAG + r : 0;
    });
  }

  function patchAll(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) patch(m);
    });
  }

  // Per frame: the camera (to turn view space back into the plan), how open each door is,
  // and each room's bounced light (linear RGB, from fixtures.roomFill()).
  function update(camera, openness, roomFill) {
    uniforms.rlViewToWorld.value.copy(camera.matrixWorld);
    graph.portals.forEach((q, i) => { if (!q.always) uniforms.rlPortalB.value[i].w = openness(q.doorId); });
    if (roomFill) roomFill.forEach((c, i) => uniforms.rlRoomFill.value[i].setRGB(c[0], c[1], c[2]));
  }

  return { graph, patch, patchAll, tagLights, update };
}
