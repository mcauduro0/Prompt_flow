# ARC Investment Factory – Prompt Catalog (Institutional Version)

**Version:** 2.0.0
**Last Updated:** 2026-01-12
**Total Prompts:** 116

---

## Governança do Prompt Catalog

Esta seção explica como o sistema utiliza os campos institucionais para decisões de execução em produção.

### Como expected_value_score e expected_cost_score são usados pelo orquestrador

O **PromptSelector** utiliza esses scores para otimizar a seleção de prompts dentro das restrições de budget:

1. **expected_value_score** (0.0-1.0): Representa o valor esperado do output para a decisão de investimento. Prompts com score mais alto são priorizados quando há restrições de budget ou tempo.

2. **expected_cost_score** (0.0-1.0): Representa o custo relativo em tokens, latência e uso de fontes externas. O orquestrador usa esse score para estimar consumo de budget antes da execução.

3. **value_cost_ratio**: Calculado automaticamente como `expected_value_score / expected_cost_score`. Prompts com ratio mais alto oferecem melhor retorno por unidade de custo e são preferidos em cenários de budget limitado.

### Como min_signal_dependency influencia execução

O campo **min_signal_dependency** define o nível mínimo de sinal ou convicção necessário para o prompt ser elegível:

- **0.0**: Prompt pode executar sem sinais prévios (ex: gates iniciais, macro scans)
- **0.25-0.50**: Requer sinais básicos de prompts upstream
- **0.50-0.75**: Requer sinais moderados e validação de gates
- **0.75-1.0**: Requer alta convicção e múltiplos sinais confirmados

### Como status_institucional afeta elegibilidade automática

| Status | Comportamento |
|--------|---------------|
| **core** | Sempre executado quando elegível. Essencial para decisão de investimento. |
| **supporting** | Executado conforme budget disponível e sinais. Enriquece análise. |
| **optional** | Executado apenas se budget permitir e houver valor marginal. |
| **experimental** | Em teste. Não crítico para decisão. Pode ser desabilitado. |
| **deprecated** | Mantido por compatibilidade. Não executado automaticamente. |

### Como métricas de qualidade retroalimentam ajustes futuros

O **TelemetryStore** registra métricas de qualidade para cada execução:

1. **lane_outcome**: Resultado final do lane (success, partial, failure)
2. **quality_score**: Score de qualidade do output (0.0-1.0)
3. **actual_cost**: Custo real em tokens e latência

Essas métricas são usadas para:
- Ajustar expected_value_score baseado em performance histórica
- Calibrar expected_cost_score com custos reais observados
- Identificar prompts para promoção (optional → supporting) ou deprecação

---

## Quick Reference Table

