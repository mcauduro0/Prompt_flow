# Weekly QA Report - Governance Gap Matrix

## Overview

This document maps the current V5 QA implementation against the governance specification and identifies gaps requiring minimal changes for semantic alignment.

---

## Gap Matrix

### Legend
- ✅ **Implemented as-is** - Fully compliant with spec
- ⚠️ **Partially implemented** - Core logic exists but needs refinement
- ❌ **Missing** - Not implemented, needs addition

---

## Schedule & Timing

| Requirement | Spec | V5 Status | Gap |
|-------------|------|-----------|-----|
| Run time | Friday 18:00 São Paulo | ⚠️ Friday 17:00 | **Change to 18:00** |
| Timezone | America/Sao_Paulo | ✅ | - |
| Lookback | 7 calendar days | ✅ | - |
| Weekday subset | Mon-Fri for cadence | ❌ | **Add weekday filter** |

---

## Data Contract (Schema)

| Requirement | Spec | V5 Status | Gap |
|-------------|------|-----------|-----|
| Zod schema in packages/core | Required | ❌ | **Create QAReportSchema** |
| report_id (uuid) | Required | ✅ report_id | - |
| as_of (timestamp) | Required | ✅ generated_at | - |
| window_start/end | Required | ✅ period_start/end | - |
| overall_status (pass/warn/fail) | Required | ⚠️ healthy/warning/critical | **Rename to pass/warn/fail** |
| overall_score_0_100 | Required | ❌ | **Add scoring** |
| sections array | Required | ❌ | **Restructure to sections** |
| drift_alarms array | Required | ⚠️ alerts[] | **Add DriftAlarm structure** |
| key_metrics object | Required | ⚠️ scattered | **Consolidate** |
| links object | Required | ❌ | **Add links** |

---

## Section A: System Health and Cadence

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| A1: Scheduler cadence | discovery=5, lane_b=5 weekdays | ❌ | **Add run count check** |
| A2: Weekend suppression | 0 runs on Sat/Sun | ❌ | **Add weekend check** |
| A3: Caps and concurrency | lane_a 100-200/day, lane_b ≤10/week | ⚠️ weekly_cap only | **Add daily checks** |
| A4: Error rate | <5% warn, >10% fail | ❌ | **Add error tracking** |

---

## Section B: Novelty-First Behavior

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| B1: Top 30 novelty rate | ≥12/30 avg | ⚠️ new_pct only | **Add top-30 logic** |
| B2: Repetition violations | 0 repeats without whats_new | ❌ | **Add violation check** |
| B3: Reappearance delta quality | ≥80% have delta | ❌ | **Add quality proxy** |

---

## Section C: Gates and Promotion Discipline

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| C1: Gate completeness | 100% have gate_0..4 | ⚠️ pass_rate only | **Add completeness check** |
| C2: Promotion gate integrity | 100% promoted passed all | ❌ | **Add integrity check** |
| C3: Downside gate integrity | 100% passed gate_3 | ⚠️ implicit | **Make explicit** |
| C4: Style fit integrity | 100% passed gate_4 | ⚠️ implicit | **Make explicit** |

---

## Section D: Deep Packet Completeness

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| D1: Completed packets count | ≤10 | ✅ weekly_cap_respected | - |
| D2: Mandatory fields | variant_perception, etc. | ❌ | **Add field checks** |
| D3: Evidence grounding rate | ≥90% with locators | ⚠️ coverage_pct | **Align threshold** |
| D4: Open questions quality | ≥80% have why/how | ❌ | **Add quality check** |

---

## Section E: Memory and Versioning

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| E1: Immutable thesis versioning | 100% increment | ❌ | **Add version check** |
| E2: Rejection shadow enforcement | ≥80% have shadow | ❌ | **Add shadow check** |

---

## Section F: Global Universe Coverage

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| F1: Universe coverage rate | ≥90% | ⚠️ coverage_gaps | **Add rate metric** |
| F2: Non-US share in inbox | ≥30% | ❌ | **Add region check** |
| F3: Non-US retrieval success | ≥80% | ❌ | **Add retrieval check** |

---

## Section G: Operator Usability

| Check | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| G1: UI workflow integrity | API/DB verify | ❌ | **Add smoke test** |

---

## Drift Alarms

| Alarm | Spec | V5 Status | Gap |
|-------|------|-----------|-----|
| Alarm 1: Novelty collapse | B1 avg <8 → fail | ⚠️ alerts[] | **Add structured alarm** |
| Alarm 2: Promotion gate breach | any failed gate → fail | ❌ | **Add alarm** |
| Alarm 3: Weekly packet cap | >10 → fail | ⚠️ compliance_checks | **Add alarm** |
| Alarm 4: Evidence grounding collapse | D3 <80% → fail | ⚠️ alerts[] | **Add alarm** |
| Alarm 5: Global coverage collapse | F1 <80% → fail | ❌ | **Add alarm** |

---

## Scoring

