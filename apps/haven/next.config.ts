import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@haven/auth"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
