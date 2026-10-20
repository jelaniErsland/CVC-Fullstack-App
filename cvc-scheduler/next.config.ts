import type { NextConfig } from "next";
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

export default nextConfig;
