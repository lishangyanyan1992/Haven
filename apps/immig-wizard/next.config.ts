import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@haven/auth'],
  serverExternalPackages: ['pdf-lib', 'jszip'],
};

export default nextConfig;
