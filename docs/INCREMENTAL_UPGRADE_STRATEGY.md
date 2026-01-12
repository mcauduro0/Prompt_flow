# ARC Investment Factory - Incremental Upgrade Strategy

## Estratégia de Melhoria Incremental

Este documento define a estratégia exata de implementação que **preserva o fluxo do pipeline** enquanto melhora a qualidade dos prompts.

---

## Princípios Fundamentais

### O que NÃO muda:

1. **Fluxo do Lane A:**
   ```
   Screening → Enrichment → LLM Analysis → Gate Validation → Inbox
   ```

2. **Fluxo do Lane B:**
   ```
   Promotion → Data Fetch → Research Modules → Synthesis → Output
   ```

3. **Trigger do Lane A:** Daily schedule
4. **Trigger do Lane B:** Manual promotion pelo usuário
5. **Estrutura de dados:** Input/output schemas existentes
6. **Telemetria:** Mesmas métricas e tracking
7. **Budget Control:** Mesmos limites

### O que MUDA:

1. **Conteúdo dos templates:** Mais detalhados e específicos
2. **LLM provider:** Gemini 2.5 Flash para Lane B
3. **Cobertura:** Novos módulos de análise onde há gaps

---

## Implementação em 3 Fases

### Fase 1: Upgrade de Templates (Semana 1)

**Objetivo:** Substituir templates placeholder por templates reais sem alterar estrutura.

**Método:**
- Ler template de `all_prompts_final.md`
- Atualizar campo `template` ou `system_prompt` + `user_prompt_template`
- Manter todos os outros campos iguais

**Prompts a Atualizar (Lane B - Due Diligence):**

| Prompt ID | Prioridade | Status Atual |
|-----------|------------|--------------|
| `business_overview_report` | P1 | Placeholder |
| `financial_statement_analysis` | P1 | Placeholder |
| `valuation_analysis` | P1 | Já tem template real |
| `competitive_analysis` | P1 | Placeholder |
| `management_quality_assessment` | P1 | Placeholder |
| `risk_assessment` | P1 | Já tem template real |
| `catalyst_identification` | P2 | Placeholder |
| `bull_bear_analysis` | P2 | Placeholder |
| `investment_thesis_synthesis` | P1 | Já tem template real |

### Fase 2: Configuração Gemini (Semana 1)

**Objetivo:** Configurar Gemini 2.5 Flash como LLM primário para Lane B.

**Configuração:**

```typescript
// LLM Config para Lane B prompts
{
  "llm_config": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "temperature": 0.2,
    "max_tokens": 4000
  }
}
```

**Fallback Strategy:**
```typescript
const LLM_FALLBACK_CHAIN = {
  'lane_b': ['gemini-2.5-flash', 'gpt-4o', 'claude-3-sonnet'],
  'lane_a': ['gpt-4o-mini', 'gemini-2.5-flash']
};
```

### Fase 3: Integração de Novos Módulos (Semana 2)

**Objetivo:** Adicionar módulos de análise onde há gaps, sem alterar fluxo existente.

**Novos Módulos a Adicionar:**

| Módulo | Posição no Pipeline | Dependência |
|--------|---------------------|-------------|
| `financial_statement_analysis` | Antes de `valuation_analysis` | `business_model_analysis` |
| `competitive_analysis` | Após `business_model_analysis` | `business_model_analysis` |
| `management_quality_assessment` | Após `competitive_analysis` | Nenhuma |
| `catalyst_identification` | Após `risk_assessment` | `risk_assessment` |

**Atualização do Orchestrator:**

```typescript
// orchestrator.ts - Lane B execution order
const LANE_B_EXECUTION_ORDER = [
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

## Mapeamento de Templates

### Template Upgrade: `business_overview_report`

**Antes (Placeholder):**
```
system_prompt: "You are a financial analyst specializing in business_model."
user_prompt_template: "Analyze {{ticker}} for business overview report."
```

**Depois (Real - de all_prompts_final.md):**
```
You are a senior equity research analyst preparing a comprehensive business overview.

Company: {{ticker}}

Provide a detailed analysis covering:

1. BUSINESS DESCRIPTION
   - What does the company do?
   - Core products and services
   - Revenue model and pricing
   - Customer segments

2. BUSINESS MODEL ANALYSIS
   - Value proposition
   - Key resources and capabilities
   - Cost structure
   - Revenue streams breakdown

3. COMPETITIVE POSITION
   - Market position and share
   - Key competitors
   - Competitive advantages (moat)
   - Barriers to entry

4. GROWTH STRATEGY
   - Organic growth initiatives
   - M&A strategy
   - Geographic expansion
   - New product development

5. KEY SUCCESS FACTORS
   - Critical success factors
   - Key performance indicators
   - Management priorities

