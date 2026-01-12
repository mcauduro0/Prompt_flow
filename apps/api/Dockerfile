# =============================================================================
# ARC Investment Factory - API Service Dockerfile
# =============================================================================
# Express API server for the investment research platform
# Port: 3001
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
COPY packages/database/package.json ./packages/database/
COPY packages/llm-client/package.json ./packages/llm-client/
COPY packages/retriever/package.json ./packages/retriever/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/llm-client/node_modules ./packages/llm-client/node_modules
COPY --from=deps /app/packages/retriever/node_modules ./packages/retriever/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

# Build shared packages first, then API
RUN pnpm --filter @arc/shared build && \
    pnpm --filter @arc/core build && \
    pnpm --filter @arc/database build && \
    pnpm --filter @arc/llm-client build && \
    pnpm --filter @arc/retriever build && \
    pnpm --filter @arc/api build

# -----------------------------------------------------------------------------
# Production Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

# Copy built application
COPY --from=builder --chown=api:nodejs /app/package.json ./
COPY --from=builder --chown=api:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=api:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=api:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=api:nodejs /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=api:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=api:nodejs /app/packages/database/package.json ./packages/database/
COPY --from=builder --chown=api:nodejs /app/packages/llm-client/dist ./packages/llm-client/dist
COPY --from=builder --chown=api:nodejs /app/packages/llm-client/package.json ./packages/llm-client/
COPY --from=builder --chown=api:nodejs /app/packages/retriever/dist ./packages/retriever/dist
COPY --from=builder --chown=api:nodejs /app/packages/retriever/package.json ./packages/retriever/
COPY --from=builder --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=api:nodejs /app/apps/api/package.json ./apps/api/

USER api

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
