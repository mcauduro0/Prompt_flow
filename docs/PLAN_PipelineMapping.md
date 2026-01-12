# ARC Investment Factory - Prompt Pipeline Mapping

## Executive Summary

Este documento mapeia todos os **116 prompts** do arquivo `all_prompts_final.md` para suas respectivas posições no pipeline de investimento da ARC Investment Factory.

### Distribuição por Lane

| Lane | Quantidade | Descrição |
|------|------------|-----------|
| **Lane A** | 42 prompts | Discovery & Idea Generation |
| **Lane B** | 44 prompts | Deep Research & Due Diligence |
| **Portfolio** | 21 prompts | Portfolio Management |
| **Monitoring** | 2 prompts | Position Monitoring |
| **Utility** | 7 prompts | Utility & Support Functions |

### Distribuição por LLM

| Provider/Model | Quantidade |
|----------------|------------|
| OpenAI/GPT-4 | 83 |
| Code (no LLM) | 18 |
| Perplexity/Sonar-Pro | 8 |
| Anthropic/Claude-3-Opus | 7 |

---

## Lane A: Discovery & Idea Generation (42 prompts)

O Lane A é responsável pela descoberta de ideias de investimento através de screening, análise macro e coleta de sinais.

### Stage: Screening (8 prompts)

Prompts para filtrar e identificar candidatos de investimento.

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `connecting_disparate_trends` | Connecting Disparate Trends | Conecta tendências aparentemente não relacionadas | thematic |
| `identify_pure_plays` | Identify Pure Plays | Identifica empresas com exposição pura a temas | screening |
| `pure_play_filter` | Pure Play Filter | Filtra candidatos por pureza de exposição | screening |
| `thematic_candidate_screen` | Thematic Candidate Screen | Screening temático de candidatos | thematic |
| `thematic_idea_generator` | Thematic Idea Generator | Gera ideias baseadas em temas | thematic |
| `theme_order_effects` | Theme Order Effects | Analisa efeitos de ordem em temas | thematic |
| `theme_subsector_expansion` | Theme Subsector Expansion | Expande temas para subsectores | thematic |
| `under_radar_discovery` | Under Radar Discovery | Descobre oportunidades fora do radar | screening |

### Stage: Signal Collection (9 prompts)

Prompts para coletar sinais de fontes alternativas.

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `deep_web_trend_scanner` | Deep Web Trend Scanner | Escaneia tendências em fontes alternativas | alternative_sources |
| `insider_trading_analysis` | Insider Trading Analysis | Analisa transações de insiders | sec_filings |
| `institutional_clustering_13f` | Institutional Clustering 13F | Clustering de posições institucionais | sec_filings |
| `newsletter_idea_scraping` | Newsletter Idea Scraping | Extrai ideias de newsletters | alternative_sources |
| `niche_publication_scanner` | Niche Publication Scanner | Escaneia publicações de nicho | alternative_sources |
| `reddit_memestock_scraper` | Reddit Memestock Scraper | Monitora Reddit para memestocks | social_sentiment |
| `social_sentiment_scanner` | Social Sentiment Scanner | Escaneia sentimento social | alternative_data |
| `substack_idea_scraping` | Substack Idea Scraping | Extrai ideias de Substacks | alternative_sources |
| `twitter_copytrading_scraper` | Twitter Copytrading Scraper | Monitora traders no Twitter | social_sentiment |

### Stage: Macro Context (16 prompts)

Prompts para análise do contexto macroeconômico.

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `china_macro_analysis` | China Macro Analysis | Análise macro da China | macro |
| `commodity_analysis` | Commodity Analysis | Análise de commodities | macro |
| `credit_cycle_analysis` | Credit Cycle Analysis | Análise do ciclo de crédito | macro |
| `currency_analysis` | Currency Analysis | Análise de moedas | macro |
| `earnings_season_preview` | Earnings Season Preview | Preview da temporada de earnings | macro |
| `economic_indicator_analysis` | Economic Indicator Analysis | Análise de indicadores econômicos | macro |
| `election_impact_analysis` | Election Impact Analysis | Impacto de eleições | macro |
| `fed_policy_analysis` | Fed Policy Analysis | Análise de política do Fed | macro |
| `geopolitical_risk_analysis` | Geopolitical Risk Analysis | Análise de riscos geopolíticos | macro |
| `global_macro_scan` | Global Macro Scan | Scan macro global | macro |
| `inflation_analysis` | Inflation Analysis | Análise de inflação | macro |
| `liquidity_conditions_analysis` | Liquidity Conditions Analysis | Análise de condições de liquidez | macro |
| `macro_environment_analysis` | Macro Environment Analysis | Análise do ambiente macro | macro |
| `market_regime_analysis` | Market Regime Analysis | Análise de regime de mercado | macro |
| `sector_sensitivity_analysis` | Sector Sensitivity Analysis | Sensibilidade setorial | macro |
| `yield_curve_analysis` | Yield Curve Analysis | Análise da curva de juros | macro |

