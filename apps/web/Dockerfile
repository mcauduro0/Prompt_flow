# =============================================================================
# ARC Investment Factory - Web Service Dockerfile
# =============================================================================
# Next.js frontend for the investment research platform
# Port: 3000
# =============================================================================

FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN apk add --no-cache libc6-compat

WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencies Stage
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY . .

# Build shared packages first, then web
RUN pnpm --filter @arc/shared build && \
    pnpm --filter @arc/core build && \
    pnpm --filter @arc/web build

# -----------------------------------------------------------------------------
# Production Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set correct permissions for prerender cache
RUN mkdir -p apps/web/.next && chown nextjs:nodejs apps/web/.next

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
