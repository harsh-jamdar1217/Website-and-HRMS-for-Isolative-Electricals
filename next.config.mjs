import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  webpack(config) {
    // Explicit alias so "@/..." resolves in server AND client bundles.
    config.resolve.alias["@"] = path.join(process.cwd(), "src");
    return config;
  },
  serverExternalPackages: ["better-sqlite3"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } }, // document uploads are capped at 5 MB in code
  // Mutations use server actions; Next verifies the Origin header against Host (CSRF protection).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
