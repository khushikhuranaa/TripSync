import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes the D1 database declared in freebuff.wrangler.jsonc available to
// `next dev` (through the same bindings the deployed Worker uses).
// Dev only: `next build` and `next start` must run as plain Node (that is how
// Render serves the site), so they never start Wrangler or a local workerd —
// on those runtimes the app falls back to the SQLite binding in
// `src/server/node-db.ts` instead.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({ configPath: "./freebuff.wrangler.jsonc" });
}

const nextConfig: NextConfig = {
  // Keep the development overlay out of the design preview screenshots.
  devIndicators: false,
  // better-sqlite3 is a native Node addon used by the plain-Node (Render)
  // database binding; it must be required from node_modules at runtime, never
  // bundled into the server build.
  serverExternalPackages: ["better-sqlite3"],
  // The Phase 1 photographs are already sized and compressed, so they are
  // served as-is. This also keeps deployment simple on Workers hosting.
  images: {
    unoptimized: true,
  },
  /**
   * Baseline response hardening applied to every route.
   *
   * Server Actions already reject cross-origin submissions (Next verifies the
   * Origin against Host), and `/api/auth` only accepts configured origins, so
   * these headers cover the rest: MIME sniffing, framing, referrer leakage and
   * unused device permissions. No CSP is set because the app relies on Next's
   * inline bootstrap scripts; adding one safely needs nonces.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
