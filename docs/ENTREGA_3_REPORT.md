# ARC Investment Factory - Entrega 3 Report

## Ajustes Estruturais Pós Entrega 2 para Padrão Institucional

**Data:** 12 de Janeiro de 2026  
**Commit:** 7e1cb5e  
**Branch:** main

---

## Resumo Executivo

A Entrega 3 implementa ajustes estruturais críticos para elevar o sistema ao padrão institucional. As mudanças focam em:

1. **Padronização de nomenclatura** (TwitterClient → SocialTrendsClient)
2. **Seleção inteligente de prompts** baseada em valor esperado
3. **Telemetria expandida** com métricas de qualidade
4. **Budget gating explícito** com estado em tempo real
5. **Separação de caches** para dados e outputs de prompts
6. **Política de quarentena** com reprocessamento automático

---

## Critérios de Aceite - Status

| Critério | Status | Evidência |
|----------|--------|-----------|
| TwitterClient renomeado para SocialTrendsClient | ✅ Completo | `packages/retriever/src/sources/social-trends.ts` |
| Metadados de valor esperado nos prompts | ✅ Completo | `prompts_full.json` com expected_value_score, expected_cost_score |
| Seleção de prompts por valor esperado | ✅ Completo | `packages/worker/src/prompts/selector.ts` |
| lane_outcome no TelemetryStore | ✅ Completo | `packages/worker/src/telemetry/store.ts` |
| llm_calls_allowed no BudgetController | ✅ Completo | `packages/worker/src/budget/controller.ts` |
| Separação data_cache e prompt_output_cache | ✅ Completo | `packages/worker/src/cache/manager.ts` |
| Política de reprocessamento de quarentena | ✅ Completo | `packages/worker/src/quarantine/store.ts` |
| Dashboard com métricas de qualidade | ✅ Completo | `apps/web/src/app/telemetry/page.tsx` |
| Testes unitários | ✅ Completo | 96 testes passando |
| Build sem erros | ✅ Completo | `pnpm build` executado com sucesso |

---

## Detalhamento das Mudanças

### 1. SocialTrendsClient (antes TwitterClient)

**Arquivo:** `packages/retriever/src/sources/social-trends.ts`

```typescript
export class SocialTrendsClient {
  // Suporta múltiplas plataformas: Twitter/X, Reddit, StockTwits
  async getSocialSentiment(ticker: string): Promise<SocialSentimentData>
  async getTrendingTopics(category?: string): Promise<TrendingTopic[]>
  async getInfluencerMentions(ticker: string): Promise<InfluencerMention[]>
}
```

**Mudanças:**
- Renomeado de `TwitterClient` para `SocialTrendsClient`
- Adicionado suporte para múltiplas plataformas sociais
- Novo método `getInfluencerMentions()` para tracking de influenciadores

### 2. Metadados de Valor Esperado nos Prompts

**Arquivo:** `packages/worker/src/prompts/library/prompts_full.json`

Todos os 30 prompts agora incluem:

```json
{
  "expected_value_score": 1-10,      // Valor esperado do output
  "expected_cost_score": 1-10,       // Custo estimado (tokens/tempo)
  "min_signal_dependency": 0.0-1.0,  // Força mínima de sinal necessária
  "value_cost_ratio": number         // Calculado automaticamente
}
```

**Distribuição de Scores:**
- Gates (críticos): value_score 9-10, cost_score 3-5
- Research prompts: value_score 6-8, cost_score 4-7
- Synthesis prompts: value_score 7-9, cost_score 5-8

### 3. PromptSelector - Seleção por Valor Esperado

**Arquivo:** `packages/worker/src/prompts/selector.ts`

```typescript
export class PromptSelector {
  // Seleção baseada em critérios de valor
  selectPrompts(criteria: SelectionCriteria): SelectionResult
  
  // Seleção otimizada para budget restante
  selectForBudget(lane: Lane, budgetState: BudgetState): SelectionResult
  
  // Seleção de prompts de alto valor
  selectHighValue(lane: Lane, minValueScore: number): SelectionResult
}
```

