#!/usr/bin/env python3
"""
Script para recalcular quintis cross-sectionally para todos os IC Memos
Usa a metodologia de ranking percentil para distribuição uniforme em 5 quintis
"""
import os
import psycopg2
import numpy as np
import pandas as pd
from datetime import datetime

# Configuração do banco de dados
DATABASE_URL = os.environ.get('DATABASE_URL')

def connect_db():
    """Conecta ao banco de dados"""
    return psycopg2.connect(DATABASE_URL)

def fetch_all_scores():
    """Busca todos os scores dos IC Memos completos"""
    conn = connect_db()
    query = """
    SELECT 
        memo_id,
        ticker,
        quality_score,
        momentum_score,
        composite_score,
        quality_score_quintile,
        momentum_score_quintile,
        composite_score_quintile
    FROM ic_memos 
    WHERE status = 'complete'
    ORDER BY ticker;
    """
    df = pd.read_sql(query, conn)
    conn.close()
    return df

def calculate_quintiles(series):
    """
    Calcula quintis usando ranking percentil
    Retorna array de quintis (1-5) onde 5 é o melhor
    """
    # Ignora valores nulos
    valid_mask = series.notna()
    quintiles = pd.Series(index=series.index, dtype='Int64')
    
    if valid_mask.sum() == 0:
        return quintiles
    
    # Calcula ranking percentil para valores válidos
    valid_values = series[valid_mask]
    ranks = valid_values.rank(pct=True)
    
    # Converte para quintis (1-5)
    # Q1: 0-20%, Q2: 20-40%, Q3: 40-60%, Q4: 60-80%, Q5: 80-100%
    quintile_values = pd.cut(ranks, bins=[0, 0.2, 0.4, 0.6, 0.8, 1.0], 
                             labels=[1, 2, 3, 4, 5], include_lowest=True)
    
    quintiles[valid_mask] = quintile_values.astype('Int64')
    return quintiles

def update_quintiles(df):
    """Atualiza quintis no banco de dados"""
    conn = connect_db()
    cur = conn.cursor()
    
    update_count = 0
    for _, row in df.iterrows():
        try:
            cur.execute("""
                UPDATE ic_memos 
                SET 
                    quality_score_quintile = %s,
                    momentum_score_quintile = %s,
                    composite_score_quintile = %s,
                    updated_at = NOW()
                WHERE memo_id = %s
            """, (
                int(row['quality_quintile_new']) if pd.notna(row['quality_quintile_new']) else None,
                int(row['momentum_quintile_new']) if pd.notna(row['momentum_quintile_new']) else None,
                int(row['composite_quintile_new']) if pd.notna(row['composite_quintile_new']) else None,
                row['memo_id']
            ))
            update_count += 1
        except Exception as e:
            print(f"  [ERROR] Updating {row['ticker']}: {e}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    return update_count

def print_distribution(df, column, name):
    """Imprime distribuição de quintis"""
    print(f"\n{name} Quintile Distribution:")
    print("-" * 40)
    counts = df[column].value_counts().sort_index()
    total = counts.sum()
    for q in [1, 2, 3, 4, 5]:
        count = counts.get(q, 0)
        pct = (count / total * 100) if total > 0 else 0
        bar = "█" * int(pct / 2)
        print(f"  Q{q}: {count:4d} ({pct:5.1f}%) {bar}")
    
    # Estatísticas do score
    score_col = column.replace('_quintile_new', '_score')
    if score_col in df.columns:
        for q in [1, 2, 3, 4, 5]:
            q_data = df[df[column] == q][score_col]
            if len(q_data) > 0:
                print(f"       Q{q} Score Range: {q_data.min():.1f} - {q_data.max():.1f} (mean: {q_data.mean():.1f})")

def main():
    print("=" * 80)
    print("RECALCULATE QUINTILES - CROSS-SECTIONAL")
    print(f"Started at: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # Buscar dados
    print("\n[1/4] Fetching IC Memo scores from database...")
    df = fetch_all_scores()
    print(f"  Found {len(df)} complete IC Memos")
    
    # Estatísticas dos scores
    print("\n[2/4] Score Statistics:")
    print("-" * 60)
    for score_col in ['quality_score', 'momentum_score', 'composite_score']:
        valid = df[score_col].notna().sum()
        if valid > 0:
            mean = df[score_col].mean()
            std = df[score_col].std()
            min_val = df[score_col].min()
            max_val = df[score_col].max()
            print(f"  {score_col:20s}: n={valid:4d}, mean={mean:5.1f}, std={std:5.1f}, range=[{min_val:.1f}, {max_val:.1f}]")
        else:
            print(f"  {score_col:20s}: No valid values")
    
    # Calcular novos quintis
    print("\n[3/4] Calculating new quintiles cross-sectionally...")
    df['quality_quintile_new'] = calculate_quintiles(df['quality_score'])
    df['momentum_quintile_new'] = calculate_quintiles(df['momentum_score'])
    df['composite_quintile_new'] = calculate_quintiles(df['composite_score'])
    
    # Mostrar distribuições
    print_distribution(df, 'quality_quintile_new', 'Quality')
    print_distribution(df, 'momentum_quintile_new', 'Momentum')
    print_distribution(df, 'composite_quintile_new', 'Composite')
    
    # Comparar com quintis anteriores
    print("\n" + "-" * 60)
    print("Changes from previous quintiles:")
    for score_type in ['quality', 'momentum', 'composite']:
        old_col = f'{score_type}_score_quintile'
        new_col = f'{score_type}_quintile_new'
        
        # Contar mudanças
        both_valid = df[old_col].notna() & df[new_col].notna()
        if both_valid.sum() > 0:
            changed = (df[old_col] != df[new_col]) & both_valid
            unchanged = (df[old_col] == df[new_col]) & both_valid
            print(f"  {score_type.capitalize():10s}: {unchanged.sum():4d} unchanged, {changed.sum():4d} changed")
    
    # Atualizar banco de dados
    print("\n[4/4] Updating database...")
    update_count = update_quintiles(df)
    print(f"  Updated {update_count} IC Memos")
    
    # Top performers por composite
    print("\n" + "=" * 80)
    print("TOP 20 BY COMPOSITE SCORE (Q5):")
    print("=" * 80)
    top = df[df['composite_quintile_new'] == 5].nlargest(20, 'composite_score')
    print(f"{'Ticker':<12} {'Quality':<10} {'Momentum':<10} {'Composite':<10} {'Q':<3} {'M':<3} {'C':<3}")
    print("-" * 60)
    for _, row in top.iterrows():
        q_score = f"{row['quality_score']:.1f}" if pd.notna(row['quality_score']) else "N/A"
        m_score = f"{row['momentum_score']:.1f}" if pd.notna(row['momentum_score']) else "N/A"
        c_score = f"{row['composite_score']:.1f}" if pd.notna(row['composite_score']) else "N/A"
        q_q = str(int(row['quality_quintile_new'])) if pd.notna(row['quality_quintile_new']) else "-"
        m_q = str(int(row['momentum_quintile_new'])) if pd.notna(row['momentum_quintile_new']) else "-"
        c_q = str(int(row['composite_quintile_new'])) if pd.notna(row['composite_quintile_new']) else "-"
        print(f"{row['ticker']:<12} {q_score:<10} {m_score:<10} {c_score:<10} {q_q:<3} {m_q:<3} {c_q:<3}")
    
    print("\n" + "=" * 80)
    print(f"QUINTILE RECALCULATION COMPLETE")
    print(f"Finished at: {datetime.now().isoformat()}")
    print("=" * 80)
    
    return df

if __name__ == '__main__':
    df = main()
