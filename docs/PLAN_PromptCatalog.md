# ARC Investment Factory - Prompt Catalog

## Complete Reference Guide

Este catálogo documenta todos os **116 prompts** com seus objetivos específicos, localização no pipeline, inputs/outputs esperados e casos de uso.

---

## Quick Reference Table

| # | Prompt ID | Lane | Stage | Category | LLM |
|---|-----------|------|-------|----------|-----|
| 1 | `bull_bear_analysis` | lane_b | thesis_development | Due Diligence | gpt-4 |
| 2 | `business_economics` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 3 | `business_overview_report` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 4 | `capital_allocation_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 5 | `capital_structure_optimizer` | lane_b | financial_analysis | Due Diligence | code |
| 6 | `catalyst_identification` | lane_b | catalyst_analysis | Due Diligence | gpt-4 |
| 7 | `ceo_track_record` | lane_b | management_analysis | Due Diligence | gpt-4 |
| 8 | `competitive_analysis` | lane_b | industry_analysis | Due Diligence | gpt-4 |
| 9 | `customer_analysis` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 10 | `debt_structure_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 11 | `earnings_quality_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 12 | `esg_analysis` | lane_b | esg_analysis | Due Diligence | gpt-4 |
| 13 | `financial_statement_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 14 | `geographic_analysis` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 15 | `growth_margin_drivers` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 16 | `industry_overview` | lane_b | industry_analysis | Due Diligence | gpt-4 |
| 17 | `insider_activity_analysis` | lane_b | technical_analysis | Due Diligence | gpt-4 |
| 18 | `ma_history_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 19 | `management_quality_assessment` | lane_b | management_analysis | Due Diligence | gpt-4 |
| 20 | `regulatory_risk_analysis` | lane_b | risk_analysis | Due Diligence | gpt-4 |
| 21 | `risk_assessment` | lane_b | risk_analysis | Due Diligence | gpt-4 |
| 22 | `risk_factor_identifier` | lane_b | risk_analysis | Due Diligence | gpt-4 |
| 23 | `segment_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 24 | `short_interest_analysis` | lane_b | technical_analysis | Due Diligence | gpt-4 |
| 25 | `supply_chain_analysis` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 26 | `tam_sam_som_analyzer` | lane_b | industry_analysis | Due Diligence | gpt-4 |
| 27 | `technology_ip_analysis` | lane_b | business_analysis | Due Diligence | gpt-4 |
| 28 | `valuation_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 29 | `working_capital_analysis` | lane_b | financial_analysis | Due Diligence | gpt-4 |
| 30 | `competitive_landscape_mapping` | lane_a | analysis | Idea Generation | gpt-4 |
| 31 | `connecting_disparate_trends` | lane_a | screening | Idea Generation | gpt-4 |
| 32 | `deep_web_trend_scanner` | lane_a | signal_collection | Idea Generation | sonar-pro |
| 33 | `historical_parallel_finder` | lane_a | analysis | Idea Generation | gpt-4 |
| 34 | `historical_parallel_stress_test` | lane_a | discovery | Idea Generation | gpt-4 |
| 35 | `identify_pure_plays` | lane_a | screening | Idea Generation | gpt-4 |
| 36 | `insider_trading_analysis` | lane_a | signal_collection | Idea Generation | gpt-4 |
| 37 | `institutional_clustering_13f` | lane_a | signal_collection | Idea Generation | gpt-4 |
| 38 | `investment_presentation_creator` | lane_a | discovery | Idea Generation | gpt-4 |
| 39 | `newsletter_idea_scraping` | lane_a | signal_collection | Idea Generation | sonar-pro |
| 40 | `niche_publication_scanner` | lane_a | signal_collection | Idea Generation | sonar-pro |
| 41 | `pure_play_filter` | lane_a | screening | Idea Generation | code |
| 42 | `reddit_memestock_scraper` | lane_a | signal_collection | Idea Generation | code |
| 43 | `sector_thesis_stress_test` | lane_a | discovery | Idea Generation | gpt-4 |
| 44 | `social_sentiment_scanner` | lane_a | signal_collection | Idea Generation | gpt-4 |
| 45 | `substack_idea_scraping` | lane_a | signal_collection | Idea Generation | sonar-pro |
| 46 | `thematic_candidate_screen` | lane_a | screening | Idea Generation | gpt-4 |
| 47 | `thematic_idea_generator` | lane_a | screening | Idea Generation | gpt-4 |
| 48 | `theme_order_effects` | lane_a | screening | Idea Generation | gpt-4 |
| 49 | `theme_subsector_expansion` | lane_a | screening | Idea Generation | gpt-4 |
| 50 | `trend_to_equity_mapper` | lane_a | discovery | Idea Generation | gpt-4 |
| 51 | `twitter_copytrading_scraper` | lane_a | signal_collection | Idea Generation | code |
| 52 | `under_radar_discovery` | lane_a | screening | Idea Generation | claude-3-opus |
| 53 | `value_chain_mapper` | lane_a | discovery | Idea Generation | gpt-4 |
| 54 | `china_macro_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 55 | `commodity_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 56 | `credit_cycle_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 57 | `currency_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 58 | `earnings_season_preview` | lane_a | macro_context | Macro | gpt-4 |
| 59 | `economic_indicator_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 60 | `election_impact_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 61 | `fed_policy_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 62 | `geopolitical_risk_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 63 | `global_macro_scan` | lane_a | macro_context | Macro | gpt-4 |
| 64 | `inflation_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 65 | `liquidity_conditions_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 66 | `macro_environment_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 67 | `market_regime_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 68 | `sector_sensitivity_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 69 | `yield_curve_analysis` | lane_a | macro_context | Macro | gpt-4 |
| 70 | `earnings_season_analyzer` | lane_a | market_analysis | Market Analysis | gpt-4 |
| 71 | `sector_momentum_ranker` | lane_a | market_analysis | Market Analysis | gpt-4 |
| 72 | `news_sentiment_monitor` | monitoring | position_monitoring | Monitoring | gpt-4 |
| 73 | `portfolio_performance_reporter` | monitoring | position_monitoring | Monitoring | gpt-4 |
| 74 | `competitor_earnings_comparison` | utility | utility | Other | gpt-4 |
| 75 | `daily_market_briefing` | utility | utility | Other | gpt-4 |
| 76 | `earnings_call_analysis` | utility | utility | Other | gpt-4 |
| 77 | `news_sentiment_analysis` | utility | utility | Other | gpt-4 |
| 78 | `research_report_summary` | utility | utility | Other | gpt-4 |
| 79 | `sec_filing_analysis` | utility | utility | Other | gpt-4 |
| 80 | `watchlist_screening` | utility | utility | Other | gpt-4 |
| 81 | `benchmark_comparison` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 82 | `correlation_analysis` | portfolio | risk_management | Portfolio Management | code |
| 83 | `currency_hedging_analysis` | portfolio | hedging | Portfolio Management | gpt-4 |
| 84 | `drawdown_analysis` | portfolio | risk_management | Portfolio Management | code |
| 85 | `esg_portfolio_analysis` | portfolio | portfolio_analytics | Portfolio Management | gpt-4 |
| 86 | `factor_exposure_analysis` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 87 | `factor_exposure_analyzer` | portfolio | portfolio_analytics | Portfolio Management | code |
| 88 | `income_analysis` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 89 | `investment_policy_compliance` | portfolio | compliance | Portfolio Management | gpt-4 |
| 90 | `liquidity_analysis` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 91 | `options_overlay_strategy` | portfolio | hedging | Portfolio Management | gpt-4 |
| 92 | `performance_attribution` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 93 | `portfolio_construction` | portfolio | construction | Portfolio Management | gpt-4 |
| 94 | `position_sizer` | portfolio | construction | Portfolio Management | code |
| 95 | `position_sizing` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 96 | `rebalancing_analysis` | portfolio | execution | Portfolio Management | gpt-4 |
| 97 | `risk_monitoring` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 98 | `scenario_analysis` | portfolio | risk_management | Portfolio Management | gpt-4 |
| 99 | `sector_rotation_analysis` | portfolio | strategy | Portfolio Management | gpt-4 |
| 100 | `tax_loss_harvesting` | portfolio | tax_management | Portfolio Management | code |
| 101 | `transition_management` | portfolio | execution | Portfolio Management | gpt-4 |
| 102 | `bull_bear_case_generator` | lane_b | synthesis | Research Synthesis | gpt-4 |
| 103 | `earnings_preview_generator` | lane_b | synthesis | Research Synthesis | gpt-4 |
| 104 | `activist_situation_analyzer` | lane_b | special_situations | Special Situations | claude-3-opus |
| 105 | `ipo_analysis` | lane_b | special_situations | Special Situations | gpt-4 |
| 106 | `spinoff_opportunity_analyzer` | lane_b | special_situations | Special Situations | claude-3-opus |
| 107 | `contrarian_thesis_development` | lane_b | thesis_development | Thesis | claude-3-opus |
| 108 | `exit_strategy` | lane_b | execution | Thesis | gpt-4 |
| 109 | `investment_memo` | lane_b | output | Thesis | gpt-4 |
| 110 | `investment_thesis_synthesis` | lane_b | thesis_development | Thesis | gpt-4 |
| 111 | `peer_thesis_comparison` | lane_b | thesis_development | Thesis | gpt-4 |
| 112 | `pre_mortem_analysis` | lane_b | risk_assessment | Thesis | claude-3-opus |
| 113 | `thesis_monitoring_framework` | lane_b | thesis_monitoring | Thesis | gpt-4 |
| 114 | `thesis_presentation` | lane_b | output | Thesis | gpt-4 |
| 115 | `thesis_update` | lane_b | thesis_monitoring | Thesis | gpt-4 |
| 116 | `variant_perception` | lane_b | thesis_development | Thesis | claude-3-opus |

