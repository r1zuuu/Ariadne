import type { NextConfig } from "next";

// Static export, because Tauri serves the built files from disk and there is no
// Node process behind the window. This rules out middleware, which is why the
// locale is a client-side provider rather than a path prefix: next-intl's
// routing needs middleware, and `output: export` forbids it.
const nextConfig: NextConfig = {
  output: "export",
  // No image optimizer without a server, and the app ships no raster assets
  // anyway: every icon is inline SVG.
  images: { unoptimized: true },
};

export default nextConfig;
