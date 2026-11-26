import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // sql.js ships a UMD bundle that breaks when webpack rewrites its module wrapper.
  serverExternalPackages: ["sql.js"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
