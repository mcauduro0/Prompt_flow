# ARC Investment Factory - Test Plan

**Version:** 1.0
**Date:** 2026-01-12
**Author:** Manus AI

---

## Executive Summary

Este documento define o plano de teste completo para validar a execução dos 116 prompts do sistema ARC Investment Factory, garantindo que:

1. **Dados Reais** são utilizados (FMP, Polygon, SEC, etc.)
2. **LLMs Reais** são chamados (OpenAI GPT-4, Anthropic Claude, Perplexity Sonar)
3. **Outputs Reais** são gerados e validados
4. **Telemetria Real** é registrada

---

## Test Environment

### Data Providers

| Provider | API Key | Status | Uso |
|----------|---------|--------|-----|
| FMP (Financial Modeling Prep) | `FMP_API_KEY` | ✅ Configurado | Fundamentals, Screening |
| Polygon.io | `POLYGON_API_KEY` | ✅ Configurado | Prices, News |
| OpenAI | `OPENAI_API_KEY` | ✅ Configurado | GPT-4, GPT-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | ✅ Configurado | Claude-3-Opus |
| Google | `GEMINI_API_KEY` | ✅ Configurado | Gemini 2.5 Flash |
| Perplexity | `SONAR_API_KEY` | ✅ Configurado | Sonar-Pro |

### Test Tickers

Para garantir consistência, usaremos os seguintes tickers em todos os testes:

| Ticker | Company | Sector | Market Cap |
|--------|---------|--------|------------|
| AAPL | Apple Inc. | Technology | Large Cap |
| MSFT | Microsoft Corp. | Technology | Large Cap |
| FAST | Fastenal Company | Industrials | Mid Cap |
| TGT | Target Corporation | Consumer | Mid Cap |
| CBRE | CBRE Group | Real Estate | Mid Cap |

---

## Test Structure

### Test Categories

1. **Unit Tests** - Testa cada prompt individualmente
2. **Integration Tests** - Testa fluxo completo do lane
3. **E2E Tests** - Testa pipeline completo (Lane A → Promotion → Lane B)
4. **Validation Tests** - Valida qualidade dos outputs

### Test Metrics

| Métrica | Descrição | Threshold |
|---------|-----------|-----------|
| `execution_success` | Prompt executou sem erro | 100% |
| `llm_called` | LLM real foi chamado | 100% |
| `data_real` | Dados reais foram usados | 100% |
| `output_valid` | Output tem estrutura esperada | 95% |
| `latency_ms` | Tempo de execução | < 30000ms |
| `tokens_used` | Tokens consumidos | > 0 |

---

## Lane A Test Plan (42 prompts)

### Stage: Macro Context (16 prompts)

Estes prompts analisam o contexto macroeconômico e devem executar **sem dependências**.

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `macro_environment_analysis` | Current date | regime, key_themes, sector_implications | gpt-4 |
| 2 | `fed_policy_analysis` | Current date | policy_stance, rate_outlook, market_impact | gpt-4 |
| 3 | `inflation_analysis` | Current date | inflation_trend, components, outlook | gpt-4 |
| 4 | `yield_curve_analysis` | Current date | curve_shape, inversion_status, implications | gpt-4 |
| 5 | `credit_cycle_analysis` | Current date | cycle_phase, spreads, default_outlook | gpt-4 |
| 6 | `liquidity_conditions_analysis` | Current date | liquidity_level, fed_balance_sheet, repo_rates | gpt-4 |
| 7 | `market_regime_analysis` | Current date | regime, volatility, correlation | gpt-4 |
| 8 | `sector_sensitivity_analysis` | Current date | sector_rankings, rate_sensitivity | gpt-4 |
| 9 | `geopolitical_risk_analysis` | Current date | risk_factors, affected_sectors | gpt-4 |
| 10 | `election_impact_analysis` | Current date | policy_scenarios, sector_winners_losers | gpt-4 |
| 11 | `china_macro_analysis` | Current date | gdp_outlook, policy, us_exposure | gpt-4 |
| 12 | `commodity_analysis` | Current date | price_trends, supply_demand, outlook | gpt-4 |
| 13 | `currency_analysis` | Current date | dxy_trend, major_pairs, implications | gpt-4 |
| 14 | `global_macro_scan` | Current date | global_summary, regional_outlook | gpt-4 |
| 15 | `earnings_season_preview` | Current date | expectations, key_reports, themes | gpt-4 |
| 16 | `economic_indicator_analysis` | Current date | gdp, employment, pmi, consumer | gpt-4 |

