# ARC Scoring Engine

Sistema institucional de scoring para análise de investimentos com 3 camadas: sinais brutos, normalização robusta e agregação com controles de risco.

## Arquitetura

```
arc-scoring-engine/
├── config/
│   └── weights.yaml          # Configuração de pesos e normalização
├── data_layer/
│   └── loaders.py            # Ingestão de dados (preços, fundamentals, estimates)
├── feature_engineering/
│   ├── contrarian.py         # Sinais Contrarian (15 sinais)
│   ├── turnaround.py         # Sinais Turnaround (12 sinais)
│   ├── piotroski.py          # Sinais Piotroski F-Score (9 sinais)
│   └── quality.py            # Sinais Quality (8 sinais)
├── scoring/
│   ├── normalizer.py         # Normalização robusta (z-score, winsorização)
│   └── aggregator.py         # Agregação e cálculo de quintis
├── governance/
│   └── governance.py         # Versionamento, logs, audit, testes
├── integration/
│   └── arc_integration.py    # Integração com sistema ARC existente
└── cli/
    └── main.py               # Interface de linha de comando
```

## Blocos de Scores

### 1. Contrarian Score
Identifica oportunidades contrárias ao mercado:
- **Valuation:** P/E, P/B, EV/EBITDA, FCF Yield
- **Momentum Reversal:** RSI, distância de 52w low
- **Sentiment:** Short interest, insider buying, analyst revisions

### 2. Turnaround Score
Identifica empresas em recuperação:
- **Earnings Momentum:** Surpresas de lucros, revisões de estimativas
- **Margin Recovery:** Expansão de margens
- **Debt Reduction:** Melhoria de alavancagem

### 3. Piotroski F-Score
Score de saúde financeira (0-9):
- **Profitability:** ROA, CFO, Δ ROA, Accruals
- **Leverage:** Δ Leverage, Δ Current Ratio
- **Operating Efficiency:** Δ Gross Margin, Δ Asset Turnover

### 4. Quality Score
Identifica empresas de alta qualidade:
- **ROIC Consistency:** Estabilidade de retornos
- **Earnings Quality:** Qualidade dos lucros
- **Competitive Moat:** Vantagens competitivas

## Metodologia de Normalização

### Camada 1: Sinais Brutos
Cada módulo calcula sinais em suas unidades naturais (%, ratio, etc.).

### Camada 2: Normalização Robusta
1. **Winsorização 5%-95%:** Remove outliers extremos
2. **Z-Score Robusto:** Usa mediana e MAD em vez de média e desvio padrão
3. **Conversão 0-100:** Escala normalizada para comparação

### Camada 3: Agregação
1. **Média ponderada** por bloco (pesos configuráveis)
2. **Penalidades de risco** (volatilidade, drawdown)
3. **Quintis baseados em z-score** da distribuição normal

## Cálculo de Quintis

Os quintis são calculados usando z-scores da distribuição normal:

| Quintil | Z-Score | Descrição |
|---------|---------|-----------|
| Q1 | z < -0.84 | 20% inferior |
| Q2 | -0.84 ≤ z < -0.25 | 20-40% |
| Q3 | -0.25 ≤ z < 0.25 | 40-60% (centro) |
| Q4 | 0.25 ≤ z < 0.84 | 60-80% |
| Q5 | z ≥ 0.84 | 20% superior |

## Recomendações

Baseado nos resultados do backtest robusto:

| Quintil | Recomendação | CAGR | Sharpe |
|---------|--------------|------|--------|
| Q1 | AVOID | 12.5% | 0.47 |
| Q2 | HOLD | 16.9% | 0.63 |
| **Q3** | **STRONG BUY** | **20.7%** | **0.64** |
| Q4 | HOLD | 12.2% | 0.40 |
| Q5 | BUY | 19.7% | 0.54 |

**Nota:** Q3 é o "sweet spot" com melhor perfil de risco-retorno.

## Uso

### CLI

```bash
# Executar pipeline completo
python cli/main.py run \
    --tickers AAPL,MSFT,GOOGL \
    --config config/weights.yaml \
    --start 2024-01-01 \
    --end 2024-12-31 \
    --output ./output

# Calcular score para um ticker
python cli/main.py score \
    --ticker AAPL \
    --date 2024-12-31 \
    --config config/weights.yaml

# Listar versões de configuração
python cli/main.py versions

# Comparar com baseline
python cli/main.py compare \
    --baseline v1.0_20240101 \
    --tickers AAPL,MSFT \
    --start 2024-01-01 \
    --end 2024-12-31 \
    --config config/weights.yaml
```

### Python API

```python
from arc_scoring_engine.cli.main import run_full_pipeline
from arc_scoring_engine.integration import sync_scores_to_arc

# Executar pipeline
df_scores = run_full_pipeline(
    tickers=['AAPL', 'MSFT', 'GOOGL'],
    start_date='2024-01-01',
    end_date='2024-12-31',
    config_path='config/weights.yaml',
    output_dir='./output'
)

# Sincronizar com ARC
report = sync_scores_to_arc(df_scores, dry_run=False)
```

## Configuração

O arquivo `config/weights.yaml` contém:

```yaml
version: "1.0"
normalization:
  winsorize_lower: 0.05
  winsorize_upper: 0.95
  use_robust_zscore: true

blocks:
  contrarian:
    weight: 0.35
    signals:
      pe_ratio: { weight: 0.15, direction: lower_is_better }
      pb_ratio: { weight: 0.10, direction: lower_is_better }
      ...
```

## Governance

### Versionamento
Cada configuração é versionada com hash único para reprodutibilidade.

### Audit Trail
Todas as execuções são logadas com:
- Timestamp
- Tickers processados
- Métricas de validação
- Erros (se houver)

### Testes de Regressão
Compare resultados com baselines anteriores para detectar mudanças inesperadas.

## Dependências

```
pandas>=1.5.0
numpy>=1.24.0
scipy>=1.10.0
pyyaml>=6.0
psycopg2-binary>=2.9.0
yfinance>=0.2.0
polygon-api-client>=1.0.0
```

## Instalação

```bash
# Clonar repositório
git clone https://github.com/mcauduro0/Prompt_flow.git

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
export DB_HOST=arc-db-prod-do-user-27055479-0.g.db.ondigitalocean.com
export DB_PORT=25060
export DB_USER=doadmin
export DB_PASSWORD=your_password
export POLYGON_API_KEY=your_api_key
```

## Licença

Proprietário - ARC Investment Factory