| # | Prompt ID | Lane | Category | Value | Cost | Ratio | Dep Type | Status |
|---|-----------|------|----------|-------|------|-------|----------|--------|
| 1 | `business_overview_report` | lane_b | Business Analysis | 0.90 | 0.55 | 1.64 | lane_a_promotion | core |
| 2 | `business_economics` | lane_b | Business Analysis | 0.85 | 0.50 | 1.70 | lane_a_promotion | core |
| 3 | `customer_analysis` | lane_b | Business Analysis | 0.75 | 0.45 | 1.67 | lane_a_promotion | supporting |
| 4 | `segment_analysis` | lane_b | Business Analysis | 0.70 | 0.40 | 1.75 | signal_threshold | supporting |
| 5 | `supply_chain_analysis` | lane_b | Business Analysis | 0.70 | 0.45 | 1.56 | signal_threshold | supporting |
| 6 | `technology_ip_analysis` | lane_b | Business Analysis | 0.70 | 0.45 | 1.56 | signal_threshold | supporting |
| 7 | `geographic_analysis` | lane_b | Business Analysis | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 8 | `catalyst_identification` | lane_b | Catalyst Analysis | 0.85 | 0.50 | 1.70 | lane_a_promotion | core |
| 9 | `insider_activity_analysis` | lane_b | Catalyst Analysis | 0.70 | 0.35 | 2.00 | signal_threshold | supporting |
| 10 | `short_interest_analysis` | lane_b | Catalyst Analysis | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 11 | `trend_to_equity_mapper` | lane_a | Discovery | 0.80 | 0.45 | 1.78 | gate_pass | core |
| 12 | `value_chain_mapper` | lane_a | Discovery | 0.75 | 0.45 | 1.67 | signal_threshold | supporting |
| 13 | `bull_bear_case_generator` | lane_a | Discovery | 0.75 | 0.40 | 1.88 | gate_pass | supporting |
| 14 | `historical_parallel_finder` | lane_a | Discovery | 0.70 | 0.45 | 1.56 | signal_threshold | supporting |
| 15 | `historical_parallel_stress_test` | lane_a | Discovery | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 16 | `sector_momentum_ranker` | lane_a | Discovery | 0.65 | 0.30 | 2.17 | always | supporting |
| 17 | `competitor_earnings_comparison` | lane_a | Discovery | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 18 | `earnings_preview_generator` | lane_a | Discovery | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 19 | `valuation_analysis` | lane_b | Financial Analysis | 1.00 | 0.60 | 1.67 | lane_a_promotion | core |
| 20 | `financial_statement_analysis` | lane_b | Financial Analysis | 0.95 | 0.55 | 1.73 | lane_a_promotion | core |
| 21 | `earnings_quality_analysis` | lane_b | Financial Analysis | 0.85 | 0.50 | 1.70 | lane_a_promotion | core |
| 22 | `capital_allocation_analysis` | lane_b | Financial Analysis | 0.80 | 0.45 | 1.78 | lane_a_promotion | supporting |
| 23 | `growth_margin_drivers` | lane_b | Financial Analysis | 0.80 | 0.45 | 1.78 | lane_a_promotion | supporting |
| 24 | `debt_structure_analysis` | lane_b | Financial Analysis | 0.75 | 0.40 | 1.88 | signal_threshold | supporting |
| 25 | `income_analysis` | lane_b | Financial Analysis | 0.70 | 0.40 | 1.75 | signal_threshold | supporting |
| 26 | `working_capital_analysis` | lane_b | Financial Analysis | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 27 | `ma_history_analysis` | lane_b | Financial Analysis | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 28 | `capital_structure_optimizer` | lane_b | Financial Analysis | 0.60 | 0.30 | 2.00 | signal_threshold | optional |
| 29 | `rebalancing_analysis` | lane_b | Financial Analysis | 0.55 | 0.30 | 1.83 | signal_threshold | optional |
| 30 | `lane_a_idea_generation` | lane_a | Gates | 0.95 | 0.50 | 1.90 | gate_pass | core |
| 31 | `gate_data_sufficiency` | lane_a | Gates | 0.90 | 0.10 | 9.00 | always | core |
| 32 | `gate_coherence` | lane_a | Gates | 0.85 | 0.10 | 8.50 | gate_pass | core |
| 33 | `gate_style_fit` | lane_a | Gates | 0.80 | 0.10 | 8.00 | gate_pass | core |
| 34 | `competitive_analysis` | lane_b | Industry Analysis | 0.90 | 0.55 | 1.64 | lane_a_promotion | core |
| 35 | `industry_overview` | lane_b | Industry Analysis | 0.85 | 0.50 | 1.70 | lane_a_promotion | core |
| 36 | `tam_sam_som_analyzer` | lane_b | Industry Analysis | 0.75 | 0.45 | 1.67 | lane_a_promotion | supporting |
| 37 | `competitive_landscape_mapping` | lane_b | Industry Analysis | 0.70 | 0.40 | 1.75 | signal_threshold | supporting |
| 38 | `sector_rotation_analysis` | lane_b | Industry Analysis | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 39 | `sector_sensitivity_analysis` | lane_b | Industry Analysis | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 40 | `credit_cycle_analysis` | lane_b | Macro Analysis | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 41 | `market_regime_analysis` | lane_b | Macro Analysis | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 42 | `currency_analysis` | lane_b | Macro Analysis | 0.60 | 0.35 | 1.71 | signal_threshold | optional |
| 43 | `commodity_analysis` | lane_b | Macro Analysis | 0.60 | 0.35 | 1.71 | signal_threshold | optional |
| 44 | `liquidity_conditions_analysis` | lane_b | Macro Analysis | 0.60 | 0.35 | 1.71 | signal_threshold | optional |
| 45 | `currency_hedging_analysis` | lane_b | Macro Analysis | 0.55 | 0.30 | 1.83 | signal_threshold | optional |
| 46 | `election_impact_analysis` | lane_b | Macro Analysis | 0.55 | 0.35 | 1.57 | signal_threshold | experimental |
| 47 | `yield_curve_analysis` | lane_b | Macro Analysis | 0.55 | 0.30 | 1.83 | signal_threshold | optional |
| 48 | `macro_environment_analysis` | lane_a | Macro Context | 0.80 | 0.45 | 1.78 | always | core |
| 49 | `fed_policy_analysis` | lane_a | Macro Context | 0.75 | 0.40 | 1.88 | always | supporting |
| 50 | `global_macro_scan` | lane_a | Macro Context | 0.75 | 0.45 | 1.67 | always | supporting |
| 51 | `inflation_analysis` | lane_a | Macro Context | 0.70 | 0.35 | 2.00 | always | supporting |
| 52 | `economic_indicator_analysis` | lane_a | Macro Context | 0.70 | 0.35 | 2.00 | always | supporting |
| 53 | `earnings_season_preview` | lane_a | Macro Context | 0.70 | 0.40 | 1.75 | always | supporting |
| 54 | `earnings_season_analyzer` | lane_a | Macro Context | 0.70 | 0.40 | 1.75 | always | supporting |
| 55 | `china_macro_analysis` | lane_a | Macro Context | 0.65 | 0.40 | 1.62 | always | optional |
| 56 | `management_quality_assessment` | lane_b | Management Analysis | 0.85 | 0.50 | 1.70 | lane_a_promotion | core |
| 57 | `ceo_track_record` | lane_b | Management Analysis | 0.75 | 0.45 | 1.67 | lane_a_promotion | supporting |
| 58 | `esg_analysis` | lane_b | Management Analysis | 0.60 | 0.35 | 1.71 | signal_threshold | optional |
| 59 | `esg_portfolio_analysis` | lane_b | Management Analysis | 0.55 | 0.30 | 1.83 | signal_threshold | optional |
| 60 | `thesis_update` | monitoring | Monitoring | 0.85 | 0.45 | 1.89 | always | core |
| 61 | `earnings_call_analysis` | monitoring | Monitoring | 0.75 | 0.40 | 1.88 | always | supporting |
| 62 | `news_sentiment_monitor` | monitoring | Monitoring | 0.70 | 0.30 | 2.33 | always | supporting |
| 63 | `investment_memo` | lane_b | Output Generation | 0.90 | 0.65 | 1.38 | lane_a_promotion | core |
| 64 | `investment_presentation_creator` | lane_b | Output Generation | 0.85 | 0.60 | 1.42 | lane_a_promotion | supporting |
| 65 | `thesis_presentation` | lane_b | Output Generation | 0.80 | 0.55 | 1.45 | lane_a_promotion | supporting |
| 66 | `research_report_summary` | lane_b | Output Generation | 0.75 | 0.45 | 1.67 | lane_a_promotion | supporting |
| 67 | `portfolio_construction` | portfolio | Portfolio Construction | 0.85 | 0.40 | 2.12 | always | core |
| 68 | `position_sizer` | portfolio | Portfolio Construction | 0.80 | 0.30 | 2.67 | lane_a_promotion | core |
| 69 | `position_sizing` | portfolio | Portfolio Construction | 0.75 | 0.25 | 3.00 | lane_a_promotion | supporting |
| 70 | `portfolio_performance_reporter` | portfolio | Portfolio Construction | 0.70 | 0.30 | 2.33 | always | supporting |
| 71 | `risk_monitoring` | portfolio | Portfolio Risk | 0.80 | 0.30 | 2.67 | always | core |
| 72 | `correlation_analysis` | portfolio | Portfolio Risk | 0.75 | 0.25 | 3.00 | always | supporting |
| 73 | `factor_exposure_analysis` | portfolio | Portfolio Risk | 0.75 | 0.35 | 2.14 | always | supporting |
| 74 | `scenario_analysis` | portfolio | Portfolio Risk | 0.75 | 0.40 | 1.88 | always | supporting |
| 75 | `benchmark_comparison` | portfolio | Portfolio Risk | 0.70 | 0.30 | 2.33 | always | supporting |
| 76 | `drawdown_analysis` | portfolio | Portfolio Risk | 0.70 | 0.25 | 2.80 | always | supporting |
| 77 | `factor_exposure_analyzer` | portfolio | Portfolio Risk | 0.70 | 0.30 | 2.33 | always | supporting |
| 78 | `liquidity_analysis` | portfolio | Portfolio Risk | 0.65 | 0.25 | 2.60 | always | supporting |
| 79 | `risk_assessment` | lane_b | Risk Analysis | 0.95 | 0.55 | 1.73 | lane_a_promotion | core |
| 80 | `risk_factor_identifier` | lane_b | Risk Analysis | 0.80 | 0.45 | 1.78 | lane_a_promotion | supporting |
| 81 | `pre_mortem_analysis` | lane_b | Risk Analysis | 0.75 | 0.45 | 1.67 | lane_a_promotion | supporting |
| 82 | `regulatory_risk_analysis` | lane_b | Risk Analysis | 0.70 | 0.40 | 1.75 | signal_threshold | supporting |
| 83 | `geopolitical_risk_analysis` | lane_b | Risk Analysis | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 84 | `thematic_idea_generator` | lane_a | Screening | 0.85 | 0.50 | 1.70 | always | core |
| 85 | `pure_play_filter` | lane_a | Screening | 0.75 | 0.25 | 3.00 | gate_pass | core |
| 86 | `thematic_candidate_screen` | lane_a | Screening | 0.75 | 0.30 | 2.50 | gate_pass | supporting |
| 87 | `under_radar_discovery` | lane_a | Screening | 0.75 | 0.50 | 1.50 | always | supporting |
| 88 | `watchlist_screening` | lane_a | Screening | 0.70 | 0.25 | 2.80 | always | supporting |
| 89 | `identify_pure_plays` | lane_a | Screening | 0.70 | 0.35 | 2.00 | gate_pass | supporting |
| 90 | `theme_subsector_expansion` | lane_a | Screening | 0.65 | 0.35 | 1.86 | signal_threshold | optional |
| 91 | `connecting_disparate_trends` | lane_a | Screening | 0.65 | 0.40 | 1.62 | signal_threshold | optional |
| 92 | `theme_order_effects` | lane_a | Screening | 0.60 | 0.35 | 1.71 | signal_threshold | optional |
| 93 | `insider_trading_analysis` | lane_a | Signal Collection | 0.70 | 0.30 | 2.33 | always | supporting |
| 94 | `institutional_clustering_13f` | lane_a | Signal Collection | 0.70 | 0.35 | 2.00 | always | supporting |
| 95 | `social_sentiment_scanner` | lane_a | Signal Collection | 0.65 | 0.35 | 1.86 | always | supporting |
| 96 | `newsletter_idea_scraping` | lane_a | Signal Collection | 0.60 | 0.35 | 1.71 | always | optional |
| 97 | `niche_publication_scanner` | lane_a | Signal Collection | 0.60 | 0.35 | 1.71 | always | optional |
| 98 | `substack_idea_scraping` | lane_a | Signal Collection | 0.55 | 0.30 | 1.83 | always | optional |
| 99 | `deep_web_trend_scanner` | lane_a | Signal Collection | 0.55 | 0.40 | 1.38 | always | experimental |
| 100 | `socialtrends_copytrading_scraper` | lane_a | Signal Collection | 0.50 | 0.30 | 1.67 | always | experimental |
| 101 | `twitter_copytrading_scraper` | lane_a | Signal Collection | 0.50 | 0.30 | 1.67 | always | deprecated |
| 102 | `reddit_memestock_scraper` | lane_a | Signal Collection | 0.45 | 0.25 | 1.80 | always | experimental |
| 103 | `activist_situation_analyzer` | lane_b | Special Situations | 0.75 | 0.50 | 1.50 | signal_threshold | optional |
| 104 | `spinoff_opportunity_analyzer` | lane_b | Special Situations | 0.75 | 0.50 | 1.50 | signal_threshold | optional |
| 105 | `ipo_analysis` | lane_b | Special Situations | 0.70 | 0.45 | 1.56 | signal_threshold | optional |
| 106 | `exit_strategy` | lane_b | Special Situations | 0.70 | 0.40 | 1.75 | lane_a_promotion | supporting |
| 107 | `investment_thesis_synthesis` | lane_b | Thesis Development | 1.00 | 0.70 | 1.43 | lane_a_promotion | core |
| 108 | `bull_bear_analysis` | lane_b | Thesis Development | 0.95 | 0.60 | 1.58 | lane_a_promotion | core |
| 109 | `variant_perception` | lane_b | Thesis Development | 0.85 | 0.55 | 1.55 | lane_a_promotion | supporting |
| 110 | `thesis_monitoring_framework` | lane_b | Thesis Development | 0.80 | 0.40 | 2.00 | lane_a_promotion | supporting |
| 111 | `contrarian_thesis_development` | lane_b | Thesis Development | 0.75 | 0.50 | 1.50 | signal_threshold | optional |
| 112 | `sector_thesis_stress_test` | lane_b | Thesis Development | 0.75 | 0.50 | 1.50 | signal_threshold | supporting |
| 113 | `peer_thesis_comparison` | lane_b | Thesis Development | 0.70 | 0.45 | 1.56 | signal_threshold | optional |
| 114 | `sec_filing_analysis` | utility | Utility | 0.70 | 0.35 | 2.00 | always | supporting |
| 115 | `daily_market_briefing` | utility | Utility | 0.65 | 0.30 | 2.17 | always | supporting |
| 116 | `news_sentiment_analysis` | utility | Utility | 0.65 | 0.30 | 2.17 | always | supporting |
| 117 | `performance_attribution` | utility | Utility | 0.65 | 0.30 | 2.17 | always | supporting |
| 118 | `investment_policy_compliance` | utility | Utility | 0.60 | 0.20 | 3.00 | lane_a_promotion | supporting |
| 119 | `options_overlay_strategy` | utility | Utility | 0.55 | 0.35 | 1.57 | signal_threshold | optional |
| 120 | `tax_loss_harvesting` | utility | Utility | 0.55 | 0.25 | 2.20 | always | optional |
| 121 | `transition_management` | utility | Utility | 0.55 | 0.30 | 1.83 | manual_only | optional |

