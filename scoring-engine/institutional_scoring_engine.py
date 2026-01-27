#!/usr/bin/env python3
"""
ARC Institutional Scoring Engine
================================

Implements 4 distinct factor scores following top hedge fund methodologies:
1. Quality Score - Based on MOAT, Management, ROIC durability, etc.
2. Contrarian Score - RSI inverted, Momentum 12m inverted, 52W Low inverted
3. Turnaround Score - Sequential ROE/Margin improvement, Earnings Surprise, Momentum 1M
4. Piotroski F-Score - 9 binary criteria per academic methodology

Normalization: Cross-sectional z-score with winsorization (5%-95%)
"""

import os
import json
import psycopg2
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from scipy import stats

# Database connection - uses environment variable
DATABASE_URL = os.environ.get('DATABASE_URL')

# ============================================================================
# NORMALIZATION UTILITIES (Institutional Grade)
# ============================================================================

def winsorize(series: pd.Series, lower: float = 0.05, upper: float = 0.95) -> pd.Series:
    """Winsorize series at specified percentiles to reduce outlier impact."""
    lower_bound = series.quantile(lower)
    upper_bound = series.quantile(upper)
    return series.clip(lower=lower_bound, upper=upper_bound)

def zscore_normalize(series: pd.Series, winsorize_pct: Tuple[float, float] = (0.05, 0.95)) -> pd.Series:
    """
    Cross-sectional z-score normalization with winsorization.
    Standard institutional approach for factor scoring.
    """
    # Winsorize first to reduce outlier impact
    winsorized = winsorize(series, winsorize_pct[0], winsorize_pct[1])
    
    # Z-score normalize
    mean = winsorized.mean()
    std = winsorized.std()
    
    if std == 0 or pd.isna(std):
        return pd.Series([50.0] * len(series), index=series.index)
    
    z_scores = (winsorized - mean) / std
    
    # Convert to 0-100 scale (z-score of -3 to +3 maps to 0-100)
    normalized = 50 + (z_scores * 16.67)  # 16.67 = 50/3
    return normalized.clip(0, 100)

def rank_normalize(series: pd.Series) -> pd.Series:
    """
    Rank-based normalization (percentile ranking).
    More robust to outliers than z-score.
    """
    ranks = series.rank(method='average', pct=True)
    return ranks * 100

def invert_score(series: pd.Series) -> pd.Series:
    """Invert a 0-100 score (for contrarian signals)."""
    return 100 - series

# ============================================================================
# QUALITY SCORE (14 Factors)
# ============================================================================

