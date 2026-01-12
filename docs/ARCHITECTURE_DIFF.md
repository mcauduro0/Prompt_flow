# ARC Investment Factory - Architecture Diff (Entrega 1)

## Diagnóstico Atual

### Pontos de Entrada com Prompts Hardcoded
| Arquivo | Tipo | Problema |
|---------|------|----------|
| `daily-discovery.ts` | Lane A | Prompt inline na linha 150 |
| `business-model-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `industry-moat-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `financial-forensics-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `capital-allocation-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `management-quality-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `valuation-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `risk-stress-agent.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `synthesis-committee.ts` | Lane B | SYSTEM_PROMPT hardcoded |
| `ic-bundle.ts` | IC | Prompt inline |

### Fontes de Dados Existentes
- ✅ FMP (`packages/retriever/src/sources/fmp.ts`)
- ✅ Polygon (`packages/retriever/src/sources/polygon.ts`)
- ✅ SEC EDGAR (`packages/retriever/src/sources/sec-edgar.ts`)

### Gates Existentes
- ✅ 5 Gates determinísticos implementados (`packages/worker/src/gates/index.ts`)
- ✅ Binary overrides para Gate 3

### O Que Falta
- ❌ Prompt Library como fonte de verdade
- ❌ Validação de schemas de input/output
- ❌ Telemetria por execução
- ❌ Cache de prompts e dados
- ❌ Budget controller
- ❌ Quarentena para outputs inválidos
- ❌ Feature flag para migração gradual

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROMPT LIBRARY                                  │
│                         (prompts_library.json)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ prompt_id, version, executor_type, lane, stage, inputs_schema,      │   │
│  │ output_schema, required_sources, criticality, budget, cache_policy, │   │
│  │ degradation_policy                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROMPT LIBRARY LOADER                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Carrega e valida metadados obrigatórios                           │   │
│  │ • Valida JSON Schemas de input/output                               │   │
│  │ • Indexa por prompt_id, category, stage, lane, tags                 │   │
│  │ • Falha no carregamento se campos obrigatórios ausentes             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORCHESTRATOR                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Recebe trigger (run Lane A, research ticker X)                    │   │
│  │ • Seleciona prompts por pipeline/lane/stage                         │   │
│  │ • Verifica budget antes de executar                                 │   │
│  │ • Coordena execução sequencial/paralela                             │   │
│  │ • Persiste telemetria e gerencia quarentena                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ DATA RETRIEVER  │  │ PROMPT EXECUTOR │  │ BUDGET          │
│ HUB             │  │                 │  │ CONTROLLER      │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ FMP         │ │  │ │ llm         │ │  │ │ max_cost    │ │
│ │ Polygon     │ │  │ │ code        │ │  │ │ max_tokens  │ │
│ │ SEC EDGAR   │ │  │ │ hybrid      │ │  │ │ max_time    │ │
│ │ (+ cache)   │ │  │ └─────────────┘ │  │ └─────────────┘ │
│ └─────────────┘ │  └─────────────────┘  └─────────────────┘
└─────────────────┘            │
          │                    ▼
          │          ┌─────────────────┐
          │          │ SCHEMA          │
          │          │ VALIDATOR       │
          │          │ ┌─────────────┐ │
          │          │ │ Valida JSON │ │
          │          │ │ Schema      │ │
          │          │ └─────────────┘ │
          │          └─────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ TELEMETRY       │  │ QUARANTINE      │  │ CACHE           │             │
│  │ STORE           │  │ STORE           │  │ STORE           │             │
│  │ (prompt_runs)   │  │ (quarantine)    │  │ (prompt_cache)  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Diff de Arquivos

### Novos Arquivos a Criar

```
packages/worker/src/
├── prompts/
│   ├── library-loader.ts       # PromptLibraryLoader
│   ├── orchestrator.ts         # Orchestrator principal
│   ├── executor.ts             # PromptExecutor (llm, code, hybrid)
│   ├── schema-validator.ts     # SchemaValidator
│   ├── types.ts                # Tipos e interfaces
│   └── code-functions/         # Funções para executor_type: code
│       ├── index.ts
│       └── gates.ts
├── telemetry/
│   ├── store.ts                # TelemetryStore
│   └── types.ts
├── budget/
│   ├── controller.ts           # BudgetController
│   └── types.ts
├── quarantine/
│   ├── store.ts                # QuarantineStore
│   └── types.ts
└── cache/
    ├── prompt-cache.ts         # Cache de outputs de prompts
    └── types.ts

packages/database/src/
├── models/
│   └── schema.ts               # + tabelas: prompt_runs, quarantine, prompt_cache
└── repositories/
    ├── prompt-runs.repository.ts
    ├── quarantine.repository.ts
    └── prompt-cache.repository.ts

packages/retriever/src/
└── hub.ts                      # DataRetrieverHub (centraliza fontes)

