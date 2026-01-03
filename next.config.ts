import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile ESM packages that cause resolution issues
  transpilePackages: [
    // BlockNote and its dependencies
    "@blocknote/core",
    "@blocknote/react",
    "@blocknote/mantine",
    // React diff viewer
    "react-diff-viewer-continued",
  ],
  // Empty turbopack config to silence warning, but we'll use webpack
  turbopack: {},
  // Use webpack for better ESM/CommonJS interop with BlockNote
  webpack: (config) => {
    // Ensure proper resolution of ESM modules
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".jsx": [".jsx", ".tsx"],
    };
    return config;
  },
  reactStrictMode: true,
};

export default nextConfig;
