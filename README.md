# ARC Investment Factory

**Novelty-first global equities idea generation and deep fundamental research system with persistent memory and discretionary decision support.**

## Overview

ARC Investment Factory is an operational web application that generates a novelty-first daily Idea Inbox for global equities, promotes 2-3 names per day into a deep research Action Queue, produces 10 deep fundamental research packets per week with a one-page DecisionBrief, and maintains persistent memory with immutable thesis versions and evidence traceability.

## Core Operating Parameters (Locked)

| Parameter | Value |
|-----------|-------|
| Asset Class | Global Equities |
| Holding Horizon | 1-3 Years |
| Default Optimization | Novelty |
| Daily Lane A Target | 120 ideas |
| Daily Lane A Cap | 200 ideas |
| Daily Lane B Promotions | 2-3 (max 4) |
| Weekly Deep Packets | 10 (hard cap) |

### Style Mix Targets (Weekly)

| Style | Target |
|-------|--------|
| Quality Compounder | 40% |
| GARP | 40% |
| Cigar Butt | 20% |

## Architecture

```
arc-investment-factory/
├── apps/
│   ├── web/          # Next.js UI
│   └── api/          # Fastify REST API
├── packages/
│   ├── core/         # Schemas, validation, types
│   ├── database/     # Drizzle ORM, migrations
│   ├── llm-client/   # LLM provider, prompts, tracing
│   ├── retriever/    # Vector DB, document retrieval
│   ├── worker/       # Background jobs, agents
│   └── shared/       # Config, constants, utilities
├── config/
│   ├── prompts/      # Prompt templates
│   ├── schemas/      # JSON schemas
│   └── environments/ # Environment configs
└── infrastructure/
    ├── docker/
    ├── k8s/
    └── terraform/
```

## Services

| Service | Description |
|---------|-------------|
| **web** | Next.js UI for Idea Inbox, Action Queue, Research Packets |
| **api** | REST API for UI and internal workers |
| **worker** | Background jobs for Lane A, Lane B, monitoring, bundles |
| **retriever** | Shared module for vector DB queries |
| **llm_client** | Shared module for structured LLM outputs |

## Orchestration DAGs

### Daily Discovery Run (Lane A)
Runs at 06:00 Mon-Fri. Generates candidates, enriches with fast modules, applies gates and scoring, promotes top ideas.

### Daily Lane B Deep Research
Runs at 08:00 Mon-Fri. Processes promoted ideas through deep research modules, generates ResearchPackets and DecisionBriefs.

### Event Monitoring Triggers
Runs every 4 hours. Detects material events and updates theses.

### Weekly IC Bundle
Runs Friday 18:00. Compiles top 10 completed packets into IC digest.

### Monthly Process Audit
Runs 1st of month. Evaluates hit rates and gate errors.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL
- Redis

### Installation

```bash
# Clone repository
git clone https://github.com/mcauduro0/Prompt_flow.git
cd Prompt_flow

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

### Environment Variables

See `.env.example` for required environment variables including:
- Database URL
- Pinecone API key
- OpenAI API key
- Langfuse keys
- Redis URL

## Development

```bash
# Run all services in development
pnpm dev

# Run specific service
pnpm api:dev
pnpm web:dev
pnpm worker:dev

# Run tests
pnpm test

# Run database migrations
pnpm db:migrate
```

## Non-Goals

- No automated trading
- No brokerage integration
- No real-time low-latency execution
- No advanced quant backtesting in v1
- No multi-asset support in v1

## License

Private - All rights reserved.