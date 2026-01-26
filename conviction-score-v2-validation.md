# Conviction Score v2.0 - Validação

## Data: 2026-01-26

## Resumo da Atualização

Todos os 255 IC Memos foram recalculados com o Conviction Score v2.0.

### Estatísticas

| Métrica | Valor |
|---------|-------|
| Total processados | 255 |
| Sucesso | 255 (100%) |
| Score médio anterior | 25.8 |
| Score médio novo (v2.0) | 48.5 |
| Mudança média | +22.7 |

### Distribuição de Recomendações

| Recomendação | Quantidade | % |
|--------------|------------|---|
| HOLD | 111 | 43.5% |
| REDUCE | 56 | 22.0% |
| SELL | 55 | 21.6% |
| BUY | 27 | 10.6% |
| STRONG BUY | 6 | 2.4% |

## Top 10 por Score (Validação Visual)

| Ticker | Company | Score | Quintile | Recommendation |
|--------|---------|-------|----------|----------------|
| TER | Teradyne, Inc. | 78.0 | Q4 | BUY |
| GOOGL | Alphabet Inc. | 78.0 | Q4 | BUY |
| IRMD | IRadimed Corporation | 77.0 | Q4 | BUY |
| MPWR | Monolithic Power Systems | 73.0 | Q4 | BUY |
| XPEL | XPEL, Inc. | 72.0 | Q4 | BUY |
| KRKNF | Kraken Robotics | 72.0 | Q4 | BUY |
| FAR.TO | Foraco International | 68.0 | Q4 | BUY |
| TCMD | Tactile Systems | 67.0 | Q4 | BUY |
| FTAI | FTAI Aviation | 67.0 | Q4 | BUY |
| RL | Ralph Lauren | 67.0 | Q4 | BUY |

## Observações

1. **Coluna "Conviction"** mostra o valor bruto (ex: 78/50) - isso é um bug visual que precisa ser corrigido
2. **Coluna "Score"** mostra o valor correto (78.0)
3. **Quintile** está calculando corretamente baseado no score
4. **Recommendation** está sendo derivada corretamente do score

## Bug Identificado

A coluna "Conviction" está mostrando "X/50" quando deveria mostrar apenas "X". Isso é porque o frontend antigo assumia que conviction ia de 0-50, mas agora vai de 0-100.

## Correção Necessária

Atualizar a exibição da coluna Conviction para mostrar apenas o valor sem "/50".
