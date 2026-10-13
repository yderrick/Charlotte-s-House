// Textures drawn in code from the recipes in house.json (materials.*.texture):
// a detail map (multiplied with the material's colour) and a bump map.
// They stand in for downloaded CC0 textures until tools/fetch-textures.mjs has
// fetched real ones (see art/materials.js). Deterministic: same seed, same image.
import * as THREE from "three";

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
}

// Smooth value noise on a grid that wraps (so the texture tiles).
function valueNoise(size, cells, rand) {
  const g = Array.from({ length: cells * cells }, rand);
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  return (px, py) => {
    const x = (px / size) * cells, y = (py / size) * cells;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

// Each pattern fills tone[] (0..1, multiplied into the colour) and height[] (0..1),
// and says how many metres the image covers.
const PATTERNS = {
  plaster(n, t, rand) {
    const a = valueNoise(n, 8, rand), b = valueNoise(n, 32, rand), amt = t.amount ?? 0.03;
    return { cover: t.size, fn: (x, y) => { const v = 0.6 * a(x, y) + 0.4 * b(x, y); return [1 - amt + amt * v, v]; } };
  },
  planks(n, t, rand) {
    // Two plank lengths along u, six plank widths along v; staggered joints.
    const [len, wid] = t.size, rows = 6, cols = 2;
    const grain = valueNoise(n, 64, rand), fine = valueNoise(n, 160, rand);
    const tones = Array.from({ length: rows * (cols + 1) }, () => 1 - (t.variation ?? 0.08) * rand());
    const offsets = Array.from({ length: rows }, () => rand());
    return {
      cover: [len * cols, wid * rows],
      fn: (x, y) => {
        const v = (y / n) * rows, row = Math.floor(v), fv = v - row;
        const u = (x / n) * cols + offsets[row], col = Math.floor(u), fu = u - col;
        const seam = fv < 0.025 || fu < 0.006 ? 1 : 0;
        const g = grain(x * 0.15, y * 3) * 0.6 + fine(x, y * 4) * 0.4;
        const tone = tones[row * (cols + 1) + (col % (cols + 1))] * (1 - (t.grain ?? 0.1) * g);
        return [seam ? tone * 0.72 : tone, seam ? 0 : 0.6 + 0.4 * g];
      },
    };
  },
  tiles(n, t, rand) {
    // 2 x 2 tiles per image; grout lines between.
    const [tw, th] = t.size, cols = 2, rows = 2, gw = (t.groutWidth ?? 0.003) / (tw * cols);
    const tones = Array.from({ length: 4 }, () => 1 - (t.variation ?? 0.03) * rand());
    const speck = valueNoise(n, 96, rand);
    const grout = new THREE.Color(t.grout ?? "#888888");
    const gl = (grout.r + grout.g + grout.b) / 3;
    return {
      cover: [tw * cols, th * rows],
      fn: (x, y) => {
        const u = (x / n) * cols, v = (y / n) * rows, fu = u - Math.floor(u), fv = v - Math.floor(v);
        if (fu < gw * cols || fv < gw * cols * (tw / th)) return [gl, 0];
        return [tones[Math.floor(v) * cols + Math.floor(u)] * (0.97 + 0.03 * speck(x, y)), 1];
      },
    };
  },
  carpetTiles(n, t, rand) {
    // 2 x 2 tiles laid quarter-turned, each with a loop-pile grain.
    const a = valueNoise(n, 128, rand), b = valueNoise(n, 24, rand);
    const tones = Array.from({ length: 4 }, () => 1 - (t.variation ?? 0.05) * rand());
    return {
      cover: [t.size[0] * 2, t.size[1] * 2],
      fn: (x, y) => {
        const u = (x / n) * 2, v = (y / n) * 2, i = Math.floor(v) * 2 + Math.floor(u);
        const turned = (Math.floor(u) + Math.floor(v)) % 2;
        const stripe = Math.sin(((turned ? x : y) / n) * Math.PI * 2 * 90) * 0.5 + 0.5;
        const h = 0.5 * a(x, y) + 0.3 * stripe + 0.2 * b(x, y);
        const edge = u - Math.floor(u) < 0.006 || v - Math.floor(v) < 0.006;
        return [tones[i] * (0.86 + 0.14 * h) * (edge ? 0.85 : 1), h];
      },
    };
  },
  weave(n, t, rand) {
    // A plain over-under weave, repeated many times per image.
    const reps = 32, noise = valueNoise(n, 48, rand), amt = t.amount ?? 0.1;
    return {
      cover: [t.size[0] * reps, t.size[1] * reps],
      fn: (x, y) => {
        const u = (x / n) * reps, v = (y / n) * reps;
        const over = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
        const thread = over ? Math.sin((u * 2 % 1) * Math.PI) : Math.sin((v * 2 % 1) * Math.PI);
        const h = 0.7 * thread + 0.3 * noise(x, y);
        return [1 - amt + amt * h, h];
      },
    };
  },
  brushed(n, t, rand) {
    const streaks = Array.from({ length: n }, () => rand()), coarse = valueNoise(n, 6, rand), amt = t.amount ?? 0.06;
    return { cover: t.size, fn: (x, y) => { const s = 0.7 * streaks[y] + 0.3 * coarse(x, y); return [1 - amt + amt * s, s]; } };
  },
  speckle(n, t, rand) {
    const a = valueNoise(n, 200, rand), b = valueNoise(n, 40, rand), amt = t.amount ?? 0.1;
    const dots = new Set(Array.from({ length: n * 3 }, () => Math.floor(rand() * n) * n + Math.floor(rand() * n)));
    return { cover: t.size, fn: (x, y) => { const d = dots.has(y * n + x) ? -0.25 : 0; const v = 0.5 * a(x, y) + 0.5 * b(x, y); return [1 - amt + amt * v + d, v]; } };
  },
  cardboard(n, t, rand) {
    const a = valueNoise(n, 40, rand), amt = t.amount ?? 0.08;
    return { cover: t.size, fn: (x, y) => { const c = Math.sin((y / n) * Math.PI * 2 * 60) * 0.5 + 0.5; return [1 - amt + amt * (0.5 * a(x, y) + 0.5 * c), c]; } };
  },
  slots(n, t) {
    // Vertical slots of a heater or vent grille.
    return { cover: t.size, fn: (x) => { const f = (x / n) % 1, slot = Math.abs(f - 0.5) < 0.22; return [slot ? 0.25 : 1, slot ? 0 : 1]; } };
  },
};

// Handwriting needs strokes, not a per-pixel function: drawn straight on the canvas.
function handwriting(ctx, n, rand) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = "rgba(25, 32, 60, 0.85)";
  ctx.lineWidth = n / 340;
  for (let line = 0; line < 26; line++) {
    const y = n * (0.12 + line * 0.032);
    let x = n * 0.08;
    const end = n * (0.82 + rand() * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (x < end) {
      const w = n * (0.01 + rand() * 0.035);
      for (let k = 0; k < 4; k++) ctx.lineTo(x + (w * (k + 1)) / 4, y - rand() * n * 0.012 + n * 0.004);
      x += w + n * 0.012;
      ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // The page number in the top right corner.
  ctx.font = `${Math.round(n * 0.04)}px serif`;
  ctx.fillStyle = "rgba(25, 32, 60, 0.9)";
  ctx.fillText(String(1 + Math.floor(rand() * 60)), n * 0.86, n * 0.07);
}

const cache = new Map();

// { map, bumpMap, cover: [metres, metres], mean } for a texture recipe.
export function proceduralTexture(recipe, resolution = 512, seed = 1) {
  const key = JSON.stringify([recipe, resolution, seed]);
  if (cache.has(key)) return cache.get(key);
  const n = resolution, rand = rng(seed * 7919 + 13);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d");
  let cover = recipe.size ?? [1, 1], mean = 1, bumpCanvas = null;

  if (recipe.pattern === "handwriting") {
    handwriting(ctx, n, rand);
  } else {
    const p = (PATTERNS[recipe.pattern] ?? PATTERNS.plaster)(n, recipe, rand);
    cover = p.cover;
    const img = ctx.createImageData(n, n);
    bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = bumpCanvas.height = n;
    const bctx = bumpCanvas.getContext("2d"), bump = bctx.createImageData(n, n);
    let sum = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const [tone, h] = p.fn(x, y);
        const v = Math.max(0, Math.min(255, Math.round(tone * 255))), hv = Math.max(0, Math.min(255, Math.round(h * 255)));
        const i = (y * n + x) * 4;
        img.data.set([v, v, v, 255], i);
        bump.data.set([hv, hv, hv, 255], i);
        sum += tone;
      }
    ctx.putImageData(img, 0, 0);
    bctx.putImageData(bump, 0, 0);
    mean = sum / (n * n);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = bumpCanvas ? new THREE.CanvasTexture(bumpCanvas) : null;
  for (const t of [map, bumpMap]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / cover[0], 1 / cover[1]); t.anisotropy = 4; }
  const out = { map, bumpMap, cover, mean };
  cache.set(key, out);
  return out;
}