---

## Detailed Prompt Documentation

### Lane A: Discovery & Idea Generation

#### 1. `macro_environment_analysis`

**Objetivo:** Analisar o ambiente macroeconômico atual para contextualizar decisões de investimento.

**Localização no Pipeline:**
- **Lane:** A (Discovery)
- **Stage:** macro_context
- **Ordem de Execução:** 1 (primeiro do pipeline)

**Inputs:**
- Indicadores econômicos atuais
- Dados de mercado
- Notícias macro recentes

**Outputs:**
```json
{
  "regime": "expansion|contraction|transition",
  "key_themes": ["string"],
  "sector_implications": {
    "overweight": ["string"],
    "underweight": ["string"]
  },
  "risk_factors": ["string"],
  "outlook": "string"
}
```

**Caso de Uso:** Executado diariamente antes do screening para fornecer contexto macro.

---

#### 2. `thematic_idea_generator`

**Objetivo:** Gerar ideias de investimento baseadas em temas macro e tendências identificadas.

**Localização no Pipeline:**
- **Lane:** A (Discovery)
- **Stage:** screening
- **Ordem de Execução:** Após macro_context

**Dependências:**
- `macro_environment_analysis`
- `global_macro_scan`

**Inputs:**
- Análise macro atual
- Tendências identificadas
- Temas de investimento

