// Node-side helpers for the planning tools. Geometry lives in src/data/geometry.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadHouse(path) {
  path ??= join(ROOT, "house.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export * from "../src/data/geometry.js";