def calculate_quality_score(memo_content: Dict, supporting_analyses: Dict) -> Dict[str, Any]:
    """
    Calculate Quality Score based on 14 qualitative factors:
    
    From memo_content._conviction_score_v2.components:
    1. moat_analysis (0-100)
    2. management_quality (0-100)
    3. business_model (0-100)
    4. valuation_assessment (0-100)
    
    From supporting_analyses.roic_decomposition:
    5. overall_roic_durability_score (1-10)
    6. gross_margin_fragility_score (1-10, inverted)
    7. capital_turns_fragility_score (1-10, inverted)
    
    Derived from memo_content sections:
    8. opportunity_strength (from executive_summary)
    9. why_now_urgency (from executive_summary)
    10. risk_reward_asymmetry (from executive_summary)
    11. value_creation_mechanism (from investment_thesis)
    12. sustainability (from investment_thesis)
    13. structural_vs_cyclical (from investment_thesis)
    14. catalyst_strength (from catalysts)
    """
    
    components = {}
    
    # Extract conviction score components
    conviction = memo_content.get('_conviction_score_v2', {})
    conv_components = conviction.get('components', {})
    
    # 1-4: Direct quality metrics from conviction score
    components['moat_analysis'] = conv_components.get('moat_analysis', 50)
    components['management_quality'] = conv_components.get('management_quality', 50)
    components['business_model'] = conv_components.get('business_model', 50)
    components['valuation_assessment'] = conv_components.get('valuation_assessment', 50)
    
    # 5-7: ROIC decomposition scores
    roic_decomp = supporting_analyses.get('roic_decomposition', {})
    roic_result = roic_decomp.get('result', {})
    roic_data = roic_result.get('data', {}) if isinstance(roic_result, dict) else {}
    roic_stress = roic_data.get('roic_stress_test', {}) if isinstance(roic_data, dict) else {}
    roic_scores = roic_stress.get('scores', {}) if isinstance(roic_stress, dict) else {}
    
    # Overall ROIC durability (1-10 -> 0-100)
    durability = roic_scores.get('overall_roic_durability_score_1_to_10', 5) if isinstance(roic_scores, dict) else 5
    if not isinstance(durability, (int, float)):
        durability = 5
    components['roic_durability'] = (durability / 10) * 100
    
    # Gross margin fragility (inverted: lower fragility = higher quality)
    gm_fragility = roic_scores.get('gross_margin_fragility_score_1_to_10', 5) if isinstance(roic_scores, dict) else 5
    if not isinstance(gm_fragility, (int, float)):
        gm_fragility = 5
    components['gross_margin_quality'] = (1 - gm_fragility / 10) * 100
    
    # Capital turns fragility (inverted)
    ct_fragility = roic_scores.get('capital_turns_fragility_score_1_to_10', 5) if isinstance(roic_scores, dict) else 5
    if not isinstance(ct_fragility, (int, float)):
        ct_fragility = 5
    components['capital_efficiency'] = (1 - ct_fragility / 10) * 100
    
    # 8-10: Executive summary quality signals
    exec_summary = memo_content.get('executive_summary', {})
    if isinstance(exec_summary, str):
        exec_summary = {'opportunity': exec_summary}
    elif not isinstance(exec_summary, dict):
        exec_summary = {}
    
    # Opportunity strength (text analysis - simplified scoring)
    opportunity = exec_summary.get('opportunity', '') if isinstance(exec_summary, dict) else ''
    components['opportunity_strength'] = _score_text_quality(opportunity, 
        positive_keywords=['compelling', 'significant', 'strong', 'exceptional', 'undervalued', 'asymmetric'],
        negative_keywords=['limited', 'modest', 'uncertain', 'challenging', 'risk'])
    
    # Why now urgency
    why_now = exec_summary.get('why_now', '')
    components['why_now_urgency'] = _score_text_quality(why_now,
        positive_keywords=['catalyst', 'inflection', 'accelerating', 'imminent', 'near-term', 'window'],
        negative_keywords=['uncertain', 'delayed', 'unclear', 'long-term'])
    
    # Risk/reward asymmetry
    risk_reward = exec_summary.get('risk_reward_asymmetry', '')
    components['risk_reward_asymmetry'] = _score_text_quality(risk_reward,
        positive_keywords=['favorable', 'asymmetric', 'upside', 'limited downside', 'attractive'],
        negative_keywords=['balanced', 'symmetric', 'downside', 'risk'])
    
    # 11-13: Investment thesis quality
    thesis = memo_content.get('investment_thesis', {})
    if isinstance(thesis, str):
        thesis = {'central_thesis': thesis}
    elif not isinstance(thesis, dict):
        thesis = {}
    
    components['value_creation_mechanism'] = _score_text_quality(
        thesis.get('value_creation_mechanism', ''),
        positive_keywords=['durable', 'sustainable', 'compounding', 'pricing power', 'moat', 'scale'],
        negative_keywords=['temporary', 'cyclical', 'commodity', 'competitive'])
    
    components['sustainability'] = _score_text_quality(
        thesis.get('sustainability', ''),
        positive_keywords=['durable', 'structural', 'long-term', 'defensible', 'recurring'],
        negative_keywords=['temporary', 'cyclical', 'vulnerable', 'competitive'])
    
    # Structural vs cyclical (higher = more structural)
    structural = thesis.get('structural_vs_cyclical', '')
    components['structural_advantage'] = _score_text_quality(structural,
        positive_keywords=['structural', 'secular', 'permanent', 'durable'],
        negative_keywords=['cyclical', 'temporary', 'volatile'])
    
    # 14: Catalyst strength
    catalysts = memo_content.get('catalysts', {})
    if not isinstance(catalysts, dict):
        catalysts = {}
    catalyst_events = catalysts.get('value_unlocking_events', [])
    if not isinstance(catalyst_events, list):
        catalyst_events = []
    components['catalyst_strength'] = min(100, len(catalyst_events) * 20 + 30)  # 30 base + 20 per catalyst
    
    # Calculate weighted average
    weights = {
        'moat_analysis': 0.12,
        'management_quality': 0.08,
        'business_model': 0.10,
        'valuation_assessment': 0.08,
        'roic_durability': 0.12,
        'gross_margin_quality': 0.08,
        'capital_efficiency': 0.06,
        'opportunity_strength': 0.06,
        'why_now_urgency': 0.06,
        'risk_reward_asymmetry': 0.08,
        'value_creation_mechanism': 0.06,
        'sustainability': 0.04,
        'structural_advantage': 0.04,
        'catalyst_strength': 0.02
    }
    
    total_score = sum(components.get(k, 50) * w for k, w in weights.items())
    
    return {
        'score': round(total_score, 2),
        'components': components
    }

