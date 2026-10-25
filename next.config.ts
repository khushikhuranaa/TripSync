import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes the variables in `.dev.vars` (DATABASE_URL and every server secret)
// available to `next dev` through the same env object the deployed runtime
// reads. Dev only: `next build` and `next start` run as plain Node — that is
// how Render serves the site — and read `process.env` directly.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({ configPath: "./freebuff.wrangler.jsonc" });
}

const nextConfig: NextConfig = {
  // Keep the development overlay out of the design preview screenshots.
  devIndicators: false,
  // `pg` resolves its own optional addons at runtime, so it must be required
  // from node_modules instead of being bundled into the server build.
  serverExternalPackages: ["pg"],
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