| Requirement | Spec | V5 Status | Gap |
|-------------|------|-----------|-----|
| Section scores 0-100 | pass=100, warn=70, fail=0 | ❌ | **Add scoring** |
| Weighted overall score | A:15, B:20, C:15, D:25, E:10, F:10, G:5 | ❌ | **Add weights** |
| Overall status logic | fail if any fail alarm | ⚠️ determineOverallHealth | **Align logic** |

---

## Storage & UI

| Requirement | Spec | V5 Status | Gap |
|-------------|------|-----------|-----|
| Insert into runs table | run_type=weekly_qa_report | ❌ | **Add DB insert** |
| JSON to qa_reports/date.json | Required | ✅ saveToFile | - |
| UI: Most recent at top | Required | ✅ | - |
| UI: Last 8 reports | Required | ⚠️ shows all | **Limit to 8** |
| UI: Week-over-week diff | Required | ❌ | **Add diff view** |
| Email notification | Optional | ❌ | Deferred |

---

## Summary of Required Changes

### Priority 1: Schema Alignment (packages/core)
1. Create `QAReportSchema.ts` with Zod validation
2. Define `QASection`, `QACheck`, `DriftAlarm` types
3. Change status enum from `healthy/warning/critical` to `pass/warn/fail`

### Priority 2: Section Structure (weekly-qa-report.ts)
1. Restructure report to use `sections[]` array
2. Add `overall_score_0_100` with weighted calculation
3. Add `drift_alarms[]` array with structured alarms
4. Add `key_metrics` and `links` objects

### Priority 3: Missing Checks
1. A1-A4: System health checks (scheduler cadence, weekend suppression, caps, errors)
2. B2-B3: Novelty violation and delta quality checks
3. C1-C4: Gate completeness and integrity checks
4. D2, D4: Packet field and quality checks
5. E1-E2: Versioning and shadow checks
6. F1-F3: Universe coverage checks
7. G1: Usability smoke test

### Priority 4: UI Enhancements
1. Show sections with pass/warn/fail status
2. Add week-over-week diff view
3. Limit report history to 8

### Priority 5: Timing Fix
1. Change schedule from 17:00 to 18:00

---

## Implementation Plan

**Minimal changes only** - preserve existing V5 code structure:

1. **Create Zod schema** in `packages/core/src/schemas/qa-report.schema.ts`
2. **Update types** in `weekly-qa-report.ts` to match schema
3. **Add missing checks** as new methods in `WeeklyQAReportGenerator`
4. **Add drift alarms** with structured format
5. **Add scoring logic** with section weights
6. **Update scheduler** timing to 18:00
7. **Update UI** to show sections and diff view

---

## Alignment Summary (Post-Implementation)

### Files Modified

| File | Change |
|------|--------|
| `packages/core/src/schemas/qa-report.schema.ts` | **NEW** - Zod schema per governance spec |
| `packages/core/src/schemas/index.ts` | Added export for qa-report.schema |
| `packages/worker/src/jobs/weekly-qa-report.ts` | **REWRITTEN** - Sections A-G, drift alarms, scoring |
| `packages/worker/src/jobs/scheduler.ts` | Updated QA to 18:00, IC Bundle to 19:00 |
| `apps/web/src/app/qa/page.tsx` | **REWRITTEN** - Sections, diff view, 8-report limit |

### Gaps Closed

| Gap | Status |
|-----|--------|
| Schedule 18:00 | ✅ Closed |
| Zod schema in core | ✅ Closed |
| Status enum pass/warn/fail | ✅ Closed |
| overall_score_0_100 | ✅ Closed |
| sections[] array (7) | ✅ Closed |
| drift_alarms[] array (5) | ✅ Closed |
| key_metrics object | ✅ Closed |
| links object | ✅ Closed |
| Section A checks (A1-A4) | ✅ Closed |
| Section B checks (B1-B3) | ✅ Closed |
| Section C checks (C1-C4) | ✅ Closed |
| Section D checks (D1-D4) | ✅ Closed |
| Section E checks (E1-E2) | ✅ Closed |
| Section F checks (F1-F3) | ✅ Closed |
| Section G checks (G1) | ✅ Closed |
| Section weights | ✅ Closed |
| UI: Last 8 reports | ✅ Closed |
| UI: Week-over-week diff | ✅ Closed |

### Remaining Items (Deferred)

| Item | Reason |
|------|--------|
| Email notification | Optional per spec, config flag provided |
| Insert into runs table | Requires DB connection in production |
| Universe coverage from security master | Requires integration with retriever |

### Governance Lock Status

The Weekly QA Report is now aligned with the governance specification and should be treated as a **locked governance layer**.

**Locked Components:**
- `QAReportSchema` - Zod schema in packages/core
- `QA_THRESHOLDS` - All check thresholds
- `SECTION_WEIGHTS` - Scoring weights
- `DRIFT_ALARM_DEFINITIONS` - 5 alarm definitions
- Schedule: Friday 18:00 America/Sao_Paulo
