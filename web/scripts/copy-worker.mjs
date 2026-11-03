// MapLibre runs tile parsing in a web worker that bundlers cannot resolve on their own.
// Serving the worker file from public/ and pointing MapLibre at it (see MapView.tsx) is the
// bundler-agnostic fix. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.js");