---

## Detailed Prompt Catalog

### Business Analysis

#### `business_overview_report`

**Description:** Comprehensive overview of business model, products, and market position

| Field | Value |
|-------|-------|
| expected_value_score | 0.90 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.64 |
| min_signal_dependency | 0.00 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `business_economics`

**Description:** Analyzes unit economics, pricing power, and business model sustainability

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.30 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `business_overview_report`

---

#### `customer_analysis`

**Description:** Analyzes customer segments, concentration, and retention dynamics

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.30 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `business_overview_report`

---

#### `segment_analysis`

**Description:** Detailed analysis of business segments and their contribution to value

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `business_overview_report`

---

#### `supply_chain_analysis`

**Description:** Analyzes supply chain dependencies, risks, and competitive advantages

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.56 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `business_overview_report`

---

#### `technology_ip_analysis`

**Description:** Analyzes technology assets, IP portfolio, and innovation pipeline

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.56 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `business_overview_report`

---

#### `geographic_analysis`

**Description:** Analyzes geographic revenue distribution and regional growth opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `business_overview_report`

---

### Catalyst Analysis

#### `catalyst_identification`

**Description:** Identifies potential catalysts and their timing

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.40 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `business_overview_report`
- `financial_statement_analysis`

---

#### `insider_activity_analysis`

