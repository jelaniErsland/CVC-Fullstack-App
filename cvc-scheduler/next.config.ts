import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
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
