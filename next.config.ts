import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  // watch-rebuild.sh builds into a staging dir and swaps it in atomically,
  // so the serving dir is never a half-written build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
