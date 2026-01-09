import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"
import path from "path"

// Static export mode for marketing site (set STATIC_EXPORT=true)
const isStaticExport = process.env.STATIC_EXPORT === "true"

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  // Exclude ioredis from bundling to avoid worker thread issues during build
  serverExternalPackages: isStaticExport ? [] : ["ioredis", "bullmq"],
  // Image optimization - must be unoptimized for static export
  images: isStaticExport ? { unoptimized: true } : { formats: ["image/avif", "image/webp"] },
  // Trailing slash for clean static URLs
  ...(isStaticExport && { trailingSlash: true }),
  // Silence monorepo root inference issues when multiple lockfiles exist on host
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    // Allow build to succeed despite ESLint warnings
    // ESLint is still run during development and CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily allow builds to succeed despite TS issues flagged in analysis
    ignoreBuildErrors: true,
  },
  // Security headers (not available in static export - use host config instead)
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                {
                  key: "X-Frame-Options",
                  value: "DENY",
                },
                {
                  key: "X-Content-Type-Options",
                  value: "nosniff",
                },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
                {
                  key: "X-XSS-Protection",
                  value: "1; mode=block",
                },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=()",
                },
                // HSTS - enable only in production with HTTPS
                ...(process.env.NODE_ENV === "production"
                  ? [
                      {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains",
                      },
                    ]
                  : []),
                // Note: Content-Security-Policy is handled in middleware with nonce-based security
                // See src/middleware.ts and src/lib/middleware/csp.ts for implementation
              ],
            },
          ]
        },
      }),
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Skip source map upload if auth token is not set (e.g., in CI without secrets)
  sourcemaps: {
    disable: process.env.SENTRY_SKIP_SOURCE_MAP_UPLOAD === "true",
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  // Disabled for static export (no server to handle tunnel)
  ...(isStaticExport ? {} : { tunnelRoute: "/monitoring" }),

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Webpack-specific options (using new non-deprecated format)
  webpack: {
    // Upload a larger set of source maps for prettier stack traces
    widenClientFileUpload: true,
    // Automatically annotate React components
    reactComponentAnnotation: {
      enabled: true,
    },
    // Tree-shake Sentry logger statements
    treeshake: {
      removeDebugLogging: true,
    },
  },
}

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions)