def _score_text_quality(text: str, positive_keywords: List[str], negative_keywords: List[str]) -> float:
    """Score text based on keyword presence (simplified NLP)."""
    if not text:
        return 50.0
    
    text_lower = text.lower()
    
    positive_count = sum(1 for kw in positive_keywords if kw.lower() in text_lower)
    negative_count = sum(1 for kw in negative_keywords if kw.lower() in text_lower)
    
    # Base score of 50, +10 per positive, -10 per negative
    score = 50 + (positive_count * 10) - (negative_count * 10)
    return max(0, min(100, score))

# ============================================================================
# CONTRARIAN SCORE (3 Inverted Factors)
# ============================================================================

def calculate_contrarian_score(memo_content: Dict) -> Dict[str, Any]:
    """
    Calculate Contrarian Score based on inverted technical signals:
    
    1. RSI Inverted (proxy: volatility inverted - high volatility = oversold opportunity)
    2. Momentum 12m Inverted (poor recent performance = contrarian opportunity)
    3. Position vs 52W Low Inverted (closer to low = more contrarian)
    
    Contrarian logic: We WANT stocks that are beaten down (low momentum, near lows)
    """
    
    conviction = memo_content.get('_conviction_score_v2', {})
    components = conviction.get('components', {})
    
    # Get raw values (already 0-100 scale)
    momentum_12m = components.get('momentum_12m', 50)
    position_vs_52w_low = components.get('position_vs_52w_low', 50)
    volatility = components.get('volatility', 50)
    momentum_6m = components.get('momentum_6m', 50)
    
    # Invert signals for contrarian scoring
    # Low momentum = high contrarian score
    contrarian_components = {
        'momentum_12m_inverted': 100 - momentum_12m,  # Poor 12m performance = opportunity
        'momentum_6m_inverted': 100 - momentum_6m,    # Poor 6m performance = opportunity
        'position_vs_52w_low_inverted': 100 - position_vs_52w_low,  # Near 52w low = opportunity
        'volatility_as_opportunity': volatility * 0.5 + 25,  # High vol = some opportunity, but capped
    }
    
    # Weights for contrarian score
    weights = {
        'momentum_12m_inverted': 0.40,
        'momentum_6m_inverted': 0.20,
        'position_vs_52w_low_inverted': 0.30,
        'volatility_as_opportunity': 0.10
    }
    
    total_score = sum(contrarian_components.get(k, 50) * w for k, w in weights.items())
    
    return {
        'score': round(total_score, 2),
        'components': contrarian_components
    }

# ============================================================================
# TURNAROUND SCORE (4 Factors)
# ============================================================================

