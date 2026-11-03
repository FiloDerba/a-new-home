import type { NextConfig } from "next";

// Fully static site: the data files are fetched in the browser, so any static host works.
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default config;