**Description:** Analyzes insider buying/selling patterns and implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `short_interest_analysis`

**Description:** Analyzes short interest and potential squeeze dynamics

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `gate_data_sufficiency`

---

### Discovery

#### `trend_to_equity_mapper`

**Description:** Maps macro trends to specific equity opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.78 |
| min_signal_dependency | 0.30 |
| dependency_type | gate_pass |
| status_institucional | core |

**Dependencies:**
- `thematic_idea_generator`

---

#### `value_chain_mapper`

**Description:** Maps value chain to identify investment opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `trend_to_equity_mapper`

---

#### `bull_bear_case_generator`

**Description:** Generates preliminary bull/bear cases for discovered ideas

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.88 |
| min_signal_dependency | 0.35 |
| dependency_type | gate_pass |
| status_institucional | supporting |

**Dependencies:**
- `trend_to_equity_mapper`

---

#### `historical_parallel_finder`

**Description:** Finds historical parallels for current investment themes

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.56 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `thematic_idea_generator`

---

#### `historical_parallel_stress_test`

**Description:** Stress tests thesis against historical parallels

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `historical_parallel_finder`

---

#### `sector_momentum_ranker`

**Description:** Ranks sectors by momentum for idea prioritization

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.17 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `competitor_earnings_comparison`

