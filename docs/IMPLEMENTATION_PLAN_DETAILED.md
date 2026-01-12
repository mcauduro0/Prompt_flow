# ARC Investment Factory - Detailed Implementation Plan

## Overview

Este documento fornece o plano de implementação passo-a-passo para atualizar os prompts do sistema, preservando a arquitetura existente dos Lanes A/B.

---

## Pre-Implementation Checklist

### Completed ✅

- [x] Gemini API key configurada e testada
- [x] GeminiClient implementado em `packages/llm-client/src/providers/gemini.ts`
- [x] LLM types atualizados para suportar `google` provider
- [x] Executor atualizado com pricing do Gemini
- [x] Build validado sem erros

### Pending

- [ ] Backup de `prompts_full.json`
- [ ] Extração de templates de `all_prompts_final.md`
- [ ] Atualização de prompts com templates reais
- [ ] Configuração de Gemini nos prompts de Lane B
- [ ] Testes de integração

---

## Implementation Steps

### Step 1: Backup Current State

```bash
# Backup prompts_full.json
cp packages/worker/src/prompts/library/prompts_full.json \
   packages/worker/src/prompts/library/prompts_full.json.backup

# Backup prompts.json
cp packages/worker/src/prompts/library/prompts.json \
   packages/worker/src/prompts/library/prompts.json.backup
```

### Step 2: Template Extraction Strategy

**Fonte:** `docs/all_prompts_final.md`

**Método de Extração:**

1. Cada prompt no arquivo segue o formato:
   ```markdown
   ### X.X Prompt Name
   **Category:** ...
   **Objective:** ...
   **System Prompt:**
   ```
   [prompt content]
   ```
   **User Prompt Template:**
   ```
   [template content]
   ```
   ```

2. Extrair `system_prompt` e `user_prompt_template` separadamente
3. Manter `prompt_id` existente (snake_case do nome)
4. Preservar `lane`, `stage`, `output_schema` existentes

### Step 3: Priority Prompts for Lane B (Gemini)

**Ordem de Implementação:**

| Prioridade | Prompt ID | Categoria | LLM |
|------------|-----------|-----------|-----|
| P1 | `business_model_analysis` | Business | gemini-2.5-flash |
| P1 | `financial_statement_analysis` | Financial | gemini-2.5-flash |
| P1 | `valuation_analysis` | Valuation | gemini-2.5-flash |
| P1 | `competitive_analysis` | Industry | gemini-2.5-flash |
| P1 | `risk_assessment` | Risk | gemini-2.5-flash |
| P1 | `investment_thesis_synthesis` | Thesis | gemini-2.5-flash |
| P2 | `management_quality_assessment` | Management | gemini-2.5-flash |
| P2 | `catalyst_identification` | Catalyst | gemini-2.5-flash |
| P2 | `bull_bear_analysis` | Thesis | gemini-2.5-flash |
| P3 | `business_overview_report` | Business | gemini-2.5-flash |

### Step 4: Prompt Update Format

**Estrutura Atual (Placeholder):**
```json
{
  "prompt_id": "competitive_analysis",
  "version": "1.0.0",
  "name": "Competitive Analysis",
  "description": "industry",
  "lane": "lane_b",
  "stage": "research",
  "execution_type": "llm",
  "criticality": "required",
  "llm_config": {
    "provider": "openai",
    "model": "gpt-4-turbo-preview",
    "temperature": 0.5,
    "max_tokens": 4000
  },
  "system_prompt": "You are a financial analyst specializing in industry.",
  "user_prompt_template": "Analyze {{ticker}} for competitive analysis."
}
```

**Estrutura Atualizada (Real + Gemini):**
```json
{
  "prompt_id": "competitive_analysis",
  "version": "2.0.0",
  "name": "Competitive Analysis",
  "description": "Comprehensive competitive positioning and industry analysis",
  "lane": "lane_b",
  "stage": "research",
  "execution_type": "llm",
  "criticality": "required",
  "llm_config": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "temperature": 0.2,
    "max_tokens": 4000
  },
  "system_prompt": "[REAL SYSTEM PROMPT FROM all_prompts_final.md]",
  "user_prompt_template": "[REAL USER TEMPLATE FROM all_prompts_final.md]"
}
```

### Step 5: Orchestrator Update

**Arquivo:** `packages/worker/src/prompts/orchestrator.ts`

**Mudança:** Apenas atualizar a ordem de execução para incluir novos módulos.

