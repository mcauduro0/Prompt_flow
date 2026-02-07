#!/usr/bin/env python3
"""
Quality Score - Implementação Correta
======================================
Extrai dados qualitativos do IC Memo e ROIC Decomposition,
normaliza usando z-scores cross-sectional, e calcula o Quality Score.
"""

import json
import psycopg2
import pandas as pd
import numpy as np
from scipy import stats
import os

DATABASE_URL = os.environ.get('DATABASE_URL')

def connect_db():
    return psycopg2.connect(DATABASE_URL)

def safe_float(value):
    """Safely convert value to float"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except:
            return None
    if isinstance(value, dict):
        # Some scores are stored as {"score": X, "rationale": "..."}
        if 'score' in value:
            return safe_float(value['score'])
        return None
    return None

def extract_all_quality_components():
    """Extract all quality components from IC Memos"""
    conn = connect_db()
    cur = conn.cursor()
    
    # Get raw JSON data
    query = """
    SELECT 
        memo_id,
        ticker,
        company_name,
        (memo_content#>>'{}')::jsonb as memo_json,
        (supporting_analyses#>>'{}')::jsonb as support_json
    FROM ic_memos
    WHERE status = 'complete'
    """
    
    cur.execute(query)
    rows = cur.fetchall()
    
    cur.close()
    conn.close()
    
    # Process each row
    data = []
    for row in rows:
        memo_id, ticker, company_name, memo_json, support_json = row
        
        record = {
            'memo_id': memo_id,
            'ticker': ticker,
            'company_name': company_name
        }
        
        # Extract conviction score v2 components
        if memo_json:
            try:
                if isinstance(memo_json, str):
                    memo_json = json.loads(memo_json)
                
                conv_v2 = memo_json.get('_conviction_score_v2', {})
                components = conv_v2.get('components', {})
                
                record['moat_analysis'] = safe_float(components.get('moat_analysis'))
                record['management_quality'] = safe_float(components.get('management_quality'))
                record['business_model'] = safe_float(components.get('business_model'))
                record['valuation_assessment'] = safe_float(components.get('valuation_assessment'))
                record['roe'] = safe_float(components.get('roe'))
                record['roa'] = safe_float(components.get('roa'))
                record['operating_margin'] = safe_float(components.get('operating_margin'))
                record['net_margin'] = safe_float(components.get('net_margin'))
                record['debt_to_equity'] = safe_float(components.get('debt_to_equity'))
            except Exception as e:
                print(f"  Error parsing memo_json for {ticker}: {e}")
        
        # Extract ROIC decomposition scores
        if support_json:
            try:
                if isinstance(support_json, str):
                    support_json = json.loads(support_json)
                
                roic_decomp = support_json.get('roic_decomposition', {})
                result = roic_decomp.get('result', {})
                
                if isinstance(result, str):
                    result = json.loads(result)
                
                data_obj = result.get('data', {})
                
                if isinstance(data_obj, str):
                    data_obj = json.loads(data_obj)
                
                stress_test = data_obj.get('roic_stress_test', {})
                
                if isinstance(stress_test, str):
                    stress_test = json.loads(stress_test)
                
                scores = stress_test.get('scores', {})
                
                record['gross_margin_fragility'] = safe_float(scores.get('gross_margin_fragility_score_1_to_10'))
                record['capital_turns_fragility'] = safe_float(scores.get('capital_turns_fragility_score_1_to_10'))
                record['roic_durability'] = safe_float(scores.get('overall_roic_durability_score_1_to_10'))
            except Exception as e:
                print(f"  Error parsing support_json for {ticker}: {e}")
        
        data.append(record)
    
    return pd.DataFrame(data)

def zscore_normalize(series, winsorize_std=3.0):
    """Normalize using z-scores with winsorization"""
    valid = series.dropna()
    
    if len(valid) < 3:
        return pd.Series([50.0] * len(series), index=series.index)
    
    mean = valid.mean()
    std = valid.std()
    
    if std == 0 or pd.isna(std):
        return pd.Series([50.0] * len(series), index=series.index)
    
    z_scores = (series - mean) / std
    z_scores = z_scores.clip(-winsorize_std, winsorize_std)
    normalized = 50 + (z_scores * 10)
    normalized = normalized.clip(0, 100)
    
    return normalized

def calculate_quality_score(df):
    """Calculate Quality Score using z-score normalization"""
    
    print("=" * 80)
    print("QUALITY SCORE CALCULATION - CORRECT METHODOLOGY")
    print("=" * 80)
    print(f"\nTotal records: {len(df)}")
    
    # Components with weights
    components = {
        # Qualitative Factors (40%)
        'moat_analysis': {'weight': 0.15, 'invert': False, 'scale': 100},
        'management_quality': {'weight': 0.10, 'invert': False, 'scale': 100},
        'business_model': {'weight': 0.10, 'invert': False, 'scale': 100},
        'valuation_assessment': {'weight': 0.05, 'invert': False, 'scale': 100},
        
        # Financial Quality (35%)
        'roe': {'weight': 0.10, 'invert': False, 'scale': 100},
        'roa': {'weight': 0.05, 'invert': False, 'scale': 100},
        'operating_margin': {'weight': 0.10, 'invert': False, 'scale': 100},
        'net_margin': {'weight': 0.05, 'invert': False, 'scale': 100},
        'debt_to_equity': {'weight': 0.05, 'invert': False, 'scale': 100},
        
        # ROIC Decomposition (25%)
        'gross_margin_fragility': {'weight': 0.08, 'invert': True, 'scale': 10},
        'capital_turns_fragility': {'weight': 0.07, 'invert': True, 'scale': 10},
        'roic_durability': {'weight': 0.10, 'invert': False, 'scale': 10},
    }
    
    print("\nNormalizing components using z-scores:")
    print("-" * 80)
    
    normalized_components = {}
    
    for comp_name, config in components.items():
        if comp_name not in df.columns:
            print(f"  WARNING: {comp_name} not found in data")
            continue
            
        raw_values = df[comp_name].copy()
        
        # Scale ROIC scores from 1-10 to 0-100
        if config['scale'] == 10:
            raw_values = raw_values * 10
        
        # Invert if needed
        if config['invert']:
            raw_values = 100 - raw_values
        
        # Apply z-score normalization
        normalized = zscore_normalize(raw_values, winsorize_std=3.0)
        normalized_components[comp_name] = normalized
        
        valid_count = df[comp_name].notna().sum()
        raw_mean = raw_values.mean() if valid_count > 0 else 0
        raw_std = raw_values.std() if valid_count > 0 else 0
        norm_mean = normalized.mean()
        norm_std = normalized.std()
        
        print(f"  {comp_name:30s} | Valid: {valid_count:3d} | Raw: {raw_mean:6.1f}±{raw_std:5.1f} | "
              f"Norm: {norm_mean:5.1f}±{norm_std:4.1f} | Weight: {config['weight']*100:.0f}%"
              f"{' (inverted)' if config['invert'] else ''}")
    
    # Calculate weighted Quality Score
    print("\n" + "-" * 80)
    print("Calculating weighted Quality Score...")
    
    quality_scores = pd.Series(0.0, index=df.index)
    total_weight = 0.0
    
    for comp_name, config in components.items():
        if comp_name in normalized_components:
            comp_values = normalized_components[comp_name].fillna(50)
            quality_scores += comp_values * config['weight']
            total_weight += config['weight']
    
    if total_weight > 0:
        quality_scores = quality_scores / total_weight
    
    df['quality_score_new'] = quality_scores.round(2)
    
    print(f"\nQuality Score Statistics:")
    print(f"  Mean: {quality_scores.mean():.2f}")
    print(f"  Std:  {quality_scores.std():.2f}")
    print(f"  Min:  {quality_scores.min():.2f}")
    print(f"  Max:  {quality_scores.max():.2f}")
    
    # Quintile distribution
    try:
        df['quality_quintile'] = pd.qcut(quality_scores, q=5, labels=[1, 2, 3, 4, 5], duplicates='drop')
    except:
        df['quality_quintile'] = pd.cut(quality_scores, bins=5, labels=[1, 2, 3, 4, 5])
    
    print(f"\nQuintile Distribution:")
    quintile_counts = df['quality_quintile'].value_counts().sort_index()
    for q, count in quintile_counts.items():
        pct = count / len(df) * 100
        q_mean = df[df['quality_quintile'] == q]['quality_score_new'].mean()
        print(f"  Q{q}: {count:3d} ({pct:5.1f}%) | Mean Score: {q_mean:.1f}")
    
    return df, normalized_components

def save_results(df):
    """Save results to database and CSV"""
    output_path = '/home/ubuntu/quality_score_correct_results.csv'
    
    cols_to_save = ['ticker', 'company_name', 'quality_score_new', 'quality_quintile']
    for col in ['moat_analysis', 'management_quality', 'business_model', 'valuation_assessment',
                'roe', 'roa', 'operating_margin', 'net_margin', 'debt_to_equity',
                'gross_margin_fragility', 'capital_turns_fragility', 'roic_durability']:
        if col in df.columns:
            cols_to_save.append(col)
    
    df[cols_to_save].to_csv(output_path, index=False)
    print(f"\nSaved results to {output_path}")
    
    # Update database
    conn = connect_db()
    cur = conn.cursor()
    
    update_count = 0
    for _, row in df.iterrows():
        try:
            cur.execute("""
                UPDATE ic_memos 
                SET quality_score = %s
                WHERE memo_id = %s
            """, (row['quality_score_new'], row['memo_id']))
            update_count += 1
        except Exception as e:
            print(f"  Error updating {row['ticker']}: {e}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"Updated {update_count} records in database")

def print_top_bottom(df, n=10):
    """Print top and bottom performers"""
    print("\n" + "=" * 80)
    print(f"TOP {n} QUALITY SCORES:")
    print("=" * 80)
    
    cols = ['ticker', 'company_name', 'quality_score_new']
    for c in ['moat_analysis', 'management_quality', 'roic_durability']:
        if c in df.columns:
            cols.append(c)
    
    top = df.nlargest(n, 'quality_score_new')[cols]
    print(top.to_string(index=False))
    
    print("\n" + "=" * 80)
    print(f"BOTTOM {n} QUALITY SCORES:")
    print("=" * 80)
    bottom = df.nsmallest(n, 'quality_score_new')[cols]
    print(bottom.to_string(index=False))

def main():
    print("\n" + "=" * 80)
    print("QUALITY SCORE - CORRECT IMPLEMENTATION")
    print("Using IC Memo Qualitative Data + ROIC Decomposition + Z-Score Normalization")
    print("=" * 80)
    
    print("\nExtracting data from database...")
    df = extract_all_quality_components()
    print(f"Extracted {len(df)} IC Memos")
    
    print("\nData Availability:")
    for col in df.columns[3:]:
        valid = df[col].notna().sum()
        pct = valid / len(df) * 100
        print(f"  {col:35s}: {valid:3d} ({pct:5.1f}%)")
    
    df, normalized = calculate_quality_score(df)
    print_top_bottom(df)
    save_results(df)
    
    print("\n" + "=" * 80)
    print("QUALITY SCORE CALCULATION COMPLETE")
    print("=" * 80)
    
    return df

if __name__ == '__main__':
    df = main()