**Description:** Compares earnings across competitors for relative value

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `earnings_season_analyzer`

---

#### `earnings_preview_generator`

**Description:** Generates earnings preview for specific companies

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `earnings_season_preview`

---

### Financial Analysis

#### `valuation_analysis`

**Description:** Multi-method valuation analysis with DCF, comparables, and scenario analysis

| Field | Value |
|-------|-------|
| expected_value_score | 1.00 |
| expected_cost_score | 0.60 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.40 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `financial_statement_analysis`

---

#### `financial_statement_analysis`

**Description:** Comprehensive analysis of income statement, balance sheet, and cash flow

| Field | Value |
|-------|-------|
| expected_value_score | 0.95 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.73 |
| min_signal_dependency | 0.00 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `earnings_quality_analysis`

**Description:** Assesses quality and sustainability of reported earnings

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.35 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `financial_statement_analysis`

---

#### `capital_allocation_analysis`

**Description:** Analyzes capital allocation decisions and return on invested capital

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.78 |
| min_signal_dependency | 0.35 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `financial_statement_analysis`

---

#### `growth_margin_drivers`

**Description:** Identifies key drivers of revenue growth and margin expansion

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.78 |
| min_signal_dependency | 0.35 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `financial_statement_analysis`

---

#### `debt_structure_analysis`

**Description:** Analyzes debt maturity profile, covenants, and refinancing risk

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.88 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `financial_statement_analysis`

---

#### `income_analysis`

**Description:** Detailed income statement analysis and revenue quality assessment

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `financial_statement_analysis`

---

#### `working_capital_analysis`

**Description:** Analyzes working capital efficiency and cash conversion cycle

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `financial_statement_analysis`

---

#### `ma_history_analysis`

**Description:** Analyzes M&A track record and integration success

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `business_overview_report`

---

#### `capital_structure_optimizer`

**Description:** Models optimal capital structure scenarios

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `debt_structure_analysis`

---

#### `rebalancing_analysis`

**Description:** Analyzes portfolio rebalancing implications and timing

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `financial_statement_analysis`

---

### Gates

#### `lane_a_idea_generation`

**Description:** Core idea generation prompt for Lane A discovery

| Field | Value |
|-------|-------|
| expected_value_score | 0.95 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.90 |
| min_signal_dependency | 0.00 |
| dependency_type | gate_pass |
| status_institucional | core |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `gate_data_sufficiency`

**Description:** Validates data sufficiency before proceeding with analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.90 |
| expected_cost_score | 0.10 |
| value_cost_ratio | 9.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:** None (entry point)

---

#### `gate_coherence`

**Description:** Validates coherence of generated investment idea

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.10 |
| value_cost_ratio | 8.50 |
| min_signal_dependency | 0.50 |
| dependency_type | gate_pass |
| status_institucional | core |

**Dependencies:**
- `lane_a_idea_generation`

---

#### `gate_style_fit`

**Description:** Validates fit with investment style and mandate

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.10 |
| value_cost_ratio | 8.00 |
| min_signal_dependency | 0.60 |
| dependency_type | gate_pass |
| status_institucional | core |

**Dependencies:**
- `investment_thesis_synthesis`

---

### Industry Analysis

#### `competitive_analysis`

**Description:** Comprehensive competitive positioning and market share analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.90 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.64 |
| min_signal_dependency | 0.30 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `business_overview_report`

---

#### `industry_overview`

**Description:** Industry structure, dynamics, and growth outlook analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.25 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `tam_sam_som_analyzer`

**Description:** Total addressable market sizing and serviceable market analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.30 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `industry_overview`

---

#### `competitive_landscape_mapping`

**Description:** Maps competitive landscape and strategic group positioning

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `competitive_analysis`

---

#### `sector_rotation_analysis`

**Description:** Analyzes sector rotation patterns and cyclical positioning

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `industry_overview`

---

#### `sector_sensitivity_analysis`

**Description:** Analyzes sector sensitivity to macro factors

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `industry_overview`

---

### Macro Analysis

#### `credit_cycle_analysis`

