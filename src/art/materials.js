// One MeshLambertMaterial per material in house.json, with its texture.
// Lambert on purpose: the room-aware lighting patch (lighting/roomMask.js) works
// on Lambert materials. Textures are drawn in code; if tools/fetch-textures.mjs
// has downloaded a real CC0 texture for a material (listed in
// /textures/manifest.json) it is swapped in once loaded.
import * as THREE from "three";
import { proceduralTexture } from "./textures.js";

export function createMaterials(house) {
  const res = house.art?.textureResolution ?? 512;
  const lib = {};
  let seed = 1;
  for (const [id, def] of Object.entries(house.materials)) {
    const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(def.colour) });
    m.name = id;
    if (def.opacity !== undefined) Object.assign(m, { transparent: true, opacity: def.opacity, depthWrite: false });
    if (def.emissive) m.emissive = new THREE.Color(def.emissive); // the mirror reads as a mirror without reflections
    if (def.texture) {
      const t = proceduralTexture(def.texture, res, seed++);
      m.map = t.map;
      // The detail map darkens on average; brighten the colour to keep the notes' colour as the mean.
      m.color.multiplyScalar(1 / Math.max(0.5, t.mean));
      if (t.bumpMap) { m.bumpMap = t.bumpMap; m.bumpScale = def.texture.bump ?? 0.5; }
      m.userData.cover = t.cover; // metres covered by one image (for UVs)
      m.userData.brighten = 1 / Math.max(0.5, t.mean);
    }
    lib[id] = m;
  }
  // Cheap helpers for parts the notes don't name (handles, rubber feet, screens).
  const extra = house.art?.helperColours ?? {};
  for (const [id, c] of Object.entries(extra)) lib[id] = new THREE.MeshLambertMaterial({ color: new THREE.Color(c), name: id });
  if (lib._clear) Object.assign(lib._clear, { transparent: true, opacity: 0.18, depthWrite: false });

  // Real textures fetched by tools/fetch-textures.mjs, when present.
  fetch("textures/manifest.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((manifest) => {
      if (!manifest) return;
      const loader = new THREE.TextureLoader();
      for (const [id, files] of Object.entries(manifest.materials ?? {})) {
        const m = lib[id];
        if (!m || !files.diffuse) continue;
        loader.load(`textures/${files.diffuse}`, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          const cover = files.cover ?? [1, 1];
          tex.repeat.set(1 / cover[0], 1 / cover[1]);
          m.map = tex;
          // Tint so the photo's average comes out as the notes' colour.
          const mean = meanColour(tex.image);
          const want = new THREE.Color(house.materials[id].colour);
          m.color.setRGB(...["r", "g", "b"].map((c) => Math.min(4, want[c] / Math.max(0.02, mean[c]))));
          m.userData.cover = cover;
          m.needsUpdate = true;
        });
        if (files.normal) loader.load(`textures/${files.normal}`, (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1 / (files.cover?.[0] ?? 1), 1 / (files.cover?.[1] ?? 1));
          m.normalMap = tex;
          m.bumpMap = null;
          m.needsUpdate = true;
        });
      }
    })
    .catch(() => {}); // no fetched textures: keep the drawn ones

  return lib;
}

// Average linear colour of an image (sampled small).
function meanColour(image) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const x = c.getContext("2d");
  x.drawImage(image, 0, 0, 16, 16);
  const d = x.getImageData(0, 0, 16, 16).data, sum = new THREE.Color(0, 0, 0), px = new THREE.Color();
  for (let i = 0; i < d.length; i += 4) {
    px.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
    sum.r += px.r; sum.g += px.g; sum.b += px.b;
  }
  return { r: sum.r / 256, g: sum.g / 256, b: sum.b / 256 };
}

// Colour variants of a material (record sleeves, clothes) without new textures.
export function tinted(lib, base, colour) {
  const key = `${base}:${colour}`;
  if (!lib[key]) {
    lib[key] = lib[base].clone();
    lib[key].color = new THREE.Color(colour).multiplyScalar(lib[base].userData.brighten ?? 1);
    lib[key].name = key;
  }
  return lib[key];
}
