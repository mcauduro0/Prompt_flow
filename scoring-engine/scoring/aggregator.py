"""
ARC Scoring Engine - Aggregator
Aggregates normalized signals into block scores with risk penalties.
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional, List, Tuple
import yaml


def aggregate_weighted(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    signal_weights: Dict[str, float]
) -> Tuple[float, Dict[str, float]]:
    """
    Aggregate signals using weighted average.
    
    Args:
        df_signals: DataFrame with normalized signals
        ticker: Ticker symbol
        date: Date
        signal_weights: Dict of {signal_name: weight}
        
    Returns:
        Tuple of (aggregated_score, component_scores)
    """
    ticker_date_signals = df_signals[
        (df_signals['ticker'] == ticker) &
        (df_signals['date'] == date)
    ]
    
    total_weight = 0
    weighted_sum = 0
    component_scores = {}
    
    for signal_name, weight in signal_weights.items():
        signal_row = ticker_date_signals[
            ticker_date_signals['signal_name'] == signal_name
        ]
        
        if not signal_row.empty and pd.notna(signal_row.iloc[0]['value_normalized']):
            value = signal_row.iloc[0]['value_normalized']
            weighted_sum += value * weight
            total_weight += weight
            component_scores[signal_name] = value
    
    if total_weight > 0:
        score = weighted_sum / total_weight
    else:
        score = np.nan
    
    return score, component_scores


def compute_contrarian_score(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    config: Dict
) -> Tuple[float, Dict]:
    """
    Compute Contrarian score from normalized signals.
    
    Args:
        df_signals: DataFrame with normalized signals
        ticker: Ticker symbol
        date: Date
        config: Configuration dict
        
    Returns:
        Tuple of (score, details)
    """
    contrarian_config = config.get('contrarian', {}).get('signals', {})
    
    signal_weights = {
        name: cfg.get('weight', 0)
        for name, cfg in contrarian_config.items()
    }
    
    score, components = aggregate_weighted(df_signals, ticker, date, signal_weights)
    
    return score, {
        'score': score,
        'components': components,
        'block': 'contrarian'
    }


def compute_turnaround_score(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    config: Dict
) -> Tuple[float, Dict]:
    """
    Compute Turnaround score from normalized signals.
    
    Args:
        df_signals: DataFrame with normalized signals
        ticker: Ticker symbol
        date: Date
        config: Configuration dict
        
    Returns:
        Tuple of (score, details)
    """
    turnaround_config = config.get('turnaround', {}).get('signals', {})
    
    signal_weights = {
        name: cfg.get('weight', 0)
        for name, cfg in turnaround_config.items()
    }
    
    score, components = aggregate_weighted(df_signals, ticker, date, signal_weights)
    
    return score, {
        'score': score,
        'components': components,
        'block': 'turnaround'
    }


def compute_piotroski_score(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    config: Dict
) -> Tuple[float, Dict]:
    """
    Compute Piotroski score.
    Special handling: raw score is 0-9, convert to 0-100.
    
    Args:
        df_signals: DataFrame with signals (can use raw or normalized)
        ticker: Ticker symbol
        date: Date
        config: Configuration dict
        
    Returns:
        Tuple of (score, details)
    """
    ticker_date_signals = df_signals[
        (df_signals['ticker'] == ticker) &
        (df_signals['date'] == date) &
        (df_signals['signal_name'] == 'piotroski_raw')
    ]
    
    if ticker_date_signals.empty:
        return np.nan, {'score': np.nan, 'block': 'piotroski'}
    
    raw_score = ticker_date_signals.iloc[0]['value_raw']
    
    # Convert 0-9 to 0-100
    conversion = config.get('piotroski', {}).get('conversion', 'linear')
    
    if conversion == 'linear':
        score = (raw_score / 9) * 100
    else:
        # Use normalized value if available
        if pd.notna(ticker_date_signals.iloc[0].get('value_normalized')):
            score = ticker_date_signals.iloc[0]['value_normalized']
        else:
            score = (raw_score / 9) * 100
    
    return score, {
        'score': score,
        'raw_score': raw_score,
        'block': 'piotroski'
    }


def compute_quality_score(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    config: Dict
) -> Tuple[float, Dict]:
    """
    Compute Quality score from 4 sub-blocks.
    
    Sub-blocks:
    - Structural (30%)
    - Management (20%)
    - Financial (35%)
    - Valuation (15%)
    
    Args:
        df_signals: DataFrame with normalized signals
        ticker: Ticker symbol
        date: Date
        config: Configuration dict
        
    Returns:
        Tuple of (score, details)
    """
    quality_config = config.get('quality', {}).get('subblocks', {})
    
    subblock_scores = {}
    subblock_weights = {}
    
    for subblock_name, subblock_config in quality_config.items():
        subblock_weight = subblock_config.get('weight', 0)
        subblock_weights[subblock_name] = subblock_weight
        
        signal_weights = {
            name: cfg.get('weight', 0)
            for name, cfg in subblock_config.get('signals', {}).items()
        }
        
        subblock_score, _ = aggregate_weighted(df_signals, ticker, date, signal_weights)
        subblock_scores[subblock_name] = subblock_score
    
    # Aggregate sub-blocks
    total_weight = 0
    weighted_sum = 0
    
    for subblock_name, score in subblock_scores.items():
        if pd.notna(score):
            weight = subblock_weights.get(subblock_name, 0)
            weighted_sum += score * weight
            total_weight += weight
    
    if total_weight > 0:
        final_score = weighted_sum / total_weight
    else:
        final_score = np.nan
    
    return final_score, {
        'score': final_score,
        'subblock_scores': subblock_scores,
        'block': 'quality'
    }


def apply_risk_penalties(
    score: float,
    ticker: str,
    date: pd.Timestamp,
    df_risk: pd.DataFrame,
    config: Dict,
    block: str
) -> Tuple[float, Dict]:
    """
    Apply risk penalties to a score.
    
    Args:
        score: Raw score before penalties
        ticker: Ticker symbol
        date: Date
        df_risk: DataFrame with risk metrics
        config: Configuration dict
        block: Score block name
        
    Returns:
        Tuple of (adjusted_score, penalty_details)
    """
    if pd.isna(score):
        return score, {}
    
    penalties_config = config.get('risk_penalties', {}).get('soft_penalties', {})
    
    ticker_date_risk = df_risk[
        (df_risk['ticker'] == ticker) &
        (df_risk['date'] == date)
    ]
    
    if ticker_date_risk.empty:
        return score, {}
    
    total_penalty = 0
    penalty_details = {}
    
    for penalty_name, penalty_config in penalties_config.items():
        affected_scores = penalty_config.get('affected_scores', [])
        
        if block not in affected_scores and 'all' not in affected_scores:
            continue
        
        threshold_pct = penalty_config.get('threshold_percentile', 90)
        max_penalty = penalty_config.get('max_penalty', 10)
        
        # Get the risk metric value
        if penalty_name in ticker_date_risk.columns:
            value = ticker_date_risk.iloc[0][penalty_name]
            
            # Calculate threshold from cross-sectional distribution
            all_values = df_risk[df_risk['date'] == date][penalty_name].dropna()
            threshold = all_values.quantile(threshold_pct / 100)
            
            # Apply penalty if above threshold
            if pd.notna(value) and value > threshold:
                # Linear penalty scaling
                excess = (value - threshold) / (all_values.max() - threshold + 1e-6)
                penalty = min(excess * max_penalty, max_penalty)
                total_penalty += penalty
                penalty_details[penalty_name] = penalty
    
    adjusted_score = max(0, score - total_penalty)
    
    return adjusted_score, penalty_details


def compute_all_scores(
    df_signals: pd.DataFrame,
    df_risk: pd.DataFrame,
    config: Dict
) -> pd.DataFrame:
    """
    Compute all block scores for all tickers and dates.
    
    Args:
        df_signals: DataFrame with normalized signals
        df_risk: DataFrame with risk metrics
        config: Configuration dict
        
    Returns:
        DataFrame with columns [date, ticker, block, score_raw, score_adjusted, details]
    """
    results = []
    
    # Get unique ticker/date combinations
    ticker_dates = df_signals[['ticker', 'date']].drop_duplicates()
    
    for _, row in ticker_dates.iterrows():
        ticker = row['ticker']
        date = row['date']
        
        # Contrarian
        contrarian_score, contrarian_details = compute_contrarian_score(
            df_signals, ticker, date, config
        )
        contrarian_adjusted, contrarian_penalties = apply_risk_penalties(
            contrarian_score, ticker, date, df_risk, config, 'contrarian'
        )
        results.append({
            'date': date,
            'ticker': ticker,
            'block': 'contrarian',
            'score_raw': contrarian_score,
            'score_adjusted': contrarian_adjusted,
            'penalties': contrarian_penalties,
            'details': contrarian_details
        })
        
        # Turnaround
        turnaround_score, turnaround_details = compute_turnaround_score(
            df_signals, ticker, date, config
        )
        turnaround_adjusted, turnaround_penalties = apply_risk_penalties(
            turnaround_score, ticker, date, df_risk, config, 'turnaround'
        )
        results.append({
            'date': date,
            'ticker': ticker,
            'block': 'turnaround',
            'score_raw': turnaround_score,
            'score_adjusted': turnaround_adjusted,
            'penalties': turnaround_penalties,
            'details': turnaround_details
        })
        
        # Piotroski
        piotroski_score, piotroski_details = compute_piotroski_score(
            df_signals, ticker, date, config
        )
        piotroski_adjusted, piotroski_penalties = apply_risk_penalties(
            piotroski_score, ticker, date, df_risk, config, 'piotroski'
        )
        results.append({
            'date': date,
            'ticker': ticker,
            'block': 'piotroski',
            'score_raw': piotroski_score,
            'score_adjusted': piotroski_adjusted,
            'penalties': piotroski_penalties,
            'details': piotroski_details
        })
        
        # Quality
        quality_score, quality_details = compute_quality_score(
            df_signals, ticker, date, config
        )
        quality_adjusted, quality_penalties = apply_risk_penalties(
            quality_score, ticker, date, df_risk, config, 'quality'
        )
        results.append({
            'date': date,
            'ticker': ticker,
            'block': 'quality',
            'score_raw': quality_score,
            'score_adjusted': quality_adjusted,
            'penalties': quality_penalties,
            'details': quality_details
        })
    
    return pd.DataFrame(results)


def get_quintile(
    score: float,
    mean: float,
    stddev: float
) -> int:
    """
    Get quintile based on z-score from normal distribution.
    
    Args:
        score: Score value
        mean: Population mean
        stddev: Population standard deviation
        
    Returns:
        Quintile (1-5)
    """
    if pd.isna(score) or stddev == 0:
        return np.nan
    
    z = (score - mean) / stddev
    
    # Z-score cutoffs for quintiles
    if z < -0.84:
        return 1
    elif z < -0.25:
        return 2
    elif z < 0.25:
        return 3
    elif z < 0.84:
        return 4
    else:
        return 5


def add_quintiles(
    df_scores: pd.DataFrame,
    reference_block: str = 'contrarian'
) -> pd.DataFrame:
    """
    Add quintile rankings based on a reference block score.
    
    Args:
        df_scores: DataFrame with scores
        reference_block: Block to use for quintile calculation
        
    Returns:
        DataFrame with added quintile column
    """
    df_scores = df_scores.copy()
    
    # Get reference block scores
    ref_scores = df_scores[df_scores['block'] == reference_block].copy()
    
    # Calculate mean and std for each date
    quintiles = []
    
    for date in ref_scores['date'].unique():
        date_scores = ref_scores[ref_scores['date'] == date]
        
        mean = date_scores['score_adjusted'].mean()
        stddev = date_scores['score_adjusted'].std()
        
        for _, row in date_scores.iterrows():
            quintile = get_quintile(row['score_adjusted'], mean, stddev)
            quintiles.append({
                'date': date,
                'ticker': row['ticker'],
                'quintile': quintile
            })
    
    quintile_df = pd.DataFrame(quintiles)
    
    # Merge quintiles back to all scores
    df_scores = df_scores.merge(
        quintile_df,
        on=['date', 'ticker'],
        how='left'
    )
    
    return df_scores