**Description:** Analyzes credit cycle positioning and implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `debt_structure_analysis`

---

#### `market_regime_analysis`

**Description:** Identifies current market regime and implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `currency_analysis`

**Description:** Analyzes currency exposure and FX risk

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `geographic_analysis`

---

#### `commodity_analysis`

**Description:** Analyzes commodity exposure and price sensitivity

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `business_overview_report`

---

#### `liquidity_conditions_analysis`

**Description:** Analyzes market liquidity conditions and trading implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `currency_hedging_analysis`

**Description:** Analyzes currency hedging strategies and costs

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `currency_analysis`

---

#### `election_impact_analysis`

**Description:** Analyzes potential election impact on the investment

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.57 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | experimental |

**Dependencies:**
- `regulatory_risk_analysis`

---

#### `yield_curve_analysis`

**Description:** Analyzes yield curve dynamics and sector implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `gate_data_sufficiency`

---

### Macro Context

#### `macro_environment_analysis`

**Description:** Comprehensive macro environment scan for investment context

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.78 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:** None (entry point)

---

#### `fed_policy_analysis`

**Description:** Analyzes Fed policy trajectory and market implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.88 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:**
- `macro_environment_analysis`

---

#### `global_macro_scan`

**Description:** Global macro scan for cross-border investment themes

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `inflation_analysis`

**Description:** Analyzes inflation dynamics and investment implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:**
- `macro_environment_analysis`

---

#### `economic_indicator_analysis`

**Description:** Analyzes key economic indicators and trends

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:**
- `macro_environment_analysis`

---

#### `earnings_season_preview`

**Description:** Preview of upcoming earnings season themes and expectations

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `earnings_season_analyzer`

**Description:** Analyzes earnings season results and trends

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:**
- `earnings_season_preview`

---

#### `china_macro_analysis`

**Description:** Analyzes China macro conditions and global implications

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | optional |

**Dependencies:**
- `macro_environment_analysis`

---

### Management Analysis

#### `management_quality_assessment`

**Description:** Comprehensive assessment of management quality and track record

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.35 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `business_overview_report`

---

#### `ceo_track_record`

**Description:** Detailed analysis of CEO's historical performance and decisions

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.30 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `management_quality_assessment`

---

#### `esg_analysis`

**Description:** Environmental, social, and governance risk assessment

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `business_overview_report`

---

#### `esg_portfolio_analysis`

**Description:** Portfolio-level ESG exposure and risk analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `esg_analysis`

---

### Monitoring

#### `thesis_update`

**Description:** Updates investment thesis based on new information

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.89 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:** None (entry point)

---

#### `earnings_call_analysis`

**Description:** Analyzes earnings calls for thesis validation

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.88 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `news_sentiment_monitor`

**Description:** Monitors news sentiment for portfolio positions

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.33 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

### Output Generation

#### `investment_memo`

**Description:** Generates formal investment memo for investment committee review

| Field | Value |
|-------|-------|
| expected_value_score | 0.90 |
| expected_cost_score | 0.65 |
| value_cost_ratio | 1.38 |
| min_signal_dependency | 0.80 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `investment_presentation_creator`

