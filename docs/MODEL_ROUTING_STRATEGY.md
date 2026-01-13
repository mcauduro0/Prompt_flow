# ARC Investment Factory - Model Routing Strategy

## Overview

This document defines the strategic allocation of LLM models across the prompt library to optimize for quality, cost, and latency.

## Available Models (State-of-the-Art)

| Model | Provider | Context | Strengths | Cost (per 1M tokens) |
|-------|----------|---------|-----------|---------------------|
| **gpt-5.2-chat-latest** | OpenAI | 256K | Fast, reliable, good reasoning | $5 in / $20 out |
| **gemini-2.5-pro** | Google | 2M | Deep analysis, long documents | $1.25 in / $5 out |
| **claude-opus-4-20250514** | Anthropic | 200K | Complex reasoning, nuanced analysis | $15 in / $75 out |

## Routing Strategy by Prompt Category

### Lane A - Discovery (42 prompts)

| Category | Model | Rationale |
|----------|-------|-----------|
| **Macro Context** (16) | gpt-5.2-chat-latest | Fast screening, real-time data |
| **Signal Collection** (9) | gpt-5.2-chat-latest | High volume, needs speed |
| **Screening** (8) | gpt-5.2-chat-latest | Quick filtering |
| **Discovery** (5) | gpt-5.2-chat-latest | Pattern recognition |
| **Gates** (4) | gpt-5.2-chat-latest | Binary decisions |

### Lane B - Deep Research (44 prompts)

| Category | Model | Rationale |
|----------|-------|-----------|
| **Business Analysis** (6) | gemini-2.5-pro | Long documents, deep analysis |
| **Financial Analysis** (10) | gemini-2.5-pro | Complex calculations, detailed review |
| **Industry Analysis** (3) | gemini-2.5-pro | Comprehensive research |
| **Management Analysis** (2) | claude-opus-4-20250514 | Nuanced judgment |
| **Risk Analysis** (3) | gemini-2.5-pro | Thorough assessment |
| **Thesis Development** (5) | claude-opus-4-20250514 | Complex reasoning, synthesis |
| **Synthesis & Output** (4) | claude-opus-4-20250514 | High-quality writing |
| **Special Situations** (3) | claude-opus-4-20250514 | Nuanced analysis |

### Portfolio Management (21 prompts)

| Category | Model | Rationale |
|----------|-------|-----------|
| **Construction** | gpt-5.2-chat-latest | Quantitative focus |
| **Risk Monitoring** | gpt-5.2-chat-latest | Real-time updates |
| **Performance** | gpt-5.2-chat-latest | Standard calculations |

### Monitoring (2 prompts)

| Category | Model | Rationale |
|----------|-------|-----------|
| **News/Sentiment** | gpt-5.2-chat-latest | Fast processing |

### Utility (7 prompts)

| Category | Model | Rationale |
|----------|-------|-----------|
| **Briefings** | gpt-5.2-chat-latest | Quick summaries |
| **Compliance** | gpt-5.2-chat-latest | Rule-based checks |

## Model Assignment Summary

| Model | Prompt Count | Percentage | Primary Use |
|-------|--------------|------------|-------------|
| **gpt-5.2-chat-latest** | 85 | 73% | Lane A, Portfolio, Monitoring, Utility |
| **gemini-2.5-pro** | 22 | 19% | Lane B Research & Analysis |
| **claude-opus-4-20250514** | 9 | 8% | Lane B Synthesis & Complex Reasoning |

## Specific Prompt Assignments

### Claude Opus 4 (9 prompts - Complex Reasoning)

1. `investment_thesis_synthesis` - Core thesis development
2. `bull_bear_analysis` - Scenario analysis
3. `contrarian_thesis_development` - Counter-arguments
4. `variant_perception` - Differentiated views
5. `investment_memo` - Final synthesis
6. `thesis_presentation` - Executive summary
7. `management_quality_assessment` - Leadership evaluation
8. `ceo_track_record` - Track record analysis
9. `activist_situation_analyzer` - Special situations

### Gemini 2.5 Pro (22 prompts - Deep Research)

1. `business_overview_report` - Comprehensive business analysis
2. `financial_statement_analysis` - Detailed financials
3. `valuation_analysis` - DCF and multiples
4. `competitive_analysis` - Industry dynamics
5. `industry_overview` - Sector analysis
6. `risk_assessment` - Risk identification
7. `risk_factor_identifier` - Risk cataloging
8. `regulatory_risk_analysis` - Regulatory review
9. `supply_chain_analysis` - Supply chain mapping
10. `customer_analysis` - Customer base analysis
11. `segment_analysis` - Business segments
12. `geographic_analysis` - Geographic exposure
13. `capital_allocation_analysis` - Capital deployment
14. `debt_structure_analysis` - Debt analysis
15. `working_capital_analysis` - Working capital
16. `earnings_quality_analysis` - Earnings quality
17. `technology_ip_analysis` - IP and tech
18. `esg_analysis` - ESG factors
19. `ma_history_analysis` - M&A track record
20. `ipo_analysis` - IPO analysis
21. `spinoff_opportunity_analyzer` - Spinoff analysis
22. `tam_sam_som_analyzer` - Market sizing

### GPT-5.2 (85 prompts - Everything Else)

All remaining prompts for fast, reliable processing.

## Fallback Strategy

If a model is unavailable:

1. **Claude Opus 4** → Fallback to **Gemini 2.5 Pro**
2. **Gemini 2.5 Pro** → Fallback to **GPT-5.2**
3. **GPT-5.2** → Fallback to **GPT-4o**

## Cost Estimation (Per Full Pipeline Run)

| Lane | Prompts | Est. Tokens | Est. Cost |
|------|---------|-------------|-----------|
| Lane A (full) | 42 | ~100K | ~$0.50 |
| Lane B (full) | 44 | ~200K | ~$3.00 |
| Portfolio | 21 | ~50K | ~$0.25 |
| **Total** | 107 | ~350K | ~$3.75 |

## Implementation

The model routing is implemented in `prompts_full.json` via the `llm_config.model` field for each prompt.