### Stage: Analysis (2 prompts)

Prompts para análise inicial de ideias.

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `competitive_landscape_mapping` | Competitive Landscape Mapping | Mapeia paisagem competitiva | industry |
| `historical_parallel_finder` | Historical Parallel Finder | Encontra paralelos históricos | pattern_recognition |

### Stage: Market Analysis (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `earnings_season_analyzer` | Earnings Season Analyzer | Analisa temporada de earnings | earnings |
| `sector_momentum_ranker` | Sector Momentum Ranker | Ranking de momentum setorial | market |

### Stage: Discovery (5 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `historical_parallel_stress_test` | Historical Parallel Stress Test | Stress test com paralelos históricos | risk |
| `investment_presentation_creator` | Investment Presentation Creator | Cria apresentações de investimento | output |
| `sector_thesis_stress_test` | Sector Thesis Stress Test | Stress test de tese setorial | risk |
| `trend_to_equity_mapper` | Trend to Equity Mapper | Mapeia tendências para equities | thematic |
| `value_chain_mapper` | Value Chain Mapper | Mapeia cadeia de valor | industry |

---

## Lane B: Deep Research & Due Diligence (44 prompts)

O Lane B é responsável pela pesquisa profunda de ideias promovidas do Lane A.

### Stage: Business Analysis (6 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `business_economics` | Business Economics | Analisa unit economics | business_model |
| `business_overview_report` | Business Overview Report | Overview completo do negócio | business_model |
| `customer_analysis` | Customer Analysis | Análise de clientes | business_model |
| `geographic_analysis` | Geographic Analysis | Análise geográfica | operations |
| `supply_chain_analysis` | Supply Chain Analysis | Análise de supply chain | operations |
| `technology_ip_analysis` | Technology IP Analysis | Análise de tecnologia e IP | operations |

### Stage: Financial Analysis (10 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `capital_allocation_analysis` | Capital Allocation Analysis | Análise de alocação de capital | financial |
| `capital_structure_optimizer` | Capital Structure Optimizer | Otimiza estrutura de capital | financial_analysis |
| `debt_structure_analysis` | Debt Structure Analysis | Análise de estrutura de dívida | financial |
| `earnings_quality_analysis` | Earnings Quality Analysis | Qualidade dos earnings | financial |
| `financial_statement_analysis` | Financial Statement Analysis | Análise de demonstrações financeiras | financial |
| `growth_margin_drivers` | Growth Margin Drivers | Drivers de crescimento e margem | financial |
| `ma_history_analysis` | M&A History Analysis | Histórico de M&A | financial |
| `segment_analysis` | Segment Analysis | Análise por segmento | financial |
| `valuation_analysis` | Valuation Analysis | Análise de valuation | valuation |
| `working_capital_analysis` | Working Capital Analysis | Análise de capital de giro | financial |

### Stage: Industry Analysis (3 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `competitive_analysis` | Competitive Analysis | Análise competitiva | industry |
| `industry_overview` | Industry Overview | Overview da indústria | industry |
| `tam_sam_som_analyzer` | TAM SAM SOM Analyzer | Análise de mercado endereçável | market_analysis |

### Stage: Management Analysis (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `ceo_track_record` | CEO Track Record | Histórico do CEO | management |
| `management_quality_assessment` | Management Quality Assessment | Avaliação da qualidade da gestão | management |

### Stage: Risk Analysis (3 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `regulatory_risk_analysis` | Regulatory Risk Analysis | Análise de risco regulatório | risk |
| `risk_assessment` | Risk Assessment | Avaliação de riscos | risk |
| `risk_factor_identifier` | Risk Factor Identifier | Identificação de fatores de risco | risk_analysis |

### Stage: Catalyst Analysis (1 prompt)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `catalyst_identification` | Catalyst Identification | Identificação de catalisadores | catalysts |

### Stage: ESG Analysis (1 prompt)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `esg_analysis` | ESG Analysis | Análise ESG | esg |

### Stage: Technical Analysis (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `insider_activity_analysis` | Insider Activity Analysis | Análise de atividade de insiders | technical |
| `short_interest_analysis` | Short Interest Analysis | Análise de short interest | technical |

