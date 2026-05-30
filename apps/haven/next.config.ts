import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@haven/auth"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default withSentryConfig(nextConfig, {
  org: "haven-sq",
  project: "haven-app",

  // Auth token for source map uploads (set in Vercel env vars)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress build output noise
  silent: !process.env.CI,

  // Upload source maps so stack traces show real line numbers
  widenClientFileUpload: true,

  // Tree-shake Sentry debug logging in production bundles
  disableLogger: true,

  // Avoid "SentryWebpackPlugin" warnings in Next.js 16
  reactComponentAnnotation: { enabled: true },
});
