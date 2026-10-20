import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { createRequire } from "node:module";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "**/next/dist/client/components/app-router-instance.js": { loaders: ["./scripts/next-navigation-ownership-loader.cjs"], as: "*.js" },
      "**/next/dist/esm/client/components/app-router-instance.js": { loaders: ["./scripts/next-navigation-ownership-loader.cjs"], as: "*.js" },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /next[\\/]dist[\\/](?:esm[\\/])?client[\\/]components[\\/]app-router-instance\.js$/,
      enforce: "pre",
      use: [path.join(__dirname, "scripts/next-navigation-ownership-loader.cjs")],
    });
    return config;
  },
  async redirects() {
    return [
      { source: "/guide/", destination: "/guide", permanent: true },
      { source: "/guide/index.html", destination: "/guide", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: "/guide", destination: "/guide/index.html" }];
  },
};

export default function configureNext(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    // Config is evaluated before either compiler/cache. Never move this check
    // into a loader or an npm-only hook: direct Next/Vercel builds need it too.
    const verify = createRequire(path.join(__dirname, "next.config.ts"))("./scripts/verify-next-navigation-ownership.cjs") as () => void;
    verify();
  }
  return nextConfig;
}
