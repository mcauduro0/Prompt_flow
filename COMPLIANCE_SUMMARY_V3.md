# ARC Investment Factory - Compliance Summary V3

## Overview

This document summarizes all compliance fixes implemented to align the codebase with the Operating Parameters specification.

---

## Priority 1: Build Correctness ✅

### Monorepo Structure
- **Turborepo** with pnpm workspaces
- All packages properly export their modules
- TypeScript configuration unified across packages

### Unit Tests for Locked Parameters
**File:** `packages/shared/src/__tests__/locked-parameters.test.ts`

Tests verify:
- Timezone is `America/Sao_Paulo`
- Lane A schedule is `0 6 * * 1-5` (06:00 Mon-Fri)
- Lane B schedule is `0 8 * * 1-5` (08:00 Mon-Fri)
- IC Bundle schedule is `0 8 * * 5` (08:00 Fridays)
- Lane A daily limit is 120
- Lane B weekly cap is 10
- Novelty new threshold is 90 days
- Novelty penalty window is 30 days

---

## Priority 2: Lane A Compliance ✅

### Global Universe Fetch
**File:** `packages/worker/src/orchestrator/daily-discovery.ts`

```typescript
// Fetches from multiple exchanges, not just US
const exchanges = ['NYSE', 'NASDAQ', 'LSE', 'TSE', 'HKEX', 'EURONEXT', 'ASX'];
```

### Novelty Shortlist BEFORE LLM Generation
**DAG Order:**
1. `fetch_universe` - Get all securities
2. `compute_novelty_shortlist` - Filter by novelty FIRST (90-day new, 30-day penalty)
3. `generate_ideas` - LLM generation only on shortlisted securities
4. `run_gates` - Apply 5 gates
5. `score_and_rank` - Score passing ideas
6. `persist_inbox` - Save to database

### Gates 3 & 4 Enforced
```typescript
// Gate 3: edge_claim - Must have clear, testable edge
// Gate 4: downside_shape - Must have defined downside scenario

if (!passesGate3(idea) || !passesGate4(idea)) {
  // Record rejection shadow
  await recordRejectionShadow(idea, failedGate);
}
```

---

## Priority 3: Lane B Compliance ✅

### Weekly Cap Enforcement
**File:** `packages/worker/src/orchestrator/lane-b-runner.ts`

```typescript
const LANE_B_WEEKLY_CAP = 10;

async function checkWeeklyQuota(): Promise<number> {
  const weekStart = getWeekStart();
  const packetsThisWeek = await countPacketsSince(weekStart);
  return LANE_B_WEEKLY_CAP - packetsThisWeek;
}
```

### Completion Check Before Persisting
**File:** `packages/core/src/validation/research-packet-completion.ts`

Mandatory fields:
- All 7 research modules completed
- Bull/Base/Bear scenarios with probabilities summing to 1.0
- Decision brief with verdict and conviction
- At least 3 key risks identified
- At least 2 catalysts identified

### Immutable Versioning
```typescript
// New row for each version, never update existing
async function persistPacket(packet: ResearchPacket): Promise<void> {
  const newVersion = (await getLatestVersion(packet.idea_id)) + 1;
  await db.insert(researchPackets).values({
    ...packet,
    version: newVersion,
    created_at: new Date(),
  });
}
```

---

## Priority 4: Evidence Traceability ✅

### Numeric Claim Grounding
**File:** `packages/core/src/validation/evidence-traceability.ts`

Every numeric claim must have:
- Source citation (e.g., "10-K 2023", "Earnings Call Q3")
- Date of source
- Exact quote or calculation method

```typescript
interface GroundedClaim {
  claim: string;
  value: number;
  unit: string;
  source: {
    type: 'filing' | 'earnings_call' | 'press_release' | 'data_provider';
    name: string;
    date: string;
    quote?: string;
  };
}
```

---

## Priority 5: Scheduler Compliance ✅

### Timezone: America/Sao_Paulo
**File:** `packages/worker/src/jobs/scheduler.ts`

```typescript
const SYSTEM_TIMEZONE = 'America/Sao_Paulo';

function getCurrentTimeInSaoPaulo(): Date {
  const now = new Date();
  const saoPauloTime = now.toLocaleString('en-US', { timeZone: SYSTEM_TIMEZONE });
  return new Date(saoPauloTime);
}
```

### Weekday-Only Schedules
```typescript
const SCHEDULES = {
  LANE_A_CRON: '0 6 * * 1-5',    // 06:00 Mon-Fri
  LANE_B_CRON: '0 8 * * 1-5',    // 08:00 Mon-Fri
  IC_BUNDLE_CRON: '0 8 * * 5',   // 08:00 Fridays only
};

// Skip execution on weekends
if (job.weekdaysOnly && !isWeekdayInSaoPaulo()) {
  continue;
}
```

---

## Priority 6: UI Screens ✅

### Screen 1: Inbox (Lane A Output)
**File:** `apps/web/src/app/inbox/page.tsx`

