# AI Investment Flow - Implementation Summary

## Overview

This document summarizes the complete implementation of the AI Investment Flow system, following the Build Pack and Operating Parameters specifications.

## Repository Structure

```
Prompt_flow/
├── apps/
│   ├── api/                    # Express API server
│   │   └── src/
│   │       ├── index.ts        # API entry point
│   │       └── routes/         # API routes (ideas, research, runs, health)
│   └── web/                    # Next.js frontend (scaffold)
├── packages/
│   ├── core/                   # Zod schemas and validation
│   │   └── src/
│   │       ├── schemas/        # IdeaCard, ResearchPacket, Evidence, DecisionBrief
│   │       └── validation/     # LLM output validation with retry
│   ├── database/               # Drizzle ORM with PostgreSQL
│   │   └── src/
│   │       ├── models/         # Database schema
│   │       ├── migrations/     # SQL migrations
│   │       └── repositories/   # Data access layer
│   ├── llm-client/             # LLM abstraction layer
│   │   └── src/
│   │       └── providers/      # OpenAI and Anthropic implementations
│   ├── retriever/              # External data sources
│   │   └── src/
│   │       └── sources/        # FMP, Polygon, SEC EDGAR clients
│   ├── shared/                 # Common utilities and constants
│   │   └── src/
│   │       └── constants/      # Operating parameters
│   └── worker/                 # Background job processing
│       └── src/
│           ├── agents/         # 7 research agents for Lane B
│           ├── jobs/           # Job scheduler
│           └── orchestrator/   # DAG runners for Lane A, B, IC Bundle
├── package.json                # Root package.json
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── tsconfig.json               # Root TypeScript configuration
```

## Database Schema

The PostgreSQL schema includes the following tables:

| Table | Description |
|-------|-------------|
| `ideas` | IdeaCards from Lane A discovery |
| `research_packets` | Deep research from Lane B |
| `evidence` | Supporting evidence for ideas |
| `runs` | Audit trail for DAG executions |
| `novelty_state` | Tracks idea novelty for filtering |
| `style_mix_state` | Tracks style distribution quotas |
| `security_master` | Reference data for securities |

## Lane A: Daily Discovery Run

**Schedule:** 06:00 UTC daily

**DAG Nodes:**
1. `fetch_universe` - Retrieves tickers from FMP screener
2. `generate_ideas` - LLM generates IdeaCards from company data
3. `run_gates` - Applies 5 gates (data_sufficiency, coherence, edge_claim, downside_shape, style_fit)
4. `score_and_rank` - Calculates weighted scores per Operating Parameters
5. `novelty_filter` - Applies novelty decay and repetition penalty
6. `style_mix_adjust` - Adjusts rankings based on style quotas
7. `select_top_n` - Selects top ideas (default: 120)
8. `persist_inbox` - Saves to database
9. `notify_user` - Sends notification

**Scoring Weights:**
- Edge Clarity: 20%
- Business Quality Prior: 15%
- Financial Resilience Prior: 15%
- Valuation Tension: 15%
- Catalyst Clarity: 10%
- Information Availability: 10%
- Complexity Penalty: -10%
- Disclosure Friction Penalty: -5%

## Lane B: Deep Research Run

**Schedule:** 07:00 UTC daily (after Lane A)

**DAG Nodes:**
1. `fetch_promoted_ideas` - Gets ideas promoted from Lane A
2. `parallel_research` - Runs 7 research agents in parallel
3. `assemble_packets` - Synthesizes modules into coherent packets
4. `generate_decision_briefs` - Creates IC-ready briefs
5. `persist_packets` - Saves to database
6. `notify_user` - Sends notification

**Research Agents:**
1. **Business Model Agent** - Unit economics, revenue model, scalability
2. **Industry & Moat Agent** - Competitive position, moat durability
3. **Financial Forensics Agent** - Earnings quality, cash conversion
4. **Capital Allocation Agent** - M&A track record, ROIC trends
5. **Management Quality Agent** - Track record, alignment, governance
6. **Valuation Agent** - DCF, comps, fair value range
7. **Risk & Stress Agent** - Key risks, stress testing

## IC Bundle: Weekly Summary

**Schedule:** 08:00 UTC every Friday

**DAG Nodes:**
1. `fetch_weekly_data` - Gets packets and ideas from the week
2. `generate_market_context` - LLM generates market context
3. `assemble_bundle` - Creates comprehensive IC document
4. `persist_bundle` - Saves bundle
5. `notify_user` - Sends notification

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/ideas/inbox` | GET | Get daily idea inbox |
| `/api/ideas/:ideaId` | GET | Get idea by ID |
| `/api/ideas/ticker/:ticker` | GET | Get ideas by ticker |
| `/api/ideas/status/:status` | GET | Get ideas by status |
| `/api/ideas/:ideaId/status` | PATCH | Update idea status |
| `/api/ideas/promote` | POST | Promote ideas to Lane B |
| `/api/research/packets/:packetId` | GET | Get research packet |
| `/api/research/packets/idea/:ideaId` | GET | Get packet by idea |
| `/api/runs/:runId` | GET | Get run by ID |
| `/api/runs/trigger/:jobName` | POST | Trigger job manually |

## Schema Validation

All LLM outputs are validated using Zod schemas with automatic retry:

1. Parse LLM response as JSON
2. Validate against Zod schema
3. If validation fails, send error feedback to LLM
4. Retry up to 3 times with fix prompts
5. Return validated data or throw error

## Configuration

Environment variables (see `.env.example`):

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
FMP_API_KEY=...
POLYGON_API_KEY=...
```

## Next Steps

1. **Install dependencies:** `pnpm install`
2. **Run migrations:** `pnpm db:migrate`
3. **Start API:** `pnpm dev:api`
4. **Run discovery:** `pnpm worker discovery`
5. **Run Lane B:** `pnpm worker lane-b`

## Operating Parameters Compliance

| Parameter | Value | Implementation |
|-----------|-------|----------------|
| Lane A daily limit | 120 | `LANE_A_DAILY_LIMIT` constant |
| Lane B daily limit | 5 | `LANE_B_DAILY_LIMIT` constant |
| Lane B weekly limit | 15 | `LANE_B_WEEKLY_LIMIT` constant |
| Novelty decay days | 30 | `NOVELTY_DECAY_DAYS` constant |
| Style mix targets | 40/40/20 | `STYLE_MIX_TARGETS` constant |
| Promotion threshold | 0.70 | `PROMOTION_THRESHOLDS` constant |
