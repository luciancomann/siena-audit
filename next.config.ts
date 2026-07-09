import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  // watch-rebuild.sh builds into a staging dir and swaps it in atomically,
  // so the serving dir is never a half-written build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The CX Audit report pages read data/reports/*.json from disk at request
  // time; serverless bundling only traces static imports, so include the
  // reports explicitly or the deployed sample 404s.
  outputFileTracingIncludes: {
    "/cx-audit/report/[slug]": ["./data/reports/**"],
    "/cx-audit/crm-preview/[slug]": ["./data/reports/**"],
    "/api/cx-audit": ["./data/reports/**"],
  },
};

export default nextConfig;
