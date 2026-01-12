# =============================================================================
# ARC Investment Factory - Multi-stage Production Dockerfile
# =============================================================================
# This Dockerfile builds all services in a single multi-stage build
# for efficient caching and smaller final images.
#
# Services:
# - api: Express API server (port 3001)
# - web: Next.js frontend (port 3000)
# - worker: Background job processor
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Install dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/llm-client/package.json ./packages/llm-client/
COPY packages/retriever/package.json ./packages/retriever/
COPY packages/worker/package.json ./packages/worker/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder - Build all packages
# -----------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build all packages
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 3: API Production Image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS api

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/llm-client ./packages/llm-client
COPY --from=builder /app/packages/retriever ./packages/retriever
COPY --from=builder /app/apps/api ./apps/api

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]

# -----------------------------------------------------------------------------
# Stage 4: Web Production Image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS web

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/apps/web ./apps/web

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/.next/standalone/server.js"]

# -----------------------------------------------------------------------------
# Stage 5: Worker Production Image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS worker

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/llm-client ./packages/llm-client
COPY --from=builder /app/packages/retriever ./packages/retriever
COPY --from=builder /app/packages/worker ./packages/worker

# Set environment
ENV NODE_ENV=production

# No port exposed - worker runs scheduled jobs

CMD ["node", "packages/worker/dist/cli.js", "scheduler"]
