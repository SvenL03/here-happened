import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Lets several dev servers run side by side from one checkout (NEXT_DIST_DIR=.next-a npm run dev).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