config/
├── prompts_library.json        # Prompt Library com metadados completos
└── orchestrator.config.json    # Configurações de budget, timeouts, etc.
```

### Arquivos a Modificar

```
packages/worker/src/
├── orchestrator/
│   ├── daily-discovery.ts      # Usar Orchestrator em vez de prompt hardcoded
│   └── lane-b-runner.ts        # Usar Orchestrator em vez de agentes hardcoded
├── jobs/
│   └── scheduler.ts            # Adicionar feature flag USE_PROMPT_LIBRARY
└── index.ts                    # Exportar novos módulos

.env.production                 # Adicionar USE_PROMPT_LIBRARY=true
```

---

## Schema da Prompt Library (prompts_library.json)

```json
{
  "version": "1.0.0",
  "prompts": [
    {
      "prompt_id": "lane_a_idea_generation",
      "version": "1.0",
      "title": "Lane A Idea Generation",
      "executor_type": "llm",
      "lane": "A",
      "stage": "discovery",
      "category": "idea_generation",
      "tags": ["screening", "fundamental"],
      "llm_config": {
        "provider": "openai",
        "model": "gpt-4",
        "temperature": 0.3,
        "max_tokens": 2000
      },
      "inputs_schema": {
        "type": "object",
        "required": ["ticker", "profile", "metrics", "news"],
        "properties": {
          "ticker": { "type": "string" },
          "profile": { "type": "object" },
          "metrics": { "type": "object" },
          "news": { "type": "array" }
        }
      },
      "output_schema": {
        "type": "object",
        "required": ["hasInvestmentPotential", "thesis", "styleTag", "conviction"],
        "properties": {
          "hasInvestmentPotential": { "type": "boolean" },
          "thesis": { "type": "string" },
          "styleTag": { "type": "string", "enum": ["quality_compounder", "garp", "cigar_butt"] },
          "mechanism": { "type": "string" },
          "edgeType": { "type": "array", "items": { "type": "string" } },
          "conviction": { "type": "integer", "minimum": 1, "maximum": 10 }
        }
      },
      "required_sources": ["fmp", "polygon"],
      "criticality": "blocker",
      "budget": {
        "max_tokens": 3000,
        "max_cost": 0.10
      },
      "cache_policy": {
        "ttl_seconds": 86400,
        "cache_key_template": "{{pipeline_id}}_{{lane}}_{{stage}}_{{ticker}}_{{date}}"
      },
      "degradation_policy": {
        "on_source_failure": "skip_with_warning",
        "on_validation_failure": "quarantine"
      },
      "template": "You are a senior investment analyst..."
    }
  ]
}
```

---

## Schema de Telemetria (prompt_runs table)

```sql
CREATE TABLE prompt_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  pipeline_id VARCHAR(50) NOT NULL,
  lane VARCHAR(10) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  prompt_id VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(20) NOT NULL,
  executor_type VARCHAR(20) NOT NULL,
  model_name VARCHAR(50),
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  input_hash VARCHAR(64) NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  sources_requested JSONB,
  sources_succeeded JSONB,
  sources_failed JSONB,
  validation_pass BOOLEAN,
  validation_errors JSONB,
  start_ts TIMESTAMP NOT NULL,
  end_ts TIMESTAMP,
  latency_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_estimate DECIMAL(10,6),
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prompt_runs_run_id ON prompt_runs(run_id);
CREATE INDEX idx_prompt_runs_prompt_id ON prompt_runs(prompt_id);
CREATE INDEX idx_prompt_runs_status ON prompt_runs(status);
```

---

## Prompts Selecionados para Entrega 1 (5-8 críticos)

| # | prompt_id | Lane | Stage | executor_type | Criticality |
|---|-----------|------|-------|---------------|-------------|
| 1 | `gate_data_sufficiency` | A | gates | code | blocker |
| 2 | `lane_a_idea_generation` | A | discovery | llm | blocker |
| 3 | `gate_coherence` | A | gates | code | blocker |
| 4 | `business_model_analysis` | B | research | llm | blocker |
| 5 | `valuation_analysis` | B | research | llm | blocker |
| 6 | `risk_assessment` | B | research | llm | blocker |
| 7 | `investment_thesis_synthesis` | B | synthesis | llm | blocker |
| 8 | `gate_style_fit` | B | gates | code | optional |

---

## Feature Flag

```typescript
// .env
USE_PROMPT_LIBRARY=true  // ou false para comportamento antigo

// scheduler.ts
if (process.env.USE_PROMPT_LIBRARY === 'true') {
  // Novo comportamento: usar Orchestrator
  await orchestrator.runLaneA(runId);
} else {
  // Comportamento antigo: usar prompts hardcoded
  await runDailyDiscovery();
}
```

---

## Próximos Passos

1. **Criar estrutura de diretórios** para os novos módulos
2. **Implementar PromptLibraryLoader** com validação de metadados
3. **Implementar DataRetrieverHub** com cache e fallback
4. **Implementar PromptExecutor** (llm, code, hybrid)
5. **Implementar SchemaValidator** e QuarantineStore
6. **Implementar TelemetryStore** e BudgetController
7. **Integrar Orchestrator** com pipeline via feature flag
8. **Criar testes** unitários e de integração
9. **Deploy** e validar critérios de aceite

**Autorização para prosseguir com a implementação?**
