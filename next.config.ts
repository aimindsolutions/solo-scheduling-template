import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker/Cloud Run deployment
  // Force all pages to render dynamically at runtime, not at build time.
  // This prevents Firebase Admin SDK from being initialized during 'next build'
  // when environment variables (FIREBASE_PROJECT_ID etc.) are not available.
  experimental: {
    dynamicIO: false,
  },
};

export default withNextIntl(nextConfig);
