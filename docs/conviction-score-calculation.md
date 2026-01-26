# Conviction Score Calculation - Lane C

## Visão Geral

O **Conviction Score** é calculado dinamicamente no **Lane C** após a geração completa do IC Memo. O score reflete a confiança do sistema na tese de investimento, considerando múltiplos fatores de análise.

## Fórmula de Cálculo

```
Conviction Score = Base + VP_Adjustment + BB_Adjustment + Val_Adjustment + Risk_Adjustment + PM_Adjustment
```

**Range Final:** 10 - 95 (clamped)

---

## Componentes e Pesos

### 1. Base Score
| Componente | Valor |
|------------|-------|
| **Base Conviction** | 50 pontos |

O score inicia em 50 pontos (neutro) e é ajustado pelos fatores abaixo.

---

### 2. Variant Perception (VP)
| Parâmetro | Fórmula | Range de Ajuste |
|-----------|---------|-----------------|
| **Confidence** (1-10) | `(confidence - 5) × 3` | **-15 a +15 pontos** |

**Peso:** 30% do range total de ajuste

**Interpretação:**
- Confidence = 10 → +15 pontos (forte diferenciação vs consenso)
- Confidence = 5 → 0 pontos (neutro)
- Confidence = 1 → -12 pontos (sem edge vs mercado)

---

### 3. Bull/Bear Analysis (BB)
| Parâmetro | Fórmula | Range de Ajuste |
|-----------|---------|-----------------|
| **Probability Skew** | `(bull_prob - bear_prob) × 0.2` | **-10 a +10 pontos** |

**Peso:** 20% do range total de ajuste

**Interpretação:**
- Bull 75% / Bear 25% → Skew = 50 → +10 pontos
- Bull 50% / Bear 50% → Skew = 0 → 0 pontos
- Bull 25% / Bear 75% → Skew = -50 → -10 pontos

---

### 4. Valuation Assessment (Val)
| Condição | Ajuste |
|----------|--------|
| Upside/Downside Ratio > 2.0 | **+10 pontos** |
| Upside/Downside Ratio > 1.5 | **+5 pontos** |
| Upside/Downside Ratio < 0.75 | **-5 pontos** |
| Upside/Downside Ratio < 0.5 | **-10 pontos** |

**Peso:** 20% do range total de ajuste

**Fórmula do Ratio:**
```
Upside = (Base Case - Current Price) / Current Price × 100
Downside = (Current Price - Bear Case) / Current Price × 100
Ratio = Upside / max(Downside, 1)
```

---

### 5. Risk Assessment (Risk)
| Rating | Ajuste |
|--------|--------|
| **Low** | **+5 pontos** |
| **Medium** | **0 pontos** |
| **High** | **-10 pontos** |

**Peso:** 15% do range total de ajuste

---

### 6. Pre-Mortem Analysis (PM)
| Condição | Ajuste |
|----------|--------|
| Cada cenário de falha com probabilidade "high" | **-5 pontos** |

**Peso:** 15% do range total de ajuste (ilimitado para baixo)

---

## Exemplo Prático: AAPL (Apple Inc.)

### Dados de Entrada

| Análise | Resultado |
|---------|-----------|
| **Variant Perception** | Confidence: 7/10 |
| **Bull/Bear Analysis** | Bull: 60%, Bear: 25% |
| **Valuation** | Bear: $150, Base: $220, Bull: $280 |
| **Current Price** | $185 |
| **Risk Assessment** | Rating: Low |
| **Pre-Mortem** | 1 cenário high probability |

### Cálculo Passo a Passo

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVICTION SCORE CALCULATION                  │
│                         AAPL - Apple Inc.                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BASE SCORE                                                   │
│     └─ Starting point                           = 50.0           │
│                                                                  │
│  2. VARIANT PERCEPTION                                           │
│     └─ Confidence: 7                                             │
│     └─ Adjustment: (7 - 5) × 3                  = +6.0           │
│                                                                  │
│  3. BULL/BEAR ANALYSIS                                           │
│     └─ Bull Probability: 60%                                     │
│     └─ Bear Probability: 25%                                     │
│     └─ Skew: 60 - 25 = 35                                        │
│     └─ Adjustment: 35 × 0.2                     = +7.0           │
│                                                                  │
│  4. VALUATION ASSESSMENT                                         │
│     └─ Current Price: $185                                       │
│     └─ Bear Case: $150                                           │
│     └─ Base Case: $220                                           │
│     └─ Upside: (220 - 185) / 185 × 100 = 18.9%                   │
│     └─ Downside: (185 - 150) / 185 × 100 = 18.9%                 │
│     └─ Ratio: 18.9 / 18.9 = 1.0                                  │
│     └─ Adjustment (ratio between 0.75-1.5)      = 0.0            │
│                                                                  │
│  5. RISK ASSESSMENT                                              │
│     └─ Rating: Low                                               │
│     └─ Adjustment                               = +5.0           │
│                                                                  │
│  6. PRE-MORTEM ANALYSIS                                          │
│     └─ High probability failures: 1                              │
│     └─ Adjustment: 1 × (-5)                     = -5.0           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TOTAL CALCULATION:                                              │
│  50.0 + 6.0 + 7.0 + 0.0 + 5.0 + (-5.0) = 63.0                   │
│                                                                  │
│  FINAL CONVICTION SCORE (clamped 10-95):        63               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interpretação do Score