Features:
- List of today's ideas from daily_discovery_run
- **Promote** button → moves to Lane B queue
- **Reject** button → requires reason, records rejection shadow
- Expandable details (hypothesis, catalysts, what's new)
- Filter by style tag
- Stats: Total, New, Promoted, Rejected

### Screen 2: Research Queue (Lane B Input)
**File:** `apps/web/src/app/queue/page.tsx`

Features:
- Promoted ideas awaiting deep research
- Queue position
- Status (pending, in_progress, completed, failed)
- Progress bar (agents completed / 7)
- Weekly quota display

### Screen 3: Packets (Lane B Output)
**File:** `apps/web/src/app/packets/page.tsx`

Features:
- Completed research packets
- Version history (immutable)
- Bull/Base/Bear scenarios with probabilities
- Decision brief with verdict and conviction
- All 7 research modules status
- Link to full packet view

### Screen 4: Run History (Audit Trail)
**File:** `apps/web/src/app/runs/page.tsx`

Features:
- All DAG runs with run_id, dag_name, status
- Timing (started, completed, duration)
- Statistics (ideas generated, promoted, packets created)
- Error logs for failed runs
- Filter by DAG type and status

### Screen 5: Settings
**File:** `apps/web/src/app/settings/page.tsx`

Features:
- **Locked Parameters** (read-only):
  - Timezone, schedules, limits, novelty thresholds
- **Configurable Parameters**:
  - LLM provider/model, notification email, dry run mode
- **Manual Triggers**:
  - Run Lane A, Lane B, IC Bundle on demand

---

## File Structure

```
apps/
├── api/                    # Express API
│   └── src/
│       ├── index.ts
│       └── routes/
│           ├── health.ts
│           ├── ideas.ts
│           ├── research.ts
│           └── runs.ts
└── web/                    # Next.js UI
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── inbox/page.tsx      # Screen 1
        │   ├── queue/page.tsx      # Screen 2
        │   ├── packets/page.tsx    # Screen 3
        │   ├── runs/page.tsx       # Screen 4
        │   └── settings/page.tsx   # Screen 5
        ├── components/
        │   ├── navigation.tsx
        │   └── providers.tsx
        └── lib/
            └── utils.ts

packages/
├── core/                   # Schemas & Validation
│   └── src/
│       ├── schemas/
│       │   ├── idea-card.schema.ts
│       │   ├── research-packet.schema.ts
│       │   ├── evidence.schema.ts
│       │   └── decision-brief.schema.ts
│       └── validation/
│           ├── index.ts
│           ├── evidence-traceability.ts
│           └── research-packet-completion.ts
├── database/               # Drizzle ORM
│   └── src/
│       ├── models/schema.ts
│       ├── migrations/
│       └── repositories/
├── llm-client/             # OpenAI + Anthropic
├── retriever/              # FMP, Polygon, SEC EDGAR
├── shared/                 # Constants & Utils
│   └── src/
│       ├── constants/index.ts    # ALL locked parameters
│       └── __tests__/
│           └── locked-parameters.test.ts
└── worker/                 # DAG Orchestration
    └── src/
        ├── orchestrator/
        │   ├── daily-discovery.ts    # Lane A
        │   ├── lane-b-runner.ts      # Lane B
        │   └── ic-bundle.ts
        ├── scoring/
        │   ├── novelty.ts
        │   ├── promotion.ts
        │   └── ranking.ts
        ├── agents/                   # 7 research agents
        └── jobs/
            └── scheduler.ts
```

---

## Locked Parameters Reference

| Parameter | Value | Location |
|-----------|-------|----------|
| Timezone | America/Sao_Paulo | `packages/shared/src/constants/index.ts` |
| Lane A Schedule | 06:00 Mon-Fri | `SCHEDULES.LANE_A_CRON` |
| Lane B Schedule | 08:00 Mon-Fri | `SCHEDULES.LANE_B_CRON` |
| IC Bundle Schedule | 08:00 Fridays | `SCHEDULES.IC_BUNDLE_CRON` |
| Lane A Daily Limit | 120 | `LANE_A_DAILY_LIMIT` |
| Lane B Daily Target | 3 | `LANE_B_DAILY_TARGET` |
| Lane B Daily Max | 4 | `LANE_B_DAILY_MAX` |
| Lane B Weekly Cap | 10 | `LANE_B_WEEKLY_CAP` |
| Novelty New Threshold | 90 days | `NOVELTY_NEW_THRESHOLD_DAYS` |
| Novelty Penalty Window | 30 days | `NOVELTY_PENALTY_WINDOW_DAYS` |

---

## Next Steps

1. **Install dependencies:** `pnpm install`
2. **Set up environment:** `cp .env.example .env` and fill in API keys
3. **Run migrations:** `pnpm db:migrate`
4. **Start development:**
   - API: `pnpm dev:api`
   - Web: `pnpm dev:web`
   - Worker: `pnpm worker discovery --dry-run`
5. **Run tests:** `pnpm test`