**Test Validation:**
```json
{
  "required_fields": ["analysis", "outlook", "confidence"],
  "min_length": 500,
  "max_latency_ms": 30000
}
```

### Stage: Signal Collection (9 prompts)

Estes prompts coletam sinais de fontes alternativas.

| # | Prompt ID | Test Input | Data Source | LLM |
|---|-----------|------------|-------------|-----|
| 1 | `social_sentiment_scanner` | AAPL, MSFT | SocialTrends | gpt-4 |
| 2 | `insider_trading_analysis` | AAPL | SEC EDGAR | gpt-4 |
| 3 | `institutional_clustering_13f` | - | SEC 13F | gpt-4 |
| 4 | `newsletter_idea_scraping` | - | RSS/Web | sonar-pro |
| 5 | `niche_publication_scanner` | - | Web | sonar-pro |
| 6 | `reddit_memestock_scraper` | - | Reddit | code |
| 7 | `substack_idea_scraping` | - | Substack | sonar-pro |
| 8 | `twitter_copytrading_scraper` | - | SocialTrends | code |
| 9 | `deep_web_trend_scanner` | - | Multiple | sonar-pro |

**Test Validation:**
```json
{
  "required_fields": ["signals", "tickers", "sentiment"],
  "min_signals": 1
}
```

### Stage: Screening (8 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `thematic_idea_generator` | "AI Infrastructure" | candidates[], theme_analysis | gpt-4 |
| 2 | `pure_play_filter` | candidates[] | filtered_candidates[] | code |
| 3 | `thematic_candidate_screen` | theme, universe | ranked_candidates[] | gpt-4 |
| 4 | `under_radar_discovery` | sector | hidden_gems[] | claude-3-opus |
| 5 | `identify_pure_plays` | theme | pure_plays[] | gpt-4 |
| 6 | `connecting_disparate_trends` | trends[] | connections[], opportunities | gpt-4 |
| 7 | `theme_order_effects` | theme | second_order_effects[] | gpt-4 |
| 8 | `theme_subsector_expansion` | theme | subsectors[], companies[] | gpt-4 |

### Stage: Analysis (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `competitive_landscape_mapping` | FAST | competitors[], market_share | gpt-4 |
| 2 | `historical_parallel_finder` | FAST | historical_parallels[] | gpt-4 |

### Stage: Discovery (5 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `trend_to_equity_mapper` | "Electric Vehicles" | equity_plays[] | gpt-4 |
| 2 | `value_chain_mapper` | AAPL | value_chain, opportunities | gpt-4 |
| 3 | `historical_parallel_stress_test` | FAST, parallel | stress_test_results | gpt-4 |
| 4 | `sector_thesis_stress_test` | Technology | stress_scenarios[] | gpt-4 |
| 5 | `investment_presentation_creator` | FAST, research | presentation_slides[] | gpt-4 |

### Stage: Market Analysis (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `earnings_season_analyzer` | Q4 2025 | summary, surprises, trends | gpt-4 |
| 2 | `sector_momentum_ranker` | - | sector_rankings[] | gpt-4 |

---

## Lane B Test Plan (44 prompts)

Lane B executa **após promoção manual** de uma ideia do Lane A.

### Test Prerequisites

