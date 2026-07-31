import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root to this repo — otherwise an unrelated lockfile
  // elsewhere on the machine (e.g. a parent directory) can make Next.js
  // infer the wrong root and warn/misbehave. Harmless in CI/Vercel (which
  // only ever checks out this repo), but keeps local builds deterministic.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Service worker scripts must never be CDN/browser-cached long-term, or
  // clients can get stuck on a stale sw.js after a deploy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
