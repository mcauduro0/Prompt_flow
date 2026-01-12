# ARC Investment Factory - Prompt Upgrade Analysis

## Executive Summary

Este documento analisa a estrutura atual do sistema e define uma estratégia de **melhoria incremental** dos prompts que:

1. **PRESERVA** a lógica fundamental dos Lanes A/B
2. **MELHORA** a qualidade dos prompts existentes
3. **ADICIONA** novos prompts apenas onde há gaps identificados
4. **PRIORIZA** Gemini 2.5 Flash para Lane B e Due Diligence

---

## Current System Architecture

### Estrutura Atual dos Lanes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANE A: DAILY DISCOVERY                           │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │ gate_data_       │ -> │ lane_a_idea_     │ -> │ gate_coherence   │      │
│  │ sufficiency      │    │ generation       │    │                  │      │
│  │ (code)           │    │ (LLM)            │    │ (code)           │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│                                                                             │
│  Trigger: Daily schedule (6:00 AM ET)                                       │
│  Input: Stock universe from FMP screener                                    │
│  Output: Investment ideas with conviction scores                            │
│                                                                             │
│  FLOW: Screening -> Enrichment -> LLM Analysis -> Gate Validation           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ MANUAL PROMOTION
                                    │ (User reviews ideas in Inbox)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANE B: DEEP RESEARCH                               │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │ gate_data_       │ -> │ business_model_  │ -> │ industry_moat_   │      │
│  │ sufficiency      │    │ analysis         │    │ analysis         │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │ financial_       │ -> │ capital_         │ -> │ management_      │      │
│  │ forensics        │    │ allocation       │    │ quality          │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │ valuation_       │ -> │ risk_            │ -> │ investment_      │      │
│  │ analysis         │    │ assessment       │    │ thesis_synthesis │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ gate_style_fit   │                                                       │
│  │ (code)           │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
│  Trigger: Manual promotion from Lane A                                      │
│  Input: Single ticker + idea context                                        │
│  Output: Complete research report + recommendation                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Arquivos de Prompts Atuais

| Arquivo | Prompts | Status | Templates |
|---------|---------|--------|-----------|
| `prompts.json` | 8 | **REAL** | Templates completos e funcionais |
| `prompts_full.json` | 116 | **PLACEHOLDER** | Templates genéricos |

### Prompts com Templates REAIS (prompts.json)

| Prompt ID | Lane | Stage | LLM | Status |
|-----------|------|-------|-----|--------|
| `gate_data_sufficiency` | lane_a | discovery | code | ✅ Funcional |
| `lane_a_idea_generation` | lane_a | discovery | gpt-4o | ✅ Funcional |
| `gate_coherence` | lane_a | discovery | code | ✅ Funcional |
| `business_model_analysis` | lane_b | research | claude-3-sonnet | ✅ Funcional |
| `valuation_analysis` | lane_b | research | gpt-4o | ✅ Funcional |
| `risk_assessment` | lane_b | research | gpt-4o | ✅ Funcional |
| `investment_thesis_synthesis` | lane_b | research | gpt-4o | ✅ Funcional |
| `gate_style_fit` | lane_b | research | code | ✅ Funcional |

---

## Gap Analysis: Current vs New Prompts

### Lane A Gaps

| Área | Prompts Atuais | Prompts Novos Necessários | Prioridade |
|------|----------------|---------------------------|------------|
| **Macro Context** | 0 | `macro_environment_analysis` | Alta |
| **Signal Collection** | 0 | `social_sentiment_scanner` | Média |
| **Screening** | 1 (lane_a_idea_generation) | `thematic_idea_generator` | Média |
| **Gates** | 2 | Suficiente | - |

### Lane B Gaps

| Área | Prompts Atuais | Prompts Novos Necessários | Prioridade |
|------|----------------|---------------------------|------------|
| **Business Analysis** | 1 (business_model_analysis) | `business_economics`, `customer_analysis` | Alta |
| **Financial Analysis** | 1 (valuation_analysis) | `financial_statement_analysis`, `earnings_quality_analysis` | Alta |
| **Industry Analysis** | 0 | `competitive_analysis`, `industry_overview` | Alta |
| **Management Analysis** | 0 | `management_quality_assessment`, `ceo_track_record` | Alta |
| **Risk Analysis** | 1 (risk_assessment) | `risk_factor_identifier` | Média |
| **Catalyst Analysis** | 0 | `catalyst_identification` | Alta |
| **Thesis** | 1 (investment_thesis_synthesis) | `bull_bear_analysis` | Média |

---

## Upgrade Strategy: Incremental Improvement

