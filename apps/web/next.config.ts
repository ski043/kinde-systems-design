import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@marshaldesk/shared",
    "@marshaldesk/db",
    "@marshaldesk/kinde",
  ],
  serverExternalPackages: ["@prisma/orm-postgres", "pg"],
  async headers() {
    return [
      {
        // The widget route sets its own frame-ancestors from the allowed domains (proxy.ts).
        source: "/((?!widget/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // Customers paste a fixed URL, so updates must reach them quickly.
        source: "/embed.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