Provide specific data points and cite sources where possible.
```

### Template Upgrade: `valuation_analysis`

**Status:** Já tem template real em `prompts.json`

**Ação:** Manter template existente, apenas atualizar LLM para Gemini

### Template Upgrade: `competitive_analysis`

**Antes (Placeholder):**
```
system_prompt: "You are a financial analyst specializing in industry."
user_prompt_template: "Analyze {{ticker}} for competitive analysis."
```

**Depois (Real - de all_prompts_final.md):**
```
You are a competitive strategy analyst.

Company: {{ticker}}

COMPETITIVE ANALYSIS:

1. INDUSTRY STRUCTURE
   - Porter's Five Forces analysis
   - Industry concentration
   - Key success factors
   - Industry lifecycle stage

2. COMPETITIVE POSITIONING
   - Market share and trends
   - Relative cost position
   - Differentiation factors
   - Strategic group mapping

3. KEY COMPETITORS
   - Direct competitors
   - Indirect/substitute competitors
   - Emerging threats
   - Competitive dynamics

4. COMPETITIVE ADVANTAGES
   - Sources of moat
   - Sustainability of advantages
   - Barriers to entry/exit
   - Switching costs

5. COMPETITIVE OUTLOOK
   - Industry evolution
   - Potential disruptors
   - Consolidation trends
   - Regulatory changes

Provide specific examples and data to support analysis.
```

---

## LLM Configuration Matrix

### Lane A (Discovery)

| Prompt | LLM Primário | Temperatura | Max Tokens |
|--------|--------------|-------------|------------|
| `gate_data_sufficiency` | code | N/A | N/A |
| `lane_a_idea_generation` | gpt-4o-mini | 0.3 | 2000 |
| `gate_coherence` | code | N/A | N/A |

### Lane B (Research) - Gemini Priority

| Prompt | LLM Primário | Temperatura | Max Tokens |
|--------|--------------|-------------|------------|
| `gate_data_sufficiency` | code | N/A | N/A |
| `business_model_analysis` | **gemini-2.5-flash** | 0.2 | 4000 |
| `financial_statement_analysis` | **gemini-2.5-flash** | 0.2 | 4000 |
| `competitive_analysis` | **gemini-2.5-flash** | 0.2 | 4000 |
| `valuation_analysis` | **gemini-2.5-flash** | 0.2 | 4000 |
| `management_quality_assessment` | **gemini-2.5-flash** | 0.2 | 4000 |
| `risk_assessment` | **gemini-2.5-flash** | 0.2 | 4000 |
| `catalyst_identification` | **gemini-2.5-flash** | 0.3 | 3000 |
| `investment_thesis_synthesis` | **gemini-2.5-flash** | 0.3 | 5000 |
| `gate_style_fit` | code | N/A | N/A |

---

## Validação de Preservação do Pipeline

### Checklist de Validação

#### Lane A
- [ ] Trigger diário funciona igual
- [ ] Screening retorna mesma estrutura
- [ ] Ideas vão para Inbox com mesmo formato
- [ ] Gates funcionam igual
- [ ] Telemetria registra mesmas métricas

#### Lane B
- [ ] Promotion funciona igual
- [ ] Módulos executam em sequência
- [ ] Output tem mesma estrutura
- [ ] Gates funcionam igual
- [ ] Telemetria registra mesmas métricas

#### Compatibilidade
- [ ] API endpoints não mudam
- [ ] UI funciona sem alterações
- [ ] Database schema não muda
- [ ] Exports funcionam igual

---

## Rollback Plan

### Se algo der errado:

1. **Reverter prompts_full.json:**
   ```bash
   cp prompts_full.json.backup prompts_full.json
   ```

2. **Reverter LLM config:**
   ```bash
   # Editar prompts para usar OpenAI novamente
   sed -i 's/gemini-2.5-flash/gpt-4o/g' prompts_full.json
   ```

3. **Reverter orchestrator:**
   ```bash
   git checkout packages/worker/src/prompts/orchestrator.ts
   ```

---

## Métricas de Sucesso

### KPIs para Validação

| Métrica | Baseline | Target | Método de Medição |
|---------|----------|--------|-------------------|
| Lane A execution time | ~76s | <90s | Telemetria |
| Lane B execution time | ~50s | <120s | Telemetria |
| Ideas quality score | N/A | >7/10 | Manual review |
| Research depth | Shallow | Deep | Content analysis |
| Cost per run | $0.002 | <$0.01 | Budget tracking |
| Error rate | <5% | <5% | Telemetria |

---

## Timeline

| Dia | Atividade | Deliverable |
|-----|-----------|-------------|
| 1 | Backup + Template extraction | Templates extraídos |
| 1 | Update prompts_full.json | Prompts atualizados |
| 2 | Configure Gemini | LLM config atualizado |
| 2 | Test Lane A | Validação Lane A |
| 3 | Test Lane B | Validação Lane B |
| 3 | Add new modules | Módulos integrados |
| 4 | Full integration test | Sistema validado |
| 4 | Documentation | Docs atualizados |
