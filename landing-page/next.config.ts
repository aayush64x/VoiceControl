import type { NextConfig } from "next";

// NEXT_PUBLIC_BASE_PATH is set when building for GitHub Pages (served from /VoiceControl/).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // `STATIC_EXPORT=1 npm run build` writes a static copy of the site to `out/`.
  output: process.env.STATIC_EXPORT ? "export" : undefined,
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
};

export default nextConfig;
