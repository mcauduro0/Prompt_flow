# =============================================================================
# ARC Investment Factory - Worker Service Dockerfile
# =============================================================================
# Background job processor for scheduled tasks:
# - Lane A: Daily Discovery (06:00 Mon-Fri)
# - Lane B: Deep Research (08:00 Mon-Fri)
# - Weekly QA Report (18:00 Friday)
# - IC Bundle (19:00 Friday)
# =============================================================================

FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN apk add --no-cache libc6-compat tzdata

# Set timezone for scheduler
ENV TZ=America/Sao_Paulo

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
COPY packages/worker/package.json ./packages/worker/

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
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules

COPY . .

# Build all required packages
RUN pnpm --filter @arc/shared build && \
    pnpm --filter @arc/core build && \
    pnpm --filter @arc/database build && \
    pnpm --filter @arc/llm-client build && \
    pnpm --filter @arc/retriever build && \
    pnpm --filter @arc/worker build

# -----------------------------------------------------------------------------
# Production Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN apk add --no-cache tzdata

# Set timezone for scheduler (CRITICAL for America/Sao_Paulo schedules)
ENV TZ=America/Sao_Paulo

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Copy built application
COPY --from=builder --chown=worker:nodejs /app/package.json ./
COPY --from=builder --chown=worker:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=worker:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=worker:nodejs /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=worker:nodejs /app/packages/core/package.json ./packages/core/
COPY --from=builder --chown=worker:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=worker:nodejs /app/packages/database/package.json ./packages/database/
COPY --from=builder --chown=worker:nodejs /app/packages/llm-client/dist ./packages/llm-client/dist
COPY --from=builder --chown=worker:nodejs /app/packages/llm-client/package.json ./packages/llm-client/
COPY --from=builder --chown=worker:nodejs /app/packages/retriever/dist ./packages/retriever/dist
COPY --from=builder --chown=worker:nodejs /app/packages/retriever/package.json ./packages/retriever/
COPY --from=builder --chown=worker:nodejs /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder --chown=worker:nodejs /app/packages/worker/package.json ./packages/worker/

# Create data directory for QA reports and artifacts
RUN mkdir -p /app/data/qa_reports /app/data/ic_bundles /app/data/logs && \
    chown -R worker:nodejs /app/data

USER worker

ENV NODE_ENV=production

# No port exposed - worker runs scheduled jobs internally

# Default command: run scheduler
CMD ["node", "packages/worker/dist/cli.js", "scheduler"]