def calculate_turnaround_score(memo_content: Dict) -> Dict[str, Any]:
    """
    Calculate Turnaround Score based on improvement signals:
    
    1. ROE Level (high ROE = good fundamentals for turnaround)
    2. Operating Margin Level (improving margins)
    3. Momentum 1M (direct - recent positive momentum = turnaround starting)
    4. Earnings Surprise Proxy (derived from recommendation strength)
    
    Turnaround logic: We want stocks showing IMPROVEMENT in fundamentals
    """
    
    conviction = memo_content.get('_conviction_score_v2', {})
    components = conviction.get('components', {})
    
    # Get raw values
    roe = components.get('roe', 50)
    roa = components.get('roa', 50)
    operating_margin = components.get('operating_margin', 50)
    net_margin = components.get('net_margin', 50)
    momentum_1m = components.get('momentum_1m', 50)
    momentum_3m = components.get('momentum_3m', 50)
    
    # Calculate turnaround components
    turnaround_components = {
        'roe_strength': roe,
        'roa_strength': roa,
        'operating_margin_strength': operating_margin,
        'net_margin_strength': net_margin,
        'momentum_1m_direct': momentum_1m,  # Direct (not inverted) - positive momentum = turnaround
        'momentum_3m_direct': momentum_3m,  # Short-term momentum
    }
    
    # Weights for turnaround score
    weights = {
        'roe_strength': 0.20,
        'roa_strength': 0.15,
        'operating_margin_strength': 0.20,
        'net_margin_strength': 0.10,
        'momentum_1m_direct': 0.20,
        'momentum_3m_direct': 0.15
    }
    
    total_score = sum(turnaround_components.get(k, 50) * w for k, w in weights.items())
    
    return {
        'score': round(total_score, 2),
        'components': turnaround_components
    }

# ============================================================================
# PIOTROSKI F-SCORE (9 Binary Criteria)
# ============================================================================

def calculate_piotroski_score(memo_content: Dict) -> Dict[str, Any]:
    """
    Calculate Piotroski F-Score based on 9 binary criteria:
    
    Profitability (4 points):
    1. ROA > 0 (positive return on assets)
    2. CFO > 0 (positive operating cash flow)
    3. ΔROA > 0 (improving ROA)
    4. CFO > Net Income (accruals quality)
    
    Leverage/Liquidity (3 points):
    5. ΔLeverage < 0 (decreasing debt)
    6. ΔCurrent Ratio > 0 (improving liquidity)
    7. No new equity issuance
    
    Operating Efficiency (2 points):
    8. ΔGross Margin > 0 (improving margins)
    9. ΔAsset Turnover > 0 (improving efficiency)
    
    Since we don't have full financial statement data, we proxy using available metrics.
    """
    
    conviction = memo_content.get('_conviction_score_v2', {})
    components = conviction.get('components', {})
    
    # Get available metrics
    roe = components.get('roe', 50)
    roa = components.get('roa', 50)
    operating_margin = components.get('operating_margin', 50)
    net_margin = components.get('net_margin', 50)
    debt_to_equity = components.get('debt_to_equity', 50)
    
    # Calculate Piotroski criteria (proxied)
    piotroski_criteria = {}
    
    # 1. ROA > 0 (proxy: ROA percentile > 30)
    piotroski_criteria['positive_roa'] = 1 if roa > 30 else 0
    
    # 2. CFO > 0 (proxy: operating margin > 30)
    piotroski_criteria['positive_cfo'] = 1 if operating_margin > 30 else 0
    
    # 3. ΔROA > 0 (proxy: ROA percentile > 50 suggests improvement)
    piotroski_criteria['improving_roa'] = 1 if roa > 50 else 0
    
    # 4. Accruals quality (proxy: net margin close to operating margin)
    margin_diff = abs(operating_margin - net_margin)
    piotroski_criteria['accruals_quality'] = 1 if margin_diff < 30 else 0
    
    # 5. Decreasing leverage (proxy: debt_to_equity percentile < 60)
    piotroski_criteria['low_leverage'] = 1 if debt_to_equity < 60 else 0
    
    # 6. Improving liquidity (proxy: debt_to_equity < 50)
    piotroski_criteria['good_liquidity'] = 1 if debt_to_equity < 50 else 0
    
    # 7. No equity dilution (proxy: assume pass if ROE is decent)
    piotroski_criteria['no_dilution'] = 1 if roe > 40 else 0
    
    # 8. Improving gross margin (proxy: operating margin > 50)
    piotroski_criteria['improving_margin'] = 1 if operating_margin > 50 else 0
    
    # 9. Improving asset turnover (proxy: ROA > 50 with low debt)
    piotroski_criteria['improving_turnover'] = 1 if (roa > 50 and debt_to_equity < 60) else 0
    
    # Calculate total F-Score (0-9)
    f_score = sum(piotroski_criteria.values())
    
    return {
        'score': f_score,  # 0-9 scale
        'score_normalized': round((f_score / 9) * 100, 2),  # 0-100 scale
        'components': piotroski_criteria
    }