**Antes:**
```typescript
const promptIds = [
  'gate_data_sufficiency',
  'business_model_analysis',
  'valuation_analysis',
  'risk_assessment',
  'investment_thesis_synthesis',
  'gate_style_fit',
];
```

**Depois:**
```typescript
const promptIds = [
  'gate_data_sufficiency',
  'business_model_analysis',
  'financial_statement_analysis',  // NOVO
  'competitive_analysis',           // NOVO
  'valuation_analysis',
  'management_quality_assessment',  // NOVO
  'risk_assessment',
  'catalyst_identification',        // NOVO
  'investment_thesis_synthesis',
  'gate_style_fit',
];
```

---

## Template Mapping from all_prompts_final.md

### Business Analysis Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `business_model_analysis` | 1.1 Business Model Analysis | Já tem template real |
| `business_overview_report` | 1.2 Business Overview Report | Precisa atualizar |
| `business_economics` | 1.3 Business Economics | Novo prompt |
| `customer_analysis` | 1.4 Customer Analysis | Novo prompt |

### Financial Analysis Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `financial_statement_analysis` | 2.1 Financial Statement Analysis | Precisa atualizar |
| `earnings_quality_analysis` | 2.2 Earnings Quality Analysis | Novo prompt |
| `cash_flow_analysis` | 2.3 Cash Flow Analysis | Novo prompt |
| `balance_sheet_analysis` | 2.4 Balance Sheet Analysis | Novo prompt |

### Valuation Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `valuation_analysis` | 3.1 Valuation Analysis | Já tem template real |
| `dcf_model` | 3.2 DCF Model | Novo prompt |
| `relative_valuation` | 3.3 Relative Valuation | Novo prompt |

### Industry/Competitive Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `competitive_analysis` | 4.1 Competitive Analysis | Precisa atualizar |
| `industry_overview` | 4.2 Industry Overview | Novo prompt |
| `porter_five_forces` | 4.3 Porter's Five Forces | Novo prompt |

### Risk Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `risk_assessment` | 5.1 Risk Assessment | Já tem template real |
| `risk_factor_identifier` | 5.2 Risk Factor Identifier | Precisa atualizar |

### Thesis Prompts

| Prompt ID | Section in MD | Status |
|-----------|---------------|--------|
| `investment_thesis_synthesis` | 6.1 Investment Thesis Synthesis | Já tem template real |
| `bull_bear_analysis` | 6.2 Bull/Bear Analysis | Precisa atualizar |
| `variant_perception` | 6.3 Variant Perception | Novo prompt |

---

## Validation Checklist

### After Each Prompt Update

- [ ] JSON válido (sem erros de sintaxe)
- [ ] `prompt_id` mantido igual
- [ ] `lane` e `stage` preservados
- [ ] `llm_config.provider` = "google"
- [ ] `llm_config.model` = "gemini-2.5-flash"
- [ ] `system_prompt` atualizado com template real
- [ ] `user_prompt_template` atualizado com template real
- [ ] `output_schema` preservado ou melhorado

### After All Updates

- [ ] `pnpm build` sem erros
- [ ] Lane A executa normalmente
- [ ] Lane B executa com Gemini
- [ ] Telemetria registra corretamente
- [ ] Custos dentro do esperado

---

## Rollback Procedure

Se algo der errado:

```bash
# Restaurar prompts_full.json
cp packages/worker/src/prompts/library/prompts_full.json.backup \
   packages/worker/src/prompts/library/prompts_full.json

# Rebuild
pnpm build

# Testar
pnpm tsx scripts/run-lane-a.ts
```

---

## Timeline

| Dia | Atividade | Horas |
|-----|-----------|-------|
| 1 | Backup + Extração de templates P1 | 4h |
| 1 | Atualização de 6 prompts P1 | 4h |
| 2 | Atualização de 4 prompts P2 | 3h |
| 2 | Testes de integração | 3h |
| 3 | Ajustes e correções | 4h |
| 3 | Documentação final | 2h |

**Total estimado:** 20 horas

---

## Success Metrics

| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Prompts com template real | 8 | 20+ | 100% dos usados |
| Lane B usando Gemini | 0% | 100% | 100% |
| Custo por análise | ~$0.002 | ~$0.001 | Redução de 50% |
| Qualidade de análise | Básica | Profunda | Melhoria significativa |
| Tempo de execução | ~50s | ~60s | Aceitável |