### Stage: Thesis Development (5 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `bull_bear_analysis` | Bull Bear Analysis | Análise bull/bear | thesis |
| `contrarian_thesis_development` | Contrarian Thesis Development | Desenvolvimento de tese contrarian | strategy |
| `investment_thesis_synthesis` | Investment Thesis Synthesis | Síntese da tese de investimento | synthesis |
| `peer_thesis_comparison` | Peer Thesis Comparison | Comparação de teses com peers | analysis |
| `variant_perception` | Variant Perception | Identificação de variant perception | edge |

### Stage: Synthesis (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `bull_bear_case_generator` | Bull Bear Case Generator | Gerador de casos bull/bear | scenario |
| `earnings_preview_generator` | Earnings Preview Generator | Gerador de preview de earnings | earnings |

### Stage: Special Situations (3 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `activist_situation_analyzer` | Activist Situation Analyzer | Análise de situações de ativismo | activism |
| `ipo_analysis` | IPO Analysis | Análise de IPOs | ipo |
| `spinoff_opportunity_analyzer` | Spinoff Opportunity Analyzer | Análise de oportunidades de spinoff | corporate_actions |

### Stage: Risk Assessment (1 prompt)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `pre_mortem_analysis` | Pre Mortem Analysis | Análise pre-mortem | risk |

### Stage: Thesis Monitoring (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `thesis_monitoring_framework` | Thesis Monitoring Framework | Framework de monitoramento de tese | monitoring |
| `thesis_update` | Thesis Update | Atualização de tese | monitoring |

### Stage: Output (2 prompts)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `investment_memo` | Investment Memo | Memo de investimento | output |
| `thesis_presentation` | Thesis Presentation | Apresentação de tese | output |

### Stage: Execution (1 prompt)

| Prompt ID | Nome | Objetivo | Subcategoria |
|-----------|------|----------|--------------|
| `exit_strategy` | Exit Strategy | Estratégia de saída | execution |

---

## Portfolio Lane (21 prompts)

Prompts para gestão de portfólio.

### Stage: Construction (2 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `portfolio_construction` | Portfolio Construction | Construção de portfólio |
| `position_sizer` | Position Sizer | Dimensionamento de posições |

### Stage: Risk Management (10 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `benchmark_comparison` | Benchmark Comparison | Comparação com benchmark |
| `correlation_analysis` | Correlation Analysis | Análise de correlação |
| `drawdown_analysis` | Drawdown Analysis | Análise de drawdown |
| `factor_exposure_analysis` | Factor Exposure Analysis | Análise de exposição a fatores |
| `income_analysis` | Income Analysis | Análise de renda |
| `liquidity_analysis` | Liquidity Analysis | Análise de liquidez |
| `performance_attribution` | Performance Attribution | Atribuição de performance |
| `position_sizing` | Position Sizing | Dimensionamento de posições |
| `risk_monitoring` | Risk Monitoring | Monitoramento de risco |
| `scenario_analysis` | Scenario Analysis | Análise de cenários |

### Stage: Execution (2 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `rebalancing_analysis` | Rebalancing Analysis | Análise de rebalanceamento |
| `transition_management` | Transition Management | Gestão de transição |

### Stage: Hedging (2 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `currency_hedging_analysis` | Currency Hedging Analysis | Análise de hedge cambial |
| `options_overlay_strategy` | Options Overlay Strategy | Estratégia de overlay de opções |

### Stage: Compliance (1 prompt)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `investment_policy_compliance` | Investment Policy Compliance | Compliance com política de investimento |

### Stage: Tax Management (1 prompt)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `tax_loss_harvesting` | Tax Loss Harvesting | Tax loss harvesting |

### Stage: Strategy (1 prompt)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `sector_rotation_analysis` | Sector Rotation Analysis | Análise de rotação setorial |

### Stage: Portfolio Analytics (2 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `esg_portfolio_analysis` | ESG Portfolio Analysis | Análise ESG do portfólio |
| `factor_exposure_analyzer` | Factor Exposure Analyzer | Analisador de exposição a fatores |

---

## Monitoring Lane (2 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `news_sentiment_monitor` | News Sentiment Monitor | Monitoramento de sentimento de notícias |
| `portfolio_performance_reporter` | Portfolio Performance Reporter | Relatório de performance do portfólio |

---

## Utility Lane (7 prompts)

| Prompt ID | Nome | Objetivo |
|-----------|------|----------|
| `competitor_earnings_comparison` | Competitor Earnings Comparison | Comparação de earnings de concorrentes |
| `daily_market_briefing` | Daily Market Briefing | Briefing diário de mercado |
| `earnings_call_analysis` | Earnings Call Analysis | Análise de earnings calls |
| `news_sentiment_analysis` | News Sentiment Analysis | Análise de sentimento de notícias |
| `research_report_summary` | Research Report Summary | Resumo de relatórios de pesquisa |
| `sec_filing_analysis` | SEC Filing Analysis | Análise de filings SEC |
| `watchlist_screening` | Watchlist Screening | Screening de watchlist |