**Algoritmo de Seleção:**
1. Filtra por lane e stage
2. Aplica filtros de min_value_score e max_cost_score
3. Ordena por value_cost_ratio (maior primeiro)
4. Respeita dependências entre prompts
5. Retorna ordem de execução otimizada (topological sort)

### 4. TelemetryStore com lane_outcome

**Arquivo:** `packages/worker/src/telemetry/store.ts`

Novos tipos e métodos:

```typescript
type LaneOutcome = 'idea_generated' | 'research_completed' | 'thesis_formed' | 
                   'gate_passed' | 'gate_failed' | 'quarantined' | 'error';

interface LaneOutcomeRecord {
  id: string;
  run_id: string;
  lane: Lane;
  outcome: LaneOutcome;
  quality_score?: number;
  cost_incurred: number;
  // ...
}

// Novos métodos
async recordLaneOutcome(record: Omit<LaneOutcomeRecord, 'id' | 'created_at'>): Promise<string>
async getLaneOutcomes(lane?: Lane, limit?: number): Promise<LaneOutcomeRecord[]>
async getLaneOutcomeStats(timeRangeHours?: number): Promise<LaneOutcomeStats>
async getQualityMetrics(timeRangeHours?: number): Promise<QualityMetrics>
```

### 5. BudgetController com llm_calls_allowed

**Arquivo:** `packages/worker/src/budget/controller.ts`

Estado estendido em tempo real:

```typescript
interface ExtendedBudgetState extends BudgetState {
  llm_calls_allowed: boolean;      // Flag explícita
  code_calls_allowed: boolean;     // Sempre true
  tokens_remaining: number;
  cost_remaining: number;
  time_remaining_ms: number;
  usage_percent: {
    tokens: number;
    cost: number;
    time: number;
    max: number;
  };
  estimated_calls_remaining: number;
  warning_issued: boolean;
}

// Novos métodos
getExtendedBudgetState(runId: string): ExtendedBudgetState | null
getRealTimeStatus(runId: string): RealTimeStatus | null
canExecute(runId: string, type: 'llm' | 'code'): { allowed: boolean; reason?: string }
```

### 6. Cache Manager - Separação de Caches

**Arquivo:** `packages/worker/src/cache/manager.ts`

```typescript
export class CacheManager {
  // Data cache - dados de fontes externas
  setData<T>(key: string, data: T, metadata?: DataCacheMetadata): void
  getData<T>(key: string): T | null
  
  // Prompt output cache - resultados de prompts
  setPromptOutput<T>(key: string, output: T, metadata?: PromptOutputMetadata): void
  getPromptOutput<T>(key: string): T | null
  
  // Estatísticas separadas
  getStats(): CacheStats
}
```

**Configuração:**
- `data_cache`: max_entries: 1000, default_ttl: 3600s
- `prompt_output_cache`: max_entries: 500, default_ttl: 7200s

### 7. QuarantineStore com Política de Reprocessamento

**Arquivo:** `packages/worker/src/quarantine/store.ts`

```typescript
interface ReprocessingPolicy {
  max_retries: number;              // Padrão: 3
  retry_delay_seconds: number;      // Padrão: 60
  retry_backoff_multiplier: number; // Padrão: 2 (exponential)
  auto_dismiss_after_hours: number; // Padrão: 72
  auto_escalate_after_retries: number; // Padrão: 2
}

// Novos métodos
async markForRetry(recordId: string): Promise<boolean>
async recordRetryResult(recordId: string, success: boolean): Promise<void>
async getReadyForRetry(limit?: number): Promise<QuarantineRecord[]>
async escalate(recordId: string, reason?: string): Promise<void>
async dismiss(recordId: string, reason: 'stale' | 'duplicate' | 'manual', notes?: string): Promise<void>
```

### 8. Dashboard de Telemetria Expandido