| Score Range | Classificação | Recomendação |
|-------------|---------------|--------------|
| **80 - 95** | Very High Conviction | STRONG BUY |
| **65 - 79** | High Conviction | BUY |
| **50 - 64** | Moderate Conviction | HOLD |
| **35 - 49** | Low Conviction | REDUCE |
| **10 - 34** | Very Low Conviction | SELL |

---

## Resumo dos Pesos

| Fator | Range de Ajuste | Peso Relativo |
|-------|-----------------|---------------|
| Variant Perception | -15 a +15 | **30%** |
| Bull/Bear Analysis | -10 a +10 | **20%** |
| Valuation Assessment | -10 a +10 | **20%** |
| Risk Assessment | -10 a +5 | **15%** |
| Pre-Mortem Analysis | -∞ a 0 | **15%+** |

**Total Range Teórico:** 50 - 45 = 5 (mínimo) a 50 + 40 = 90 (máximo)
**Range Efetivo (clamped):** 10 - 95

---

## Código de Referência

```typescript
function calculateConviction(
  memoContent: any,
  supportingAnalyses: SupportingAnalysis[],
  liveData: LiveMarketData
): number {
  let conviction = 50; // Base conviction
  
  // 1. Variant Perception (+/- 15 pts)
  const variantPerception = supportingAnalyses.find(a => a.promptName === 'Variant Perception');
  if (variantPerception?.success && variantPerception.result?.confidence) {
    const vpConfidence = Number(variantPerception.result.confidence);
    if (!isNaN(vpConfidence)) {
      conviction += (vpConfidence - 5) * 3;
    }
  }
  
  // 2. Bull/Bear Analysis (+/- 10 pts)
  const bullBear = supportingAnalyses.find(a => a.promptName === 'Bull Bear Analysis');
  if (bullBear?.success && bullBear.result) {
    const bullProb = Number(bullBear.result.bull_case?.probability) || 25;
    const bearProb = Number(bullBear.result.bear_case?.probability) || 25;
    const skew = bullProb - bearProb;
    conviction += skew * 0.2;
  }
  
  // 3. Valuation Assessment (+/- 10 pts)
  if (memoContent?.valuation?.value_range && liveData.currentPrice) {
    const { bear, base, bull } = memoContent.valuation.value_range;
    const currentPrice = liveData.currentPrice;
    
    if (bear && base && bull && currentPrice > 0) {
      const upside = ((base - currentPrice) / currentPrice) * 100;
      const downside = ((currentPrice - bear) / currentPrice) * 100;
      const ratio = upside / Math.max(downside, 1);
      
      if (ratio > 2) conviction += 10;
      else if (ratio > 1.5) conviction += 5;
      else if (ratio < 0.5) conviction -= 10;
      else if (ratio < 0.75) conviction -= 5;
    }
  }
  
  // 4. Risk Assessment (+5 / -10 pts)
  const riskAssessment = supportingAnalyses.find(a => a.promptName === 'Risk Assessment');
  if (riskAssessment?.success && riskAssessment.result?.overall_risk_rating) {
    const rating = riskAssessment.result.overall_risk_rating.toLowerCase();
    if (rating === 'low') conviction += 5;
    else if (rating === 'high') conviction -= 10;
  }
  
  // 5. Pre-Mortem Analysis (-5 pts per high-prob failure)
  const preMortem = supportingAnalyses.find(a => a.promptName === 'Pre Mortem Analysis');
  if (preMortem?.success && preMortem.result?.failure_scenarios) {
    const highProbFailures = preMortem.result.failure_scenarios.filter(
      (s: any) => s.probability === 'high'
    ).length;
    conviction -= highProbFailures * 5;
  }
  
  // Clamp to 10-95 range
  return Math.max(10, Math.min(95, Math.round(conviction)));
}
```

---

## Diagrama Visual do Cálculo

```
                    ┌─────────────────┐
                    │   BASE SCORE    │
                    │       50        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    VARIANT      │ │   BULL/BEAR    │ │   VALUATION    │
│   PERCEPTION    │ │    ANALYSIS    │ │   ASSESSMENT   │
│   -15 to +15    │ │   -10 to +10   │ │   -10 to +10   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│      RISK       │ │   PRE-MORTEM   │ │                 │
│   ASSESSMENT    │ │    ANALYSIS    │ │                 │
│   -10 to +5     │ │   -∞ to 0      │ │                 │
└────────┬────────┘ └────────┬────────┘ └─────────────────┘
         │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  FINAL SCORE   │
                    │   (10 - 95)    │
                    └─────────────────┘
```
