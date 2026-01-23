# syntax=docker/dockerfile:1
# Dockerfile with BuildKit cache mounts for fast warm builds
# Use TARGETPLATFORM for multi-arch builds (defaults to host platform in CI)
# For production ARM64 builds: docker buildx build --platform linux/arm64
FROM node:22-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy Prisma schemas and configs (needed for postinstall prisma generate)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Disable Husky in Docker builds (no .git directory available)
ENV HUSKY=0

# Install dependencies with npm cache mount for fast subsequent builds
# Cache mount persists on BuildKit daemon between builds
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables needed for Prisma generation and Next.js static analysis.
# These dummy values are only for schema parsing and module evaluation, not actual connections.
# Using ARG + ENV ensures they're available during build but don't leak to final image.
# Note: REGULATORY_DATABASE_URL removed - regulatory schema is now in fiskai-workers repo.
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

# Service API keys (dummy values for build - real values provided at runtime)
ENV RESEND_API_KEY="re_dummy_build_key"
ENV RESEND_FROM_EMAIL="build@example.com"
ENV OPENAI_API_KEY="sk-dummy-build-key"
ENV DEEPSEEK_API_KEY="sk-dummy-build-key"

# Generate Prisma client
RUN npx prisma generate

# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

# Increase Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Build the application with Next.js cache mount for incremental builds
# This dramatically speeds up rebuilds when only a few files change
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install Prisma CLI globally for runtime migrations
# This ensures all dependencies (valibot, etc.) are properly installed
RUN npm install -g prisma@6

# Copy public assets
COPY --from=builder /app/public ./public

# Set up .next directory with correct permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone output (includes only production dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client (required at runtime)
# Note: Prisma CLI is installed globally, so we only need the generated client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schemas and migrations (required for runtime migrations)
# Note: Do NOT copy prisma.config.ts - it has dev dependencies and Prisma 6 loads it
# even with --schema flag. Migrations work fine with defaults (schema/migrations in prisma/)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy Drizzle migrations and config (required for runtime migrations)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Copy drizzle-kit and drizzle-orm (required for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# Copy docker-entrypoint.sh
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