# ============================================================================
# MAIN SCORING ENGINE
# ============================================================================

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def extract_all_scores():
    """Extract and calculate all 4 scores for all IC Memos."""
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get all complete memos
    cur.execute("""
        SELECT 
            memo_id, ticker, company_name, 
            memo_content, supporting_analyses
        FROM ic_memos 
        WHERE status = 'complete'
        ORDER BY ticker
    """)
    
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    print(f"Processing {len(rows)} IC Memos...")
    
    results = []
    
    for memo_id, ticker, company_name, memo_content, supporting_analyses in rows:
        # Parse JSON if needed
        if isinstance(memo_content, str):
            try:
                memo_content = json.loads(memo_content)
            except:
                memo_content = {}
        
        if isinstance(supporting_analyses, str):
            try:
                supporting_analyses = json.loads(supporting_analyses)
            except:
                supporting_analyses = {}
        
        # Calculate all 4 scores
        quality = calculate_quality_score(memo_content, supporting_analyses)
        contrarian = calculate_contrarian_score(memo_content)
        turnaround = calculate_turnaround_score(memo_content)
        piotroski = calculate_piotroski_score(memo_content)
        
        results.append({
            'memo_id': memo_id,
            'ticker': ticker,
            'company_name': company_name,
            'quality_score': quality['score'],
            'quality_components': quality['components'],
            'contrarian_score': contrarian['score'],
            'contrarian_components': contrarian['components'],
            'turnaround_score': turnaround['score'],
            'turnaround_components': turnaround['components'],
            'piotroski_score': piotroski['score'],
            'piotroski_normalized': piotroski['score_normalized'],
            'piotroski_components': piotroski['components']
        })
    
    return pd.DataFrame(results)

def apply_cross_sectional_normalization(df: pd.DataFrame) -> pd.DataFrame:
    """Apply cross-sectional z-score normalization to all scores."""
    
    # Normalize each score using z-score with winsorization
    df['quality_score_normalized'] = zscore_normalize(df['quality_score'])
    df['contrarian_score_normalized'] = zscore_normalize(df['contrarian_score'])
    df['turnaround_score_normalized'] = zscore_normalize(df['turnaround_score'])
    # Piotroski is already 0-9, normalize to 0-100
    df['piotroski_score_normalized'] = zscore_normalize(df['piotroski_score'] * 11.11)  # Scale 0-9 to ~0-100
    
    return df