**Description:** Creates presentation slides summarizing investment thesis

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.60 |
| value_cost_ratio | 1.42 |
| min_signal_dependency | 0.75 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_memo`

---

#### `thesis_presentation`

**Description:** Generates structured thesis presentation for stakeholder communication

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.45 |
| min_signal_dependency | 0.70 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `research_report_summary`

**Description:** Summarizes full research report into executive summary format

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.60 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

### Portfolio Construction

#### `portfolio_construction`

**Description:** Portfolio construction and optimization

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 2.12 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:** None (entry point)

---

#### `position_sizer`

**Description:** Determines optimal position size based on conviction and risk

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.67 |
| min_signal_dependency | 0.50 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `position_sizing`

**Description:** Position sizing calculations and constraints

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 3.00 |
| min_signal_dependency | 0.50 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `position_sizer`

---

#### `portfolio_performance_reporter`

**Description:** Generates portfolio performance reports

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.33 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

### Portfolio Risk

#### `risk_monitoring`

**Description:** Ongoing risk monitoring and alerting

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.67 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:** None (entry point)

---

#### `correlation_analysis`

**Description:** Analyzes correlation structure of portfolio holdings

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 3.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `factor_exposure_analysis`

**Description:** Analyzes portfolio factor exposures

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.14 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `scenario_analysis`

**Description:** Scenario analysis for portfolio stress testing

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.88 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `benchmark_comparison`

**Description:** Compares portfolio performance against benchmarks

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.33 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `drawdown_analysis`

**Description:** Analyzes historical drawdowns and recovery patterns

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 2.80 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `factor_exposure_analyzer`

**Description:** Detailed factor exposure analysis and attribution

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.33 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:**
- `factor_exposure_analysis`

---

#### `liquidity_analysis`

**Description:** Analyzes portfolio liquidity and trading capacity

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 2.60 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

### Risk Analysis

#### `risk_assessment`

**Description:** Comprehensive risk assessment across all dimensions

| Field | Value |
|-------|-------|
| expected_value_score | 0.95 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.73 |
| min_signal_dependency | 0.40 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `financial_statement_analysis`
- `competitive_analysis`

---

#### `risk_factor_identifier`

**Description:** Identifies and categorizes key risk factors

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.78 |
| min_signal_dependency | 0.35 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `risk_assessment`

---

#### `pre_mortem_analysis`

**Description:** Pre-mortem analysis of what could cause the thesis to fail

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.50 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `regulatory_risk_analysis`

**Description:** Analyzes regulatory environment and compliance risks

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.30 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `business_overview_report`

---

#### `geopolitical_risk_analysis`

**Description:** Analyzes geopolitical risks affecting the investment

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.25 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `geographic_analysis`

---

### Screening

#### `thematic_idea_generator`

**Description:** Generates investment ideas based on thematic trends

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.70 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | core |

**Dependencies:**
- `macro_environment_analysis`

---

#### `pure_play_filter`

**Description:** Filters for pure-play exposure to investment themes

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 3.00 |
| min_signal_dependency | 0.30 |
| dependency_type | gate_pass |
| status_institucional | core |

**Dependencies:**
- `thematic_idea_generator`

---

#### `thematic_candidate_screen`

**Description:** Screens candidates against thematic criteria

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.50 |
| min_signal_dependency | 0.25 |
| dependency_type | gate_pass |
| status_institucional | supporting |

**Dependencies:**
- `thematic_idea_generator`

---

#### `under_radar_discovery`

**Description:** Discovers under-followed stocks with potential

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.50 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `watchlist_screening`

**Description:** Screens watchlist for actionable opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 2.80 |
| min_signal_dependency | 0.20 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `identify_pure_plays`

**Description:** Identifies pure-play investment opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.25 |
| dependency_type | gate_pass |
| status_institucional | supporting |

**Dependencies:**
- `thematic_idea_generator`

---

#### `theme_subsector_expansion`

**Description:** Expands themes into subsector opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `thematic_idea_generator`

---

#### `connecting_disparate_trends`

**Description:** Connects disparate trends to identify unique opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.62 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `macro_environment_analysis`

---

#### `theme_order_effects`

**Description:** Analyzes second-order effects of investment themes

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.20 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `thematic_idea_generator`

---

### Signal Collection

#### `insider_trading_analysis`

**Description:** Analyzes insider trading patterns for investment signals

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.33 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `institutional_clustering_13f`

**Description:** Analyzes 13F filings for institutional clustering patterns

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `social_sentiment_scanner`

**Description:** Scans social trends for sentiment signals using SocialTrendsClient

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.86 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `newsletter_idea_scraping`

**Description:** Scrapes investment newsletters for idea generation

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | optional |

**Dependencies:** None (entry point)

---

#### `niche_publication_scanner`

**Description:** Scans niche publications for undiscovered ideas

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.71 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | optional |

**Dependencies:** None (entry point)

---

#### `substack_idea_scraping`

**Description:** Scrapes Substack for investment ideas and analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | optional |

**Dependencies:** None (entry point)

---

#### `deep_web_trend_scanner`

**Description:** Scans deep web sources for emerging trends

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.38 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | experimental |

**Dependencies:** None (entry point)

---

#### `socialtrends_copytrading_scraper`

**Description:** Analyzes social trends for copy-trading signals via SocialTrendsClient

| Field | Value |
|-------|-------|
| expected_value_score | 0.50 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | experimental |

**Dependencies:** None (entry point)

---

#### `twitter_copytrading_scraper`

**Description:** DEPRECATED: Use socialtrends_copytrading_scraper. Analyzes social trends for copy-trading signals via SocialTrendsClient

| Field | Value |
|-------|-------|
| expected_value_score | 0.50 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.67 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | deprecated |

**Dependencies:** None (entry point)

---

#### `reddit_memestock_scraper`

**Description:** Monitors Reddit for retail sentiment and meme stock activity

| Field | Value |
|-------|-------|
| expected_value_score | 0.45 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 1.80 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | experimental |

**Dependencies:** None (entry point)

---

### Special Situations

#### `activist_situation_analyzer`

**Description:** Analyzes activist investor involvement and potential outcomes

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.50 |
| min_signal_dependency | 0.40 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `business_overview_report`

---

#### `spinoff_opportunity_analyzer`

**Description:** Analyzes spinoff opportunities and value creation potential

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.50 |
| min_signal_dependency | 0.40 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `segment_analysis`

---

#### `ipo_analysis`

**Description:** Analyzes IPO opportunities and valuation

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.56 |
| min_signal_dependency | 0.35 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `gate_data_sufficiency`

---

#### `exit_strategy`

**Description:** Develops exit strategy and price targets

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 1.75 |
| min_signal_dependency | 0.50 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

### Thesis Development

#### `investment_thesis_synthesis`

**Description:** Synthesizes all research modules into a coherent investment thesis with actionable recommendation

| Field | Value |
|-------|-------|
| expected_value_score | 1.00 |
| expected_cost_score | 0.70 |
| value_cost_ratio | 1.43 |
| min_signal_dependency | 0.75 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `business_overview_report`
- `financial_statement_analysis`
- `valuation_analysis`
- `risk_assessment`
- `bull_bear_analysis`

---

#### `bull_bear_analysis`

**Description:** Develops balanced bull and bear cases for investment thesis with probability-weighted scenarios

| Field | Value |
|-------|-------|
| expected_value_score | 0.95 |
| expected_cost_score | 0.60 |
| value_cost_ratio | 1.58 |
| min_signal_dependency | 0.70 |
| dependency_type | lane_a_promotion |
| status_institucional | core |

**Dependencies:**
- `financial_statement_analysis`
- `valuation_analysis`
- `risk_assessment`

---

#### `variant_perception`

**Description:** Identifies where our view differs from consensus and why we might be right

| Field | Value |
|-------|-------|
| expected_value_score | 0.85 |
| expected_cost_score | 0.55 |
| value_cost_ratio | 1.55 |
| min_signal_dependency | 0.60 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `thesis_monitoring_framework`

**Description:** Creates framework for ongoing thesis validation and key metrics to monitor

| Field | Value |
|-------|-------|
| expected_value_score | 0.80 |
| expected_cost_score | 0.40 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.60 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `contrarian_thesis_development`

**Description:** Develops contrarian investment thesis when consensus view may be wrong

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.50 |
| min_signal_dependency | 0.50 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `bull_bear_analysis`

---

#### `sector_thesis_stress_test`

**Description:** Stress tests sector-level thesis assumptions under various scenarios

| Field | Value |
|-------|-------|
| expected_value_score | 0.75 |
| expected_cost_score | 0.50 |
| value_cost_ratio | 1.50 |
| min_signal_dependency | 0.55 |
| dependency_type | signal_threshold |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `peer_thesis_comparison`

**Description:** Compares our thesis against sell-side and buy-side consensus views

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.45 |
| value_cost_ratio | 1.56 |
| min_signal_dependency | 0.50 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `investment_thesis_synthesis`

---

### Utility

#### `sec_filing_analysis`

**Description:** Analyzes SEC filings for material information

| Field | Value |
|-------|-------|
| expected_value_score | 0.70 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 2.00 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `daily_market_briefing`

**Description:** Generates daily market briefing

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.17 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `news_sentiment_analysis`

**Description:** Analyzes news sentiment for specific securities

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.17 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `performance_attribution`

**Description:** Performance attribution analysis

| Field | Value |
|-------|-------|
| expected_value_score | 0.65 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 2.17 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | supporting |

**Dependencies:** None (entry point)

---

#### `investment_policy_compliance`

**Description:** Validates investment against policy constraints

| Field | Value |
|-------|-------|
| expected_value_score | 0.60 |
| expected_cost_score | 0.20 |
| value_cost_ratio | 3.00 |
| min_signal_dependency | 0.50 |
| dependency_type | lane_a_promotion |
| status_institucional | supporting |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `options_overlay_strategy`

**Description:** Develops options overlay strategies

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.35 |
| value_cost_ratio | 1.57 |
| min_signal_dependency | 0.40 |
| dependency_type | signal_threshold |
| status_institucional | optional |

**Dependencies:**
- `investment_thesis_synthesis`

---

#### `tax_loss_harvesting`

**Description:** Identifies tax loss harvesting opportunities

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.25 |
| value_cost_ratio | 2.20 |
| min_signal_dependency | 0.00 |
| dependency_type | always |
| status_institucional | optional |

**Dependencies:** None (entry point)

---

#### `transition_management`

**Description:** Manages portfolio transitions and rebalancing

| Field | Value |
|-------|-------|
| expected_value_score | 0.55 |
| expected_cost_score | 0.30 |
| value_cost_ratio | 1.83 |
| min_signal_dependency | 0.00 |
| dependency_type | manual_only |
| status_institucional | optional |

**Dependencies:** None (entry point)

---

## Summary Statistics

### By Status

| Status | Count | Percentage |
|--------|-------|------------|
| core | 25 | 20.7% |
| supporting | 55 | 45.5% |
| optional | 36 | 29.8% |
| experimental | 4 | 3.3% |
| deprecated | 1 | 0.8% |

### By Dependency Type

| Type | Count | Percentage |
|------|-------|------------|
| always | 41 | 33.9% |
| lane_a_promotion | 29 | 24.0% |
| gate_pass | 8 | 6.6% |
| signal_threshold | 42 | 34.7% |
| manual_only | 1 | 0.8% |

### Average Scores

- **Average expected_value_score:** 0.72
- **Average expected_cost_score:** 0.39
- **Average value_cost_ratio:** 1.85

---

## Note on Social Data Sources

All social sentiment and trend analysis prompts use **SocialTrendsClient** as the data source abstraction. This client aggregates signals from multiple social platforms and trend sources, providing a unified interface for social sentiment analysis.

The following prompts use SocialTrendsClient:

- `social_sentiment_scanner`
- `socialtrends_copytrading_scraper`
- `reddit_memestock_scraper`

**Note:** The prompt `twitter_copytrading_scraper` is **deprecated** and should be replaced with `socialtrends_copytrading_scraper`. It is maintained only for backward compatibility.
