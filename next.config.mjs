import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const baseConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default function nextConfig(phase) {
  return {
    ...baseConfig,
    // Keep dev and build outputs separate to avoid stale/missing chunk collisions.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  };
}
