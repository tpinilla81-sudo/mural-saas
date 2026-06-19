import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide framework fingerprint from response headers.
  poweredByHeader: false,
  env: {
    AUTH_TRUST_HOST: "true",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Powered-By", value: "" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