### Princípio Fundamental

> **NÃO alterar o fluxo do pipeline. Apenas MELHORAR os prompts existentes e ADICIONAR novos prompts onde há gaps.**

### Estratégia de 3 Níveis

#### Nível 1: Upgrade de Templates Existentes (PRIORIDADE MÁXIMA)

Substituir os templates placeholder por templates reais do `all_prompts_final.md`.

**Ação:** Atualizar `prompts_full.json` com templates reais, mantendo:
- Mesma estrutura de prompt_id
- Mesma posição no pipeline (lane, stage)
- Mesmos data sources
- Mesmos output schemas

**Mudança de LLM:** Atualizar de OpenAI para **Gemini 2.5 Flash** nos prompts de Lane B.

#### Nível 2: Adição de Prompts de Gap (PRIORIDADE ALTA)

Adicionar novos prompts apenas onde há gaps identificados, sem alterar o fluxo.

**Lane A - Adicionar:**
- `macro_environment_analysis` (antes do screening)

**Lane B - Adicionar:**
- `financial_statement_analysis` (antes de valuation)
- `competitive_analysis` (após business_model)
- `management_quality_assessment` (novo módulo)
- `catalyst_identification` (após risk_assessment)

#### Nível 3: Expansão Opcional (PRIORIDADE BAIXA)

Prompts adicionais que podem ser adicionados posteriormente sem alterar o fluxo core.

---

## Detailed Upgrade Plan

### Phase 1: Template Upgrade (Não altera fluxo)

**Objetivo:** Substituir templates placeholder por templates reais.

**Prompts a Atualizar:**

| Prompt ID | Template Atual | Template Novo | LLM Novo |
|-----------|----------------|---------------|----------|
| `bull_bear_analysis` | Placeholder genérico | Template completo de `all_prompts_final.md` | Gemini 2.5 Flash |
| `business_overview_report` | Placeholder genérico | Template completo | Gemini 2.5 Flash |
| `capital_allocation_analysis` | Placeholder genérico | Template completo | Gemini 2.5 Flash |
| `competitive_analysis` | Placeholder genérico | Template completo | Gemini 2.5 Flash |
| `financial_statement_analysis` | Placeholder genérico | Template completo | Gemini 2.5 Flash |
| `management_quality_assessment` | Placeholder genérico | Template completo | Gemini 2.5 Flash |
| `catalyst_identification` | Placeholder genérico | Template completo | Gemini 2.5 Flash |

### Phase 2: LLM Configuration (Gemini Priority)

**Configuração de LLM por Lane:**

| Lane | Stage | LLM Primário | LLM Fallback | Justificativa |
|------|-------|--------------|--------------|---------------|
| Lane A | discovery | GPT-4o-mini | Gemini Flash | Velocidade para screening |
| Lane A | macro | Gemini 2.5 Flash | GPT-4o | Análise profunda |
| Lane B | business_analysis | **Gemini 2.5 Flash** | Claude-3 | Due diligence profunda |
| Lane B | financial_analysis | **Gemini 2.5 Flash** | GPT-4o | Análise numérica |
| Lane B | industry_analysis | **Gemini 2.5 Flash** | GPT-4o | Pesquisa competitiva |
| Lane B | management_analysis | **Gemini 2.5 Flash** | Claude-3 | Análise qualitativa |
| Lane B | risk_analysis | **Gemini 2.5 Flash** | GPT-4o | Identificação de riscos |
| Lane B | thesis_development | **Gemini 2.5 Flash** | Claude-3 | Síntese final |

### Phase 3: Pipeline Integration (Preserva Fluxo)

**Lane A - Fluxo Preservado:**

```
[ATUAL]
gate_data_sufficiency -> lane_a_idea_generation -> gate_coherence

[UPGRADE - Mesmo fluxo, prompts melhorados]
gate_data_sufficiency -> lane_a_idea_generation* -> gate_coherence
                              │
                              └── * Template atualizado com mais contexto
```

**Lane B - Fluxo Preservado:**

```
[ATUAL]
gate_data_sufficiency 
    -> business_model_analysis 
    -> valuation_analysis 
    -> risk_assessment 
    -> investment_thesis_synthesis 
    -> gate_style_fit

[UPGRADE - Mesmo fluxo, mais módulos]
gate_data_sufficiency 
    -> business_model_analysis*     [Template melhorado + Gemini]
    -> financial_statement_analysis [NOVO - antes de valuation]
    -> competitive_analysis         [NOVO - contexto de indústria]
    -> valuation_analysis*          [Template melhorado + Gemini]
    -> management_quality_assessment [NOVO - análise de gestão]
    -> risk_assessment*             [Template melhorado + Gemini]
    -> catalyst_identification      [NOVO - catalisadores]
    -> investment_thesis_synthesis* [Template melhorado + Gemini]
    -> gate_style_fit
```