```json
{
  "promoted_idea": {
    "ticker": "FAST",
    "company_name": "Fastenal Company",
    "thesis": "Quality compounder with strong ROIC",
    "conviction": 8,
    "source": "Lane A - thematic_idea_generator"
  }
}
```

### Stage: Business Analysis (6 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `business_overview_report` | FAST | business_description, model, position | gpt-4 |
| 2 | `business_economics` | FAST | unit_economics, operating_leverage | gpt-4 |
| 3 | `customer_analysis` | FAST | customer_segments, concentration | gpt-4 |
| 4 | `supply_chain_analysis` | FAST | suppliers, risks, dependencies | gpt-4 |
| 5 | `technology_ip_analysis` | FAST | tech_stack, patents, moat | gpt-4 |
| 6 | `geographic_analysis` | FAST | geographic_mix, expansion | gpt-4 |

### Stage: Financial Analysis (10 prompts)

| # | Prompt ID | Test Input | Data Source | LLM |
|---|-----------|------------|-------------|-----|
| 1 | `financial_statement_analysis` | FAST | FMP Financials | gpt-4 |
| 2 | `valuation_analysis` | FAST | FMP + Polygon | gpt-4 |
| 3 | `earnings_quality_analysis` | FAST | FMP Financials | gpt-4 |
| 4 | `capital_allocation_analysis` | FAST | FMP Financials | gpt-4 |
| 5 | `growth_margin_drivers` | FAST | FMP Financials | gpt-4 |
| 6 | `debt_structure_analysis` | FAST | FMP Financials | gpt-4 |
| 7 | `working_capital_analysis` | FAST | FMP Financials | gpt-4 |
| 8 | `segment_analysis` | FAST | FMP Financials | gpt-4 |
| 9 | `ma_history_analysis` | FAST | FMP + News | gpt-4 |
| 10 | `capital_structure_optimizer` | FAST | FMP Financials | code |

### Stage: Industry Analysis (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `competitive_analysis` | FAST | competitors, positioning | gpt-4 |
| 2 | `industry_overview` | Industrial Distribution | industry_dynamics | gpt-4 |
| 3 | `tam_sam_som_analyzer` | FAST | market_size, share | gpt-4 |

### Stage: Management Analysis (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `management_quality_assessment` | FAST | management_score, track_record | gpt-4 |
| 2 | `ceo_track_record` | FAST | ceo_history, performance | gpt-4 |

### Stage: Risk Analysis (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `risk_assessment` | FAST | risk_factors[], mitigants | gpt-4 |
| 2 | `risk_factor_identifier` | FAST | categorized_risks | gpt-4 |
| 3 | `regulatory_risk_analysis` | FAST | regulatory_exposure | gpt-4 |

### Stage: Catalyst Analysis (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `catalyst_identification` | FAST | catalysts[], timeline | gpt-4 |
| 2 | `insider_activity_analysis` | FAST | insider_transactions | gpt-4 |

### Stage: Thesis Development (6 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `investment_thesis_synthesis` | FAST research | thesis, conviction | gpt-4 |
| 2 | `bull_bear_analysis` | FAST | bull_case, bear_case, base_case | gpt-4 |
| 3 | `variant_perception` | FAST | consensus_view, variant_view | claude-3-opus |
| 4 | `contrarian_thesis_development` | FAST | contrarian_angle | claude-3-opus |
| 5 | `peer_thesis_comparison` | FAST | peer_comparison | gpt-4 |
| 6 | `pre_mortem_analysis` | FAST | failure_scenarios | claude-3-opus |

### Stage: Synthesis & Output (4 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `bull_bear_case_generator` | FAST | scenarios[] | gpt-4 |
| 2 | `investment_memo` | FAST research | memo_document | gpt-4 |
| 3 | `thesis_presentation` | FAST research | presentation | gpt-4 |
| 4 | `earnings_preview_generator` | FAST | earnings_preview | gpt-4 |

