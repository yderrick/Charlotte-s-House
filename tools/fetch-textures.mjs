// Optional: download real CC0 textures from Poly Haven for the materials in
// house.json, to replace the textures drawn in code (src/art/textures.js).
//
//   npm run fetch:textures                      # every material with texture.search words
//   npm run fetch:textures -- --only couch_bluegreen,tile_grey
//   npm run fetch:textures -- --pick tile_grey=<polyhaven asset id>
//   npm run fetch:textures -- --res 2k --dry-run
//
// Writes public/textures/<files>, public/textures/manifest.json (read by
// src/art/materials.js at start-up) and the "Downloaded textures" list in
// CREDITS.md. Each material keeps its colour from house.json: the photo is
// tinted so its average comes out as that colour. Needs network access to
// api.polyhaven.com and dl.polyhaven.org. No dependencies (Node 18+ fetch).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadHouse } from "./lib.mjs";

const API = "https://api.polyhaven.com";
const HEADERS = { "User-Agent": "charlottes-house texture fetch (local, non-commercial)" };
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const res = opt("res") ?? "1k";
const only = opt("only")?.split(",");
const dryRun = args.includes("--dry-run");
const picks = Object.fromEntries(args.flatMap((a, i) => (args[i - 1] === "--pick" ? [a.split("=")] : [])));

const house = loadHouse();
const outDir = join(ROOT, "public", "textures");
const getJson = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};

// Score a Poly Haven asset against a material's search words.
function score(asset, words) {
  const hay = [asset.name, ...(asset.tags ?? []), ...(asset.categories ?? [])].map((s) => String(s).toLowerCase());
  let s = 0;
  for (const w of words) {
    if (hay.some((h) => h === w)) s += 3;
    else if (hay.some((h) => h.includes(w))) s += 1;
  }
  return s;
}

const wanted = Object.entries(house.materials).filter(([id, m]) => m.texture?.search && (!only || only.includes(id)));
if (!wanted.length) { console.log("no materials to fetch"); process.exit(0); }

let assets;
try {
  assets = await getJson(`${API}/assets?t=textures`);
} catch (e) {
  console.error(`could not reach Poly Haven (${e.message}).\nAllow api.polyhaven.com and dl.polyhaven.org in your network settings, or run this on a machine with internet access.`);
  process.exit(1);
}

const manifestPath = join(outDir, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { source: "Poly Haven (CC0)", materials: {} };
mkdirSync(outDir, { recursive: true });

for (const [id, m] of wanted) {
  const words = m.texture.search.map((w) => w.toLowerCase());
  const assetId = picks[id] ?? Object.entries(assets)
    .map(([aid, a]) => [aid, score(a, words)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (!assetId || !assets[assetId]) { console.log(`${id}: no match for "${words.join(" ")}"`); continue; }
  const info = assets[assetId];
  const files = await getJson(`${API}/files/${assetId}`);
  const pickFile = (key) => files[key]?.[res]?.jpg?.url ?? files[key]?.[res]?.png?.url;
  const diffuseUrl = pickFile("Diffuse") ?? pickFile("diff");
  const normalUrl = pickFile("nor_gl");
  if (!diffuseUrl) { console.log(`${id}: ${assetId} has no ${res} diffuse map`); continue; }
  const cover = info.dimensions ? info.dimensions.map((mm) => mm / 1000) : m.texture.size ?? [1, 1];
  const entry = { asset: assetId, name: info.name, page: `https://polyhaven.com/a/${assetId}`, licence: "CC0", authors: Object.keys(info.authors ?? {}), cover };
  console.log(`${id}: ${assetId} (${info.name}), ${cover.map((c) => c.toFixed(2)).join(" x ")} m`);
  if (dryRun) continue;
  for (const [kind, url] of [["diffuse", diffuseUrl], ["normal", normalUrl]]) {
    if (!url) continue;
    const name = url.split("/").pop();
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) { console.log(`  ${kind}: HTTP ${r.status}`); continue; }
    writeFileSync(join(outDir, name), Buffer.from(await r.arrayBuffer()));
    entry[kind] = name;
  }
  manifest.materials[id] = entry;
}

if (!dryRun) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  // The list in CREDITS.md between the markers.
  const creditsPath = join(ROOT, "CREDITS.md");
  const credits = readFileSync(creditsPath, "utf8");
  const rows = Object.entries(manifest.materials).map(([id, e]) => `| \`${id}\` | [${e.name}](${e.page}) | ${e.authors.join(", ") || "Poly Haven"} | CC0 | ${[e.diffuse, e.normal].filter(Boolean).join(", ")} |`);
  const table = ["| Material | Texture | Author | Licence | Files in public/textures |", "| --- | --- | --- | --- | --- |", ...rows].join("\n");
  const start = "<!-- fetched:start -->", end = "<!-- fetched:end -->";
  const next = credits.includes(start) ? credits.replace(new RegExp(`${start}[\\s\\S]*${end}`), `${start}\n${table}\n${end}`) : `${credits}\n${start}\n${table}\n${end}\n`;
  writeFileSync(creditsPath, next);
  console.log(`wrote ${manifestPath} and CREDITS.md`);
}