**Arquivo:** `apps/web/src/app/telemetry/page.tsx`

Novas seções:
- **Quality Metrics**: avg_quality_score, gate_pass_rate, quarantine_rate
- **Lane Outcomes**: ideas_generated, research_completed, thesis_formed
- **Budget Status**: real-time usage, llm_calls_allowed status
- **Quarantine Status**: pending, retrying, escalated counts

---

## Testes

### Novos Arquivos de Teste

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `selector.test.ts` | 12 | PromptSelector completo |
| `cache-manager.test.ts` | 18 | CacheManager completo |
| `quarantine-store.test.ts` | 20 | QuarantineStore completo |
| `budget-controller.test.ts` | 22 | BudgetController completo |

### Resultado dos Testes

```
Test Files  5 passed (5)
Tests       96 passed (96)
Duration    852ms
```

---

## Breaking Changes

### 1. TwitterClient → SocialTrendsClient

**Antes:**
```typescript
import { TwitterClient } from '@arc/retriever';
const twitter = new TwitterClient();
await twitter.getTwitterSentiment(ticker);
```

**Depois:**
```typescript
import { SocialTrendsClient } from '@arc/retriever';
const social = new SocialTrendsClient();
await social.getSocialSentiment(ticker);
```

### 2. TelemetryStore.getStats()

**Antes:**
```typescript
const stats = await telemetry.getStats();
console.log(stats.total_executions);
console.log(stats.success_rate);
```

**Depois:**
```typescript
const stats = await telemetry.getStats();
console.log(stats.total);
console.log(stats.failureRate); // Invertido: failure em vez de success
console.log(stats.laneOutcomeStats); // Novo
console.log(stats.qualityMetrics);   // Novo
```

### 3. BudgetController.getBudgetState()

**Antes:**
```typescript
const state = budget.getBudgetState(runId);
console.log(state.tokens_used);
console.log(state.cost_used);
```

**Depois:**
```typescript
const state = budget.getBudgetState(runId);
console.log(state.total_tokens_used);
console.log(state.total_cost_used);

// Para estado estendido:
const extended = budget.getExtendedBudgetState(runId);
console.log(extended.llm_calls_allowed);
console.log(extended.estimated_calls_remaining);
```

### 4. QuarantineStore.getStats()

**Antes:**
```typescript
const stats = await quarantine.getStats();
console.log(stats.total_items);
```

**Depois:**
```typescript
const stats = await quarantine.getStats();
console.log(stats.total);
console.log(stats.byStatus);
console.log(stats.escalatedCount);
```

---

## Próximos Passos (Entrega 4)

1. **Integração com MCP Servers** para execução de prompts
2. **Persistent storage** para TelemetryStore e QuarantineStore
3. **API endpoints** para exposição de métricas
4. **Alerting system** baseado em thresholds de qualidade
5. **A/B testing framework** para prompts

---

## Arquivos Modificados

```
apps/web/src/app/telemetry/page.tsx
packages/retriever/src/hub.ts
packages/retriever/src/index.ts
packages/retriever/src/sources/social-trends.ts (novo)
packages/worker/src/__tests__/budget-controller.test.ts (novo)
packages/worker/src/__tests__/cache-manager.test.ts (novo)
packages/worker/src/__tests__/quarantine-store.test.ts (novo)
packages/worker/src/__tests__/selector.test.ts (novo)
packages/worker/src/budget/controller.ts
packages/worker/src/cache/index.ts (novo)
packages/worker/src/cache/manager.ts (novo)
packages/worker/src/prompts/__tests__/prompt-system.test.ts
packages/worker/src/prompts/library/prompts_full.json
packages/worker/src/prompts/orchestrator.ts
packages/worker/src/prompts/selector.ts (novo)
packages/worker/src/prompts/types.ts
packages/worker/src/quarantine/store.ts
packages/worker/src/telemetry/store.ts
scripts/add_prompt_metadata.js (novo)
```

---

**Entrega 3 concluída com sucesso.**