### Stage: Special Situations (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `activist_situation_analyzer` | - | activist_opportunities | claude-3-opus |
| 2 | `ipo_analysis` | Recent IPO | ipo_assessment | gpt-4 |
| 3 | `spinoff_opportunity_analyzer` | - | spinoff_opportunities | claude-3-opus |

### Stage: Execution & Monitoring (5 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `exit_strategy` | FAST position | exit_plan | gpt-4 |
| 2 | `thesis_update` | FAST, new_data | updated_thesis | gpt-4 |
| 3 | `thesis_monitoring_framework` | FAST | monitoring_checklist | gpt-4 |
| 4 | `short_interest_analysis` | FAST | short_data, implications | gpt-4 |
| 5 | `esg_analysis` | FAST | esg_score, factors | gpt-4 |

---

## Portfolio Test Plan (21 prompts)

Portfolio prompts executam **independentemente** dos lanes.

### Stage: Construction (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `portfolio_construction` | ideas[], constraints | portfolio_weights | gpt-4 |
| 2 | `position_sizer` | idea, portfolio | position_size | code |
| 3 | `position_sizing` | idea, risk_params | sizing_recommendation | gpt-4 |

### Stage: Risk Management (8 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `risk_monitoring` | portfolio | risk_metrics | gpt-4 |
| 2 | `correlation_analysis` | portfolio | correlation_matrix | code |
| 3 | `factor_exposure_analysis` | portfolio | factor_exposures | gpt-4 |
| 4 | `factor_exposure_analyzer` | portfolio | detailed_factors | code |
| 5 | `scenario_analysis` | portfolio | scenario_results | gpt-4 |
| 6 | `benchmark_comparison` | portfolio | vs_benchmark | gpt-4 |
| 7 | `drawdown_analysis` | portfolio | drawdown_stats | code |
| 8 | `liquidity_analysis` | portfolio | liquidity_metrics | gpt-4 |

### Stage: Hedging (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `currency_hedging_analysis` | portfolio | hedge_recommendations | gpt-4 |
| 2 | `options_overlay_strategy` | portfolio | options_strategy | gpt-4 |

### Stage: Execution (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `rebalancing_analysis` | portfolio | rebalance_trades | gpt-4 |
| 2 | `transition_management` | old_portfolio, new | transition_plan | gpt-4 |
| 3 | `performance_attribution` | portfolio | attribution_analysis | gpt-4 |

### Stage: Compliance & Tax (3 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `investment_policy_compliance` | portfolio | compliance_check | gpt-4 |
| 2 | `tax_loss_harvesting` | portfolio | harvest_opportunities | code |
| 3 | `income_analysis` | portfolio | income_projection | gpt-4 |

### Stage: Analytics (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `esg_portfolio_analysis` | portfolio | esg_metrics | gpt-4 |
| 2 | `sector_rotation_analysis` | portfolio | rotation_signals | gpt-4 |

---

## Monitoring Test Plan (2 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `portfolio_performance_reporter` | portfolio | performance_report | gpt-4 |
| 2 | `news_sentiment_monitor` | watchlist | sentiment_alerts | gpt-4 |

---

## Utility Test Plan (7 prompts)

| # | Prompt ID | Test Input | Expected Output | LLM |
|---|-----------|------------|-----------------|-----|
| 1 | `research_report_summary` | report_text | summary | gpt-4 |
| 2 | `watchlist_screening` | watchlist | screening_results | gpt-4 |
| 3 | `daily_market_briefing` | date | market_briefing | gpt-4 |
| 4 | `news_sentiment_analysis` | news_items | sentiment_analysis | gpt-4 |
| 5 | `sec_filing_analysis` | filing | filing_summary | gpt-4 |
| 6 | `competitor_earnings_comparison` | ticker, peers | comparison | gpt-4 |
| 7 | `earnings_call_analysis` | transcript | call_analysis | gpt-4 |

---

## Test Execution Strategy

