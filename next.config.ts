import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker/Cloud Run deployment

  // Trust the X-Forwarded-Host header from Cloud Run's load balancer.
  // Without this, Next.js uses the internal container URL (0.0.0.0:8080)
  // for redirects instead of the public HTTPS URL.
  experimental: {
    trustHostHeader: true,
  },
};

export default withNextIntl(nextConfig);
