import type { NextConfig } from "next";

// Static export, because Tauri serves the built files from disk and there is no
// Node process behind the window. This rules out middleware, which is why the
// locale is a client-side provider rather than a path prefix: next-intl's
// routing needs middleware, and `output: export` forbids it.
const nextConfig: NextConfig = {
  output: "export",
  // There is no image optimizer without a server to run it. Every icon is inline
  // SVG; the one raster asset is the entry screen's art, already sized and
  // compressed into public/ by scripts/optimise-image.mjs and served as a plain
  // img with a srcset, so nothing here has anything left to do.
  images: { unoptimized: true },
};

export default nextConfig;