---

## What DOES NOT Change

### Arquitetura Preservada

1. **Lane A Trigger:** Daily schedule às 6:00 AM ET
2. **Lane A Input:** Stock universe do FMP screener
3. **Lane A Output:** Ideas com conviction scores para Inbox
4. **Promotion Flow:** Manual via UI (Inbox -> Lane B)
5. **Lane B Trigger:** Quando usuário promove idea
6. **Lane B Input:** Single ticker + idea context
7. **Lane B Output:** Research report + recommendation
8. **Gate Logic:** Mesma lógica de validação
9. **Budget Control:** Mesmos limites e tracking
10. **Telemetry:** Mesma estrutura de métricas

### Código Preservado

- `orchestrator.ts` - Mesma lógica de execução
- `executor.ts` - Mesma interface de execução
- `selector.ts` - Mesma lógica de seleção
- `library-loader.ts` - Mesma estrutura de carregamento
- `budget/controller.ts` - Mesmos controles
- `telemetry/store.ts` - Mesmas métricas
- `quarantine/store.ts` - Mesma lógica

---

## What DOES Change

### Prompts Melhorados

1. **Templates:** Substituição de placeholders por templates reais e detalhados
2. **LLM Config:** Atualização para Gemini 2.5 Flash em Lane B
3. **Output Schemas:** Schemas mais específicos e validáveis
4. **Data Sources:** Mapeamento mais preciso de fontes necessárias

### Novos Prompts (Adições, não substituições)

| Prompt ID | Posição no Pipeline | Justificativa |
|-----------|---------------------|---------------|
| `financial_statement_analysis` | Antes de `valuation_analysis` | Base para valuation |
| `competitive_analysis` | Após `business_model_analysis` | Contexto competitivo |
| `management_quality_assessment` | Após `competitive_analysis` | Análise de gestão |
| `catalyst_identification` | Após `risk_assessment` | Timing de investimento |

---

## Implementation Checklist

### Pre-Implementation

- [ ] Backup de `prompts_full.json` atual
- [ ] Validar que `prompts.json` (8 prompts reais) está funcionando
- [ ] Testar conexão com Gemini API

### Phase 1: Template Upgrade

- [ ] Extrair templates de `all_prompts_final.md`
- [ ] Atualizar templates em `prompts_full.json`
- [ ] Manter mesmos prompt_ids
- [ ] Manter mesmas posições (lane, stage)
- [ ] Validar JSON schema

### Phase 2: LLM Configuration

- [ ] Adicionar configuração Gemini ao sistema
- [ ] Atualizar `llm_config` nos prompts de Lane B
- [ ] Testar execução com Gemini
- [ ] Configurar fallback para OpenAI

### Phase 3: Gap Filling

- [ ] Adicionar `financial_statement_analysis`
- [ ] Adicionar `competitive_analysis`
- [ ] Adicionar `management_quality_assessment`
- [ ] Adicionar `catalyst_identification`
- [ ] Atualizar ordem de execução no orchestrator

### Post-Implementation

- [ ] Executar Lane A com dados reais
- [ ] Executar Lane B com dados reais
- [ ] Validar telemetria
- [ ] Verificar custos

---

## Risk Mitigation

### Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Templates incompatíveis | Média | Alto | Validação de schema antes de deploy |
| Gemini API indisponível | Baixa | Alto | Fallback para OpenAI configurado |
| Aumento de custo | Média | Médio | Budget control existente |
| Quebra de pipeline | Baixa | Alto | Testes em ambiente isolado primeiro |

### Rollback Plan

1. Manter `prompts.json` original intacto
2. Backup de `prompts_full.json` antes de alterações
3. Flag para alternar entre versões
4. Monitoramento de erros em tempo real

---

## Conclusion

Esta estratégia de upgrade:

1. **PRESERVA** 100% da lógica de pipeline existente
2. **MELHORA** a qualidade dos prompts com templates reais
3. **PRIORIZA** Gemini 2.5 Flash para análises de Due Diligence
4. **ADICIONA** prompts apenas onde há gaps identificados
5. **MANTÉM** compatibilidade retroativa total

O sistema continuará funcionando exatamente como antes, mas com:
- Prompts mais detalhados e específicos
- Análises mais profundas via Gemini
- Cobertura mais completa de due diligence
