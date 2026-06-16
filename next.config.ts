import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  env: {
    AUTH_TRUST_HOST: "true",
  },
};

export default nextConfig;