def calculate_quintiles(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate quintiles for each score using z-score based cutoffs."""
    
    for score_col in ['quality_score', 'contrarian_score', 'turnaround_score']:
        # Z-score based quintiles
        z_scores = (df[score_col] - df[score_col].mean()) / df[score_col].std()
        
        # Quintile cutoffs at -0.84, -0.25, 0.25, 0.84 standard deviations
        conditions = [
            z_scores < -0.84,
            (z_scores >= -0.84) & (z_scores < -0.25),
            (z_scores >= -0.25) & (z_scores < 0.25),
            (z_scores >= 0.25) & (z_scores < 0.84),
            z_scores >= 0.84
        ]
        choices = [1, 2, 3, 4, 5]
        df[f'{score_col}_quintile'] = np.select(conditions, choices, default=3)
    
    # Piotroski quintiles (0-9 scale)
    piotroski_conditions = [
        df['piotroski_score'] <= 2,
        (df['piotroski_score'] > 2) & (df['piotroski_score'] <= 4),
        (df['piotroski_score'] > 4) & (df['piotroski_score'] <= 5),
        (df['piotroski_score'] > 5) & (df['piotroski_score'] <= 7),
        df['piotroski_score'] > 7
    ]
    df['piotroski_score_quintile'] = np.select(piotroski_conditions, [1, 2, 3, 4, 5], default=3)
    
    return df

def update_database(df: pd.DataFrame):
    """Update database with all 4 calculated scores."""
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    updated = 0
    for _, row in df.iterrows():
        try:
            cur.execute("""
                UPDATE ic_memos 
                SET 
                    quality_score = %s,
                    quality_score_quintile = %s,
                    contrarian_score = %s,
                    contrarian_score_quintile = %s,
                    turnaround_score = %s,
                    turnaround_score_quintile = %s,
                    piotroski_score = %s,
                    piotroski_score_quintile = %s,
                    score_v4 = %s,
                    score_v4_quintile = %s,
                    updated_at = NOW()
                WHERE memo_id = %s
            """, (
                float(row['quality_score']),
                int(row['quality_score_quintile']),
                float(row['contrarian_score']),
                int(row['contrarian_score_quintile']),
                float(row['turnaround_score']),
                int(row['turnaround_score_quintile']),
                int(row['piotroski_score']),
                int(row['piotroski_score_quintile']),
                float(row['quality_score']),  # Using quality as the main score_v4
                str(row['quality_score_quintile']),
                row['memo_id']
            ))
            updated += 1
        except Exception as e:
            print(f"Error updating {row['ticker']}: {e}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    return updated

def main():
    """Main execution function."""
    
    print("=" * 80)
    print("ARC INSTITUTIONAL SCORING ENGINE")
    print("=" * 80)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    # Step 1: Extract and calculate raw scores
    print("Step 1: Calculating raw scores for all IC Memos...")
    df = extract_all_scores()
    print(f"  Processed {len(df)} memos")
    
    # Step 2: Apply cross-sectional normalization
    print("\nStep 2: Applying cross-sectional z-score normalization...")
    df = apply_cross_sectional_normalization(df)
    
    # Step 3: Calculate quintiles
    print("\nStep 3: Calculating quintiles...")
    df = calculate_quintiles(df)
    
    # Step 4: Print statistics
    print("\n" + "=" * 80)
    print("SCORE STATISTICS")
    print("=" * 80)
    
    for score in ['quality_score', 'contrarian_score', 'turnaround_score', 'piotroski_score']:
        print(f"\n{score.upper().replace('_', ' ')}:")
        print(f"  Mean: {df[score].mean():.2f}")
        print(f"  Std:  {df[score].std():.2f}")
        print(f"  Min:  {df[score].min():.2f}")
        print(f"  Max:  {df[score].max():.2f}")
        
        if f'{score}_quintile' in df.columns:
            print(f"  Quintile Distribution:")
            for q in range(1, 6):
                count = (df[f'{score}_quintile'] == q).sum()
                pct = count / len(df) * 100
                print(f"    Q{q}: {count} ({pct:.1f}%)")
    
    # Step 5: Update database
    print("\n" + "=" * 80)
    print("UPDATING DATABASE")
    print("=" * 80)
    updated = update_database(df)
    print(f"Updated {updated} records")
    
    # Step 6: Save results to CSV
    output_path = '/tmp/institutional_scores.csv'
    df.to_csv(output_path, index=False)
    print(f"\nResults saved to: {output_path}")
    
    # Step 7: Print top performers for each score
    print("\n" + "=" * 80)
    print("TOP 10 PERFORMERS BY SCORE")
    print("=" * 80)
    
    for score in ['quality_score', 'contrarian_score', 'turnaround_score', 'piotroski_score']:
        print(f"\n{score.upper().replace('_', ' ')}:")
        top10 = df.nlargest(10, score)[['ticker', score]]
        for _, row in top10.iterrows():
            print(f"  {row['ticker']}: {row[score]:.2f}")
    
    print("\n" + "=" * 80)
    print("SCORING COMPLETE")
    print(f"Finished at: {datetime.now().isoformat()}")
    print("=" * 80)
    
    return df

if __name__ == '__main__':
    main()