---

## Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LANE A: DISCOVERY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   MACRO      │    │   SIGNAL     │    │  SCREENING   │                  │
│  │   CONTEXT    │    │  COLLECTION  │    │              │                  │
│  │  (16 prompts)│    │  (9 prompts) │    │  (8 prompts) │                  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             ▼                                              │
│                    ┌──────────────┐                                        │
│                    │   ANALYSIS   │                                        │
│                    │  (2 prompts) │                                        │
│                    └──────┬───────┘                                        │
│                           │                                                │
│                           ▼                                                │
│                    ┌──────────────┐                                        │
│                    │  DISCOVERY   │                                        │
│                    │  (5 prompts) │                                        │
│                    └──────┬───────┘                                        │
│                           │                                                │
│                           ▼                                                │
│                    ┌──────────────┐                                        │
│                    │   PROMOTE    │──────────────────────────────────────┐ │
│                    │   TO LANE B  │                                      │ │
│                    └──────────────┘                                      │ │
└─────────────────────────────────────────────────────────────────────────┼──┘
                                                                          │
┌─────────────────────────────────────────────────────────────────────────┼──┐
│                         LANE B: DEEP RESEARCH                           │  │
├─────────────────────────────────────────────────────────────────────────┼──┤
│                                                                         ▼  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │  │
│  │   BUSINESS   │    │  FINANCIAL   │    │   INDUSTRY   │              │  │
│  │   ANALYSIS   │    │   ANALYSIS   │    │   ANALYSIS   │              │  │
│  │  (6 prompts) │    │ (10 prompts) │    │  (3 prompts) │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │  │
│         │                   │                   │                       │  │
│         └───────────────────┼───────────────────┘                       │  │
│                             ▼                                           │  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │  │
│  │  MANAGEMENT  │    │     RISK     │    │   CATALYST   │              │  │
│  │   ANALYSIS   │    │   ANALYSIS   │    │   ANALYSIS   │              │  │
│  │  (2 prompts) │    │  (3 prompts) │    │  (1 prompt)  │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │  │
│         │                   │                   │                       │  │
│         └───────────────────┼───────────────────┘                       │  │
│                             ▼                                           │  │
│                    ┌──────────────┐                                     │  │
│                    │    THESIS    │                                     │  │
│                    │ DEVELOPMENT  │                                     │  │
│                    │  (5 prompts) │                                     │  │
│                    └──────┬───────┘                                     │  │
│                           │                                             │  │
│                           ▼                                             │  │
│                    ┌──────────────┐                                     │  │
│                    │  SYNTHESIS   │                                     │  │
│                    │  (2 prompts) │                                     │  │
│                    └──────┬───────┘                                     │  │
│                           │                                             │  │
│                           ▼                                             │  │
│                    ┌──────────────┐                                     │  │
│                    │    OUTPUT    │                                     │  │
│                    │  (2 prompts) │                                     │  │
│                    └──────────────┘                                     │  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Core Pipeline (Critical)

1. **Lane A Discovery** - `lane_a_idea_generation` (já implementado)
2. **Lane B Business Analysis** - `business_overview_report`, `business_economics`
3. **Lane B Financial Analysis** - `valuation_analysis`, `financial_statement_analysis`
4. **Lane B Thesis** - `bull_bear_analysis`, `investment_thesis_synthesis`

### Phase 2: Enhanced Research

5. **Lane B Industry** - `competitive_analysis`, `industry_overview`
6. **Lane B Management** - `management_quality_assessment`, `ceo_track_record`
7. **Lane B Risk** - `risk_assessment`, `risk_factor_identifier`
8. **Lane B Catalysts** - `catalyst_identification`

### Phase 3: Alternative Data

9. **Lane A Signal Collection** - `social_sentiment_scanner`, `insider_trading_analysis`
10. **Lane A Macro** - `macro_environment_analysis`, `fed_policy_analysis`

### Phase 4: Portfolio Management

11. **Portfolio Construction** - `portfolio_construction`, `position_sizer`
12. **Portfolio Risk** - `risk_monitoring`, `scenario_analysis`

### Phase 5: Advanced Features

13. **Special Situations** - `activist_situation_analyzer`, `spinoff_opportunity_analyzer`
14. **Monitoring** - `thesis_monitoring_framework`, `news_sentiment_monitor`
