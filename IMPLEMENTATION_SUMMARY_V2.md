# AI Investment Flow - Implementation Summary V2

## Compliance Fixes Applied

This document summarizes all fixes applied to achieve full compliance with the Operating Parameters specification.

---

## 1. Timezone and Schedule Fixes

### Before
- Schedules used UTC timezone
- Lane B limits were incorrect

### After
- **System Timezone**: `America/Sao_Paulo` (Brazil)
- **Daily Discovery (Lane A)**: 06:00 America/Sao_Paulo, weekdays only
- **Daily Lane B**: 07:00 America/Sao_Paulo, weekdays only
- **Weekly IC Bundle**: 08:00 America/Sao_Paulo, Fridays only

### Lane B Limits (Corrected)
| Parameter | Value |
|-----------|-------|
| Daily Promotions Target | 3 |
| Daily Promotions Max | 5 |
| Weekly Deep Packets | 15 |

---

## 2. Novelty Model Implementation

### Correct Logic (90-day/30-day)
```typescript
// Ticker is "new" if not seen in 90 days
TICKER_NEW_IF_NOT_SEEN_DAYS: 90

// Bonus for new tickers
TICKER_NEW_BONUS: 30 points

// Penalty window for repetition
REPETITION_PENALTY_WINDOW_DAYS: 30

// Penalties
SEEN_IN_LAST_30_DAYS_NO_NEW_EDGE_PENALTY: -15 points
SEEN_MORE_THAN_3_TIMES_IN_90_DAYS_PENALTY: -10 points

// Bonuses for changes
NEW_EDGE_TYPE_BONUS: 20 points
STYLE_TAG_CHANGE_BONUS: 10 points
NEW_CATALYST_BONUS: 15 points

// Floor
MIN_NOVELTY_SCORE: 0.05 (5%)
```

### Files Updated
- `packages/shared/src/constants/index.ts` - Novelty scoring constants
- `packages/worker/src/scoring/novelty.ts` - Full novelty calculation module

---

## 3. Promotion Threshold Table

### Style-Specific Logic
| Style | Default Threshold | Reduced Threshold | Condition |
|-------|------------------|-------------------|-----------|
| Default | 70/100 | - | - |
| Quality Compounder | 70/100 | 68/100 | edge_clarity >= 16/20 |
| GARP | 70/100 | 68/100 | edge_clarity >= 16/20 |
| Cigar Butt | 72/100 | 70/100 | downside_protection >= 13/15 |

### Weekly Quota Adjustment
- When style is overweight by >10pp: **+3 to threshold**

### Files Updated
- `packages/worker/src/scoring/promotion.ts` - Full promotion logic

---

## 4. Lane A Flow Order Fix

### CRITICAL: Novelty Shortlist BEFORE LLM Generation

### Before (Wrong)
```
fetch_universe → generate_ideas → run_gates → score_and_rank → 
novelty_filter → style_mix_adjust → select_top_n → persist_inbox
```

### After (Correct)
```
fetch_universe → compute_novelty_shortlist → generate_ideas → 
run_gates → score_and_rank → style_mix_adjust → select_top_n → 
persist_inbox → notify_user
```

### Benefits
1. **Protects novelty intent** - High-novelty tickers get priority
2. **Controls LLM cost** - Only shortlisted tickers go through LLM
3. **Exploration rate** - 10% random exploration maintained

### Files Updated
- `packages/worker/src/orchestrator/daily-discovery-v2.ts` - Corrected DAG

---

## 5. ResearchPacket Completion Criteria

### Mandatory Fields Per Module

| Module | Required Fields |
|--------|-----------------|
| business_model | revenue_model, cost_structure, unit_economics, competitive_position |
| industry_moat | industry_structure, moat_sources, moat_durability, competitive_threats |
| financial_forensics | earnings_quality, accruals_analysis, cash_conversion, red_flags |
| capital_allocation | reinvestment_rate, roic_trend, capital_priorities, shareholder_returns |
| management_quality | track_record, incentive_alignment, capital_allocation_skill, communication_quality |
| valuation | primary_method, secondary_method, key_assumptions, sensitivity_analysis |
| risk_stress | key_risks, stress_scenarios, downside_protection, risk_reward_ratio |

### Completion Requirements
- All 7 modules must be complete
- Decision brief must be present
- Minimum 5 evidence items

### Files Updated
- `packages/core/src/validation/research-packet-completion.ts` - Full validation

---

## 6. Rejection Shadow & What's New Since Last Time

### Rejection Shadow
Tracks prior rejections and whether they block re-submission.

