import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Build sırasında ESLint hatalarını ignore et
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Build sırasında TypeScript hatalarını ignore et
    ignoreBuildErrors: true,
  },
  // Linting ve type checking'i tamamen disable et
  swcMinify: true,
  reactStrictMode: false,
};

export default nextConfig;