**Outputs:**
```json
{
  "themes": [
    {
      "theme_name": "string",
      "thesis": "string",
      "sectors": ["string"],
      "potential_tickers": ["string"],
      "time_horizon": "string",
      "conviction": 1-10
    }
  ]
}
```

**Caso de Uso:** Identifica temas de investimento que podem gerar ideias específicas.

---

#### 3. `social_sentiment_scanner`

**Objetivo:** Escanear redes sociais e fóruns para identificar sentimento e tendências emergentes.

**Localização no Pipeline:**
- **Lane:** A (Discovery)
- **Stage:** signal_collection
- **Ordem de Execução:** Paralelo com outros signal collectors

**Data Sources:**
- Reddit (r/wallstreetbets, r/stocks, r/investing)
- Twitter/X
- StockTwits

**Outputs:**
```json
{
  "trending_tickers": [
    {
      "ticker": "string",
      "mentions": "number",
      "sentiment": "bullish|bearish|neutral",
      "momentum": "increasing|stable|decreasing"
    }
  ],
  "emerging_themes": ["string"],
  "risk_signals": ["string"]
}
```

**Caso de Uso:** Captura sinais de varejo que podem indicar movimentos de preço.

---

### Lane B: Deep Research

#### 4. `business_overview_report`

**Objetivo:** Criar um overview completo do negócio como base para análise profunda.

**Localização no Pipeline:**
- **Lane:** B (Research)
- **Stage:** business_analysis
- **Ordem de Execução:** Primeiro do Lane B

**Inputs:**
- Ticker da empresa
- Profile da FMP
- 10-K filings
- Descrição do negócio

**Outputs:**
```json
{
  "company_name": "string",
  "business_description": "string",
  "revenue_model": "string",
  "key_products": ["string"],
  "customer_segments": ["string"],
  "competitive_position": "string",
  "moat_assessment": {
    "type": "string",
    "durability": "high|medium|low",
    "evidence": ["string"]
  },
  "growth_strategy": "string",
  "key_risks": ["string"]
}
```

**Caso de Uso:** Base para todos os outros módulos de research.

---

#### 5. `valuation_analysis`

**Objetivo:** Análise completa de valuation usando múltiplas metodologias.

**Localização no Pipeline:**
- **Lane:** B (Research)
- **Stage:** financial_analysis
- **Ordem de Execução:** Após financial_statement_analysis

**Dependências:**
- `financial_statement_analysis`
- `growth_margin_drivers`

**Inputs:**
- Demonstrações financeiras
- Métricas de mercado
- Projeções de crescimento
- Comparáveis de peers

**Outputs:**
```json
{
  "methodologies": {
    "dcf": {
      "fair_value": "number",
      "assumptions": {}
    },
    "multiples": {
      "ev_ebitda": "number",
      "pe": "number",
      "implied_value": "number"
    },
    "sum_of_parts": {
      "segments": [],
      "total_value": "number"
    }
  },
  "fair_value_range": {
    "low": "number",
    "base": "number",
    "high": "number"
  },
  "current_price": "number",
  "upside_downside": "number",
  "margin_of_safety": "number"
}
```