```typescript
interface RejectionShadow {
  rejected_at: Date;
  reason: RejectionReason;
  is_blocking: boolean;
  prior_idea_id?: string;
  notes?: string;
}

// Blocking reasons (cannot re-submit)
- fraud_concern
- regulatory_block
- permanent_impairment
- governance_failure

// Non-blocking reasons (can re-submit with new edge)
- thesis_invalidated
- valuation_no_longer_attractive
- catalyst_expired
- better_opportunity
- insufficient_edge
- data_quality_issues
```

### What's New Since Last Time
Tracks changes that justify re-surfacing a previously seen ticker.

```typescript
interface WhatsNewItem {
  category: 'new_edge_type' | 'style_tag_change' | 'catalyst_emerged' | 
            'valuation_improved' | 'fundamentals_changed' | 'management_change' |
            'regulatory_change' | 'market_conditions' | 'first_time_in_universe' |
            'not_seen_in_90_days';
  description: string;
  evidence?: string;
  detected_at?: Date;
}
```

### Files Updated
- `packages/core/src/schemas/idea-card.schema.ts` - Schema updates
- `packages/database/src/models/schema.ts` - Database columns
- `packages/database/src/migrations/002_add_rejection_shadow_and_whats_new.sql` - Migration

---

## 7. Gate Enforcement

### All 5 Gates Now Enforced

| Gate | Description | Enforcement |
|------|-------------|-------------|
| gate_0_data_sufficiency | Minimum data requirements | STRICT |
| gate_1_coherence | Mechanism/hypothesis ratio | STRICT |
| gate_2_edge_claim | Valid edge type | STRICT |
| gate_3_downside_shape | Leverage limits | **ENFORCED** |
| gate_4_style_fit | Style-specific metrics | **ENFORCED** |

### Gate 3: Downside Shape
- Default max net_debt_to_ebitda: 5x
- Cigar Butt max net_debt_to_ebitda: 7x
- Minimum current_ratio: 0.5

### Gate 4: Style Fit
- Quality Compounder: min EBIT margin 15%, min ROIC 12%
- GARP: max P/E 35x, max EV/EBITDA 20x
- Cigar Butt: max EV/EBITDA 8x, max P/B 1.5x

---

## 8. Immutable Versioning

### IdeaCard Versioning
- Each update creates a new version
- Never overwrite existing ideas
- Version number auto-increments

```sql
ALTER TABLE ideas ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
CREATE INDEX ideas_ticker_version_idx ON ideas (ticker, version DESC);
```

---

## File Summary

### New Files Created
| File | Purpose |
|------|---------|
| `packages/worker/src/scoring/novelty.ts` | Novelty scoring module |
| `packages/worker/src/scoring/promotion.ts` | Promotion threshold logic |
| `packages/worker/src/scoring/ranking.ts` | Idea ranking module |
| `packages/worker/src/scoring/index.ts` | Scoring module exports |
| `packages/worker/src/orchestrator/daily-discovery-v2.ts` | Corrected Lane A DAG |
| `packages/core/src/validation/research-packet-completion.ts` | Packet completion validation |
| `packages/database/src/migrations/002_add_rejection_shadow_and_whats_new.sql` | Database migration |

### Files Updated
| File | Changes |
|------|---------|
| `packages/shared/src/constants/index.ts` | All Operating Parameters constants |
| `packages/core/src/schemas/idea-card.schema.ts` | Rejection shadow, what's new fields |
| `packages/core/src/validation/index.ts` | Export completion module |
| `packages/database/src/models/schema.ts` | New columns for ideas table |
| `packages/worker/src/orchestrator/index.ts` | Export V2 daily discovery |

---

## Compliance Checklist

| Requirement | Status |
|-------------|--------|
| Timezone: America/Sao_Paulo | ✅ |
| Lane B limits: 3 target, 5 max daily, 15 weekly | ✅ |
| Novelty: 90-day new threshold | ✅ |
| Novelty: 30-day penalty window | ✅ |
| Novelty: Shortlist before LLM | ✅ |
| Promotion: Style-specific thresholds | ✅ |
| Promotion: Weekly quota adjustment | ✅ |
| Gates: All 5 enforced | ✅ |
| ResearchPacket: Mandatory fields | ✅ |
| ResearchPacket: Completion criteria | ✅ |
| IdeaCard: Rejection shadow | ✅ |
| IdeaCard: What's new since last time | ✅ |
| IdeaCard: Immutable versions | ✅ |

---

## Next Steps

1. Run database migration:
   ```bash
   pnpm db:migrate
   ```

2. Update scheduler to use V2 daily discovery:
   ```typescript
   import { runDailyDiscoveryV2 } from '@arc/worker';
   ```

3. Test the full pipeline with sample data

4. Configure notification webhooks (email, WhatsApp)
