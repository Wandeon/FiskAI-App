import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Silence monorepo root inference issues when multiple lockfiles exist on host
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
