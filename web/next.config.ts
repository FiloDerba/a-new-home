import type { NextConfig } from "next";

// Fully static site: the data files are fetched in the browser, so any static host works.
// On GitHub Pages the site lives under /<repo>, set through NEXT_PUBLIC_BASE_PATH.
const config: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default config;
