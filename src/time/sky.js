// The sky: a gradient dome (zenith -> horizon, warmer around the sun), a star
// field that turns with the sky and fades in at dusk, and the moon as a lit
// disc showing its phase. Colours come from the environment (house.json).
import * as THREE from "three";
import { planToThree } from "../scene/boxes.js";

const RADIUS = 3000; // inside the camera's far plane
const RAD = Math.PI / 180;

const skyShader = {
  uniforms: {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    glow: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 zenith, horizon, glow, sunDir;
    varying vec3 vDir;
    void main() {
      float h = max(vDir.y, 0.0);
      vec3 col = mix(horizon, zenith, pow(h, 0.55));
      float nearSun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
      col = mix(col, glow, nearSun * (1.0 - h * 0.6) * 0.85);
      if (vDir.y < 0.0) col = mix(horizon, horizon * 0.55, min(-vDir.y * 6.0, 1.0)); // below the horizon: haze
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};

// A seeded random so the stars are the same every time.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildSky(house) {
  const group = new THREE.Group();
  group.name = "sky";
  const facing = house.site.facing.bearingDeg;
  const lat = house.site.latitude;

  const dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 24), new THREE.ShaderMaterial({ ...skyShader, uniforms: THREE.UniformsUtils.clone(skyShader.uniforms), side: THREE.BackSide, depthWrite: false }));
  dome.renderOrder = -10;
  dome.raycast = () => {};
  group.add(dome);

  // Stars on a sphere around the celestial pole; the pole sits due north at the latitude's altitude.
  const count = house.timeOfDay.sky.stars.count;
  const rand = rng(21);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(th) * RADIUS * 0.95, u * RADIUS * 0.95, r * Math.sin(th) * RADIUS * 0.95], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.raycast = () => {};
  const pole = new THREE.Group(); // its local +y is the celestial pole
  const northPlan = [Math.sin(-facing * RAD), Math.cos(-facing * RAD)];
  const poleDir = planToThree(northPlan[0] * Math.cos(lat * RAD), northPlan[1] * Math.cos(lat * RAD), Math.sin(lat * RAD)).normalize();
  pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir);
  pole.add(stars);
  group.add(pole);

  // The moon: a disc drawn on a canvas with its phase, always facing the viewer.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  const discDeg = house.timeOfDay.moonLight.discDeg ?? 1.0;
  moon.scale.setScalar(2 * RADIUS * 0.9 * Math.tan((discDeg / 2) * RAD));
  moon.raycast = () => {};
  group.add(moon);
  let drawnPhase = -1;

  function drawMoon(phase) {
    const ctx = canvas.getContext("2d"), c = 64, r = 60;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = "#2a2e38"; // the unlit part, faintly visible
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
    // Lit part: half disc plus or minus an ellipse (the terminator).
    const waxing = phase < 0.5;
    const k = Math.cos(phase * Math.PI * 2); // 1 new, -1 full
    ctx.fillStyle = "#f2efe4";
    ctx.beginPath();
    ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !waxing);
    ctx.ellipse(c, c, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
    ctx.fill();
    tex.needsUpdate = true;
    drawnPhase = phase;
  }

  const toThree = (d) => planToThree(d[0], d[1], d[2]).normalize();

  function update(env, cameraPosition) {
    group.position.copy(cameraPosition); // the sky is infinitely far away
    const u = dome.material.uniforms;
    u.zenith.value.set(env.sky.zenith);
    u.horizon.value.set(env.sky.horizon);
    u.glow.value.set(env.sky.glow);
    u.sunDir.value.copy(toThree(env.sun.dir));
    starMat.opacity = env.starOpacity;
    stars.visible = env.starOpacity > 0.01;
    stars.rotation.y = -env.siderealTime; // the sky turns about the pole
    moon.position.copy(toThree(env.moon.dir).multiplyScalar(RADIUS * 0.9));
    moon.visible = env.moon.altitude > -1;
    moon.material.opacity = Math.max(0.15, 1 - env.daylight * 0.75); // pale in daylight
    if (Math.abs(env.moon.phase - drawnPhase) > 0.005) drawMoon(env.moon.phase);
  }

  return { group, update };
}
