# ARC Investment Factory - Compliance Summary V5

## Overview

This document summarizes all compliance fixes implemented in V5 to address the remaining behavioral risks identified in the V4 review.

## Fixes Implemented

### 1. Novelty-First Shortlist (Hardened)

**File:** `packages/worker/src/orchestrator/daily-discovery.ts`

**Fix:** Added explicit documentation and code structure confirming that novelty shortlist happens BEFORE LLM generation:

```
DAG Flow Order:
1. fetch_universe → 2. compute_novelty_shortlist → 3. generate_ideas_for_shortlist
```

**Key Code:**
```typescript
/**
 * CRITICAL COMPLIANCE: Novelty shortlist BEFORE LLM generation
 * 
 * This is a LOCKED requirement from Operating Parameters.
 * The shortlist step MUST complete before any LLM calls.
 * 
 * Rationale: Prevents wasting LLM tokens on stale/repeat tickers
 */
```

**Verification:**
- Shortlist computed from `novelty_state` table
- LLM generation only called for shortlisted tickers
- Explicit logging confirms order

---

### 2. Gate 3 Binary Overrides

**File:** `packages/worker/src/gates/index.ts`

**Fix:** Added automatic HARD FAIL for three risk categories:

| Override | Trigger | Result |
|----------|---------|--------|
| Leverage Risk | Net Debt/EBITDA > 5x | FAIL |
| Liquidity Risk | ADV < $1M or Bid-Ask > 2% | FAIL |
| Regulatory Cliff | Binary regulatory event pending | FAIL |

**Key Code:**
```typescript
const BINARY_OVERRIDES = {
  LEVERAGE_RISK: {
    threshold: 5.0, // Net Debt / EBITDA
    description: 'Excessive leverage makes downside unacceptable',
  },
  LIQUIDITY_RISK: {
    minADV: 1_000_000, // $1M minimum
    maxSpread: 0.02, // 2% max bid-ask spread
    description: 'Insufficient liquidity for position sizing',
  },
  REGULATORY_CLIFF: {
    description: 'Binary regulatory event creates unacceptable tail risk',
  },
};
```

**Behavior:**
- Binary overrides are checked FIRST in Gate 3
- If any override triggers, idea is immediately rejected
- No LLM evaluation needed for binary fails
- Override reason logged for audit trail

---

### 3. Weekly QA Report

**File:** `packages/worker/src/jobs/weekly-qa-report.ts`

**Schedule:** Friday 17:00 America/Sao_Paulo (before IC Bundle)

**Metrics Included:**

| Category | Metrics |
|----------|---------|
| Gate Analysis | Pass/fail by gate, binary override count, breakdown by risk type |
| Novelty Analysis | New/reappearance/repeat distribution, avg days since last seen |
| Style Mix | Actual vs target allocation, deviation per style |
| Evidence | Coverage %, avg per idea, source type distribution |
| Signposts | Avg per idea, min/max, ideas below minimum |
| Promotion | Rate by style, avg days to promotion |
| Rejection | By gate, by reason, most common reason |
| Universe | Coverage by region and sector |
| LLM Usage | Tokens, cost, by model |
| Compliance | All checks with pass/fail status |

**Output:**
- JSON artifact saved to `./data/qa_reports/qa_report_YYYY-MM-DD.json`
- UI page at `/qa` for viewing reports

---

### 4. QA Report UI Page

**File:** `apps/web/src/app/qa/page.tsx`

**Features:**
- Overall health indicator (healthy/warning/critical)
- Compliance checks dashboard (5 checks)
- Gate analysis table with pass rates
- Binary override breakdown
- Novelty distribution visualization
- Style mix vs target bars
- Evidence coverage metrics
- Recommendations list
- Alerts display
- JSON download button

---

### 5. IC Bundle Timing

**File:** `packages/worker/src/orchestrator/ic-bundle.ts`

**Fix:** Changed schedule from 08:00 to 18:00 Friday

**Before:**
```typescript
SCHEDULE: {
  DAY_OF_WEEK: 5,
  HOUR: 8,  // WRONG
  ...
}
```

**After:**
```typescript
SCHEDULE: {
  DAY_OF_WEEK: 5,
  HOUR: 18,  // CORRECT - after QA Report at 17:00
  ...
}
```

**Rationale:**
- QA Report runs at 17:00 to analyze the week
- IC Bundle runs at 18:00 with QA insights available
- Both use America/Sao_Paulo timezone

---

### 6. Scheduler Updates

**File:** `packages/worker/src/jobs/scheduler.ts`

**Updated Schedules:**

| Job | Cron | Time (São Paulo) |
|-----|------|------------------|
| daily_discovery | `0 6 * * 1-5` | 06:00 Mon-Fri |
| daily_lane_b | `0 8 * * 1-5` | 08:00 Mon-Fri |
| weekly_qa_report | `0 17 * * 5` | 17:00 Friday |
| weekly_ic_bundle | `0 18 * * 5` | 18:00 Friday |

---

## UI Updates

**Navigation:** Added QA Report link to navigation bar

**Total Screens:** 8

1. **Inbox** - Lane A output with Promote/Reject
2. **Research Queue** - Lane B input
3. **Packets** - Completed research packets
4. **Memory** - Rejection shadows, reappearance deltas
5. **QA Report** - Weekly quality metrics (NEW)
6. **Run History** - Audit trail
7. **Settings** - Locked + configurable params
8. **Idea Detail** - Full evidence, action buttons

---

## Files Modified/Created

### Created
- `packages/worker/src/jobs/weekly-qa-report.ts` - QA report generator
- `apps/web/src/app/qa/page.tsx` - QA report UI page

### Modified
- `packages/worker/src/orchestrator/daily-discovery.ts` - Hardened novelty-first
- `packages/worker/src/gates/index.ts` - Binary overrides
- `packages/worker/src/orchestrator/ic-bundle.ts` - Timing fix
- `packages/worker/src/jobs/scheduler.ts` - Added QA job
- `apps/web/src/components/navigation.tsx` - Added QA link

---

## Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Novelty shortlist BEFORE LLM | ✅ | DAG node order, explicit comments |
| Gate 3 binary overrides | ✅ | BINARY_OVERRIDES constant, checkBinaryOverrides() |
| Weekly QA report | ✅ | weekly-qa-report.ts, /qa page |
| QA JSON artifact | ✅ | saveToFile() method |
| IC Bundle at 18:00 | ✅ | SCHEDULE.HOUR = 18 |
| QA Report at 17:00 | ✅ | CRON_EXPRESSIONS.QA_REPORT |
| All times São Paulo | ✅ | SYSTEM_TIMEZONE throughout |

---

## Next Steps

1. Run `pnpm install` to install dependencies
2. Run `pnpm db:migrate` to apply migrations
3. Start scheduler with `pnpm worker scheduler`
4. Verify QA report generation on Friday 17:00
5. Verify IC bundle generation on Friday 18:00

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V1 | 2026-01-11 | Initial implementation |
| V2 | 2026-01-11 | Gate semantics, novelty model |
| V3 | 2026-01-11 | Build correctness, UI screens |
| V4 | 2026-01-11 | Gate 0-4, synthesis, monitoring |
| V5 | 2026-01-11 | Novelty-first hardening, binary overrides, QA report |