### Phase 1: Smoke Tests (Day 1)

Executar 1 prompt de cada stage para validar infraestrutura:

```bash
# Run smoke tests
pnpm tsx scripts/test-prompts.ts --mode smoke
```

**Prompts selecionados:**
- Lane A: `macro_environment_analysis`, `thematic_idea_generator`
- Lane B: `business_overview_report`, `valuation_analysis`
- Portfolio: `portfolio_construction`
- Monitoring: `news_sentiment_monitor`
- Utility: `daily_market_briefing`

### Phase 2: Lane A Full Test (Day 2)

Executar todos os 42 prompts do Lane A:

```bash
pnpm tsx scripts/test-prompts.ts --lane lane_a
```

### Phase 3: Lane B Full Test (Day 3)

Executar todos os 44 prompts do Lane B:

```bash
pnpm tsx scripts/test-prompts.ts --lane lane_b
```

### Phase 4: Portfolio & Others (Day 4)

Executar Portfolio, Monitoring e Utility:

```bash
pnpm tsx scripts/test-prompts.ts --lane portfolio
pnpm tsx scripts/test-prompts.ts --lane monitoring
pnpm tsx scripts/test-prompts.ts --lane utility
```

### Phase 5: E2E Integration Test (Day 5)

Executar pipeline completo:

```bash
pnpm tsx scripts/test-e2e-pipeline.ts
```

---

## Validation Criteria

### Per-Prompt Validation

```typescript
interface PromptTestResult {
  prompt_id: string;
  status: 'pass' | 'fail' | 'skip';
  
  // Execution metrics
  execution_time_ms: number;
  tokens_used: number;
  cost_usd: number;
  
  // Validation checks
  llm_called: boolean;
  data_source_used: string[];
  output_valid: boolean;
  output_schema_match: boolean;
  
  // Quality metrics
  output_length: number;
  confidence_score?: number;
  
  // Errors
  error?: string;
}
```

### Aggregated Validation

| Metric | Target | Minimum |
|--------|--------|---------|
| Overall Pass Rate | 100% | 95% |
| LLM Call Rate | 100% | 100% |
| Real Data Usage | 100% | 100% |
| Output Validity | 100% | 95% |
| Avg Latency | < 15s | < 30s |

---

## Test Reports

### Per-Run Report

```json
{
  "run_id": "uuid",
  "timestamp": "2026-01-12T12:00:00Z",
  "environment": "production",
  "summary": {
    "total_prompts": 116,
    "passed": 114,
    "failed": 2,
    "skipped": 0,
    "pass_rate": "98.3%"
  },
  "by_lane": {
    "lane_a": { "total": 42, "passed": 42 },
    "lane_b": { "total": 44, "passed": 42 },
    "portfolio": { "total": 21, "passed": 21 },
    "monitoring": { "total": 2, "passed": 2 },
    "utility": { "total": 7, "passed": 7 }
  },
  "metrics": {
    "total_tokens": 125000,
    "total_cost_usd": 2.50,
    "avg_latency_ms": 8500,
    "total_duration_min": 45
  },
  "failures": [
    {
      "prompt_id": "activist_situation_analyzer",
      "error": "No activist situations found",
      "severity": "low"
    }
  ]
}
```

---

## Appendix: Test Data Requirements

### FMP Data Required

- Company profiles (5 tickers)
- Financial statements (3 years)
- Key metrics TTM
- Stock screener results

### Polygon Data Required

- Latest prices (5 tickers)
- News articles (last 7 days)
- Historical prices (1 year)

### Mock Data (for code-based prompts)

- Sample portfolio (10 positions)
- Sample watchlist (20 tickers)
- Sample research report text

---

## Next Steps

1. **Create test script** (`scripts/test-prompts.ts`)
2. **Run smoke tests** to validate infrastructure
3. **Execute full test suite** by lane
4. **Generate test report**
5. **Fix any failing prompts**
6. **Document results**