**Caso de Uso:** Determina se a empresa está subvalorizada ou sobrevalorizada.

---

#### 6. `investment_thesis_synthesis`

**Objetivo:** Sintetizar toda a pesquisa em uma tese de investimento coerente.

**Localização no Pipeline:**
- **Lane:** B (Research)
- **Stage:** thesis_development
- **Ordem de Execução:** Após todos os módulos de research

**Dependências:**
- Todos os módulos de business, financial, industry, management, risk analysis

**Inputs:**
- Todos os outputs dos módulos anteriores
- Análise de valuation
- Risk assessment

**Outputs:**
```json
{
  "thesis_statement": "string (2-3 sentences)",
  "investment_style": "quality_compounder|garp|cigar_butt",
  "conviction": 1-10,
  "key_drivers": ["string"],
  "bull_case": {
    "scenario": "string",
    "target_price": "number",
    "probability": "number"
  },
  "base_case": {
    "scenario": "string",
    "target_price": "number",
    "probability": "number"
  },
  "bear_case": {
    "scenario": "string",
    "target_price": "number",
    "probability": "number"
  },
  "expected_return": "number",
  "key_risks": ["string"],
  "catalysts": [
    {
      "event": "string",
      "timing": "string",
      "impact": "high|medium|low"
    }
  ],
  "monitoring_triggers": ["string"],
  "position_guidance": {
    "recommended_size": "number",
    "entry_strategy": "string",
    "exit_criteria": "string"
  }
}
```

**Caso de Uso:** Documento final de decisão de investimento.

---

### Portfolio Management

#### 7. `portfolio_construction`

**Objetivo:** Construir um portfólio otimizado baseado nas teses de investimento.

**Localização no Pipeline:**
- **Lane:** Portfolio
- **Stage:** construction
- **Ordem de Execução:** Após aprovação de ideias

**Inputs:**
- Lista de ideias aprovadas
- Parâmetros de risco
- Constraints de investimento

**Outputs:**
```json
{
  "portfolio": [
    {
      "ticker": "string",
      "weight": "number",
      "conviction": "number",
      "style": "string"
    }
  ],
  "characteristics": {
    "expected_return": "number",
    "volatility": "number",
    "sharpe_ratio": "number",
    "max_drawdown": "number"
  },
  "factor_exposures": {},
  "sector_allocation": {},
  "style_allocation": {}
}
```

**Caso de Uso:** Determina alocação ótima de capital.

---

#### 8. `risk_monitoring`

**Objetivo:** Monitorar riscos do portfólio em tempo real.

**Localização no Pipeline:**
- **Lane:** Portfolio
- **Stage:** risk_management
- **Ordem de Execução:** Contínuo

**Inputs:**
- Posições atuais
- Preços de mercado
- Volatilidade

**Outputs:**
```json
{
  "var_95": "number",
  "var_99": "number",
  "current_drawdown": "number",
  "concentration_risk": {},
  "correlation_matrix": {},
  "alerts": [
    {
      "type": "string",
      "severity": "high|medium|low",
      "message": "string"
    }
  ]
}
```

**Caso de Uso:** Alerta sobre riscos emergentes no portfólio.

---

## Data Source Requirements

### Por Prompt

| Prompt | FMP | Polygon | SEC | News | Social | Other |
|--------|-----|---------|-----|------|--------|-------|
| `business_overview_report` | ✓ | | ✓ | | | |
| `financial_statement_analysis` | ✓ | | ✓ | | | |
| `valuation_analysis` | ✓ | ✓ | | | | |
| `social_sentiment_scanner` | | | | | ✓ | Reddit API |
| `insider_trading_analysis` | | | ✓ | | | |
| `macro_environment_analysis` | | ✓ | | ✓ | | FRED |

---

## LLM Configuration Summary

### OpenAI GPT-4 (83 prompts)
- **Temperature:** 0.2-0.3 (analytical tasks)
- **Max Tokens:** 4000-5000
- **Use Cases:** Análise financeira, valuation, thesis development

### Anthropic Claude-3-Opus (7 prompts)
- **Temperature:** 0.2-0.3
- **Max Tokens:** 4000
- **Use Cases:** Análise contrarian, special situations, variant perception

### Perplexity Sonar-Pro (8 prompts)
- **Use Cases:** Web research, trend scanning, news analysis

### Code-Based (18 prompts)
- **Use Cases:** Cálculos quantitativos, screening, data processing

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-12 | Initial catalog with 116 prompts |
