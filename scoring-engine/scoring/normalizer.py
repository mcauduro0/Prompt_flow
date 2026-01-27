"""
ARC Scoring Engine - Normalizer
Robust normalization with z-scores, winsorization, and 0-100 scaling.
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional, Tuple
import yaml


def winsorize(
    series: pd.Series,
    p_low: float = 0.05,
    p_high: float = 0.95
) -> pd.Series:
    """
    Winsorize a series at given percentiles.
    
    Args:
        series: Input series
        p_low: Lower percentile (default 5%)
        p_high: Upper percentile (default 95%)
        
    Returns:
        Winsorized series
    """
    lower = series.quantile(p_low)
    upper = series.quantile(p_high)
    return series.clip(lower=lower, upper=upper)


def robust_zscore(
    series: pd.Series,
    use_robust: bool = True,
    mad_min: float = 1e-6
) -> pd.Series:
    """
    Compute z-score using robust statistics (median and MAD).
    
    Args:
        series: Input series
        use_robust: If True, use median and MAD; else use mean and std
        mad_min: Minimum MAD to avoid division by zero
        
    Returns:
        Z-score series
    """
    if use_robust:
        center = series.median()
        # MAD = Median Absolute Deviation
        mad = (series - center).abs().median()
        # Scale MAD to approximate std (for normal distribution, MAD ≈ 0.6745 * std)
        scale = max(mad * 1.4826, mad_min)
    else:
        center = series.mean()
        scale = max(series.std(), mad_min)
    
    return (series - center) / scale


def zscore_to_0_100(zscore: pd.Series) -> pd.Series:
    """
    Convert z-score to 0-100 scale using CDF of normal distribution.
    
    Args:
        zscore: Z-score series
        
    Returns:
        Series scaled to 0-100
    """
    from scipy.stats import norm
    
    # CDF gives probability (0-1), multiply by 100
    return norm.cdf(zscore) * 100


def normalize_signal(
    df_signals: pd.DataFrame,
    signal_name: str,
    direction: int = 1,
    winsorize_pct: Tuple[float, float] = (0.05, 0.95),
    use_robust: bool = True,
    cross_sectional: bool = True
) -> pd.DataFrame:
    """
    Normalize a single signal.
    
    Pipeline:
    1. Winsorize at 5%/95%
    2. Compute robust z-score
    3. Apply direction (multiply by -1 if direction is -1)
    4. Convert to 0-100 scale
    
    Args:
        df_signals: DataFrame with columns [date, ticker, signal_name, value_raw]
        signal_name: Name of signal to normalize
        direction: 1 if higher is better, -1 if lower is better
        winsorize_pct: Tuple of (low, high) percentiles for winsorization
        use_robust: Use robust statistics (median/MAD)
        cross_sectional: If True, normalize within each date; else normalize globally
        
    Returns:
        DataFrame with added columns [value_winsorized, value_zscore, value_normalized]
    """
    signal_df = df_signals[df_signals['signal_name'] == signal_name].copy()
    
    if signal_df.empty:
        return signal_df
    
    if cross_sectional:
        # Normalize within each date
        results = []
        for date in signal_df['date'].unique():
            date_df = signal_df[signal_df['date'] == date].copy()
            
            # Winsorize
            date_df['value_winsorized'] = winsorize(
                date_df['value_raw'],
                p_low=winsorize_pct[0],
                p_high=winsorize_pct[1]
            )
            
            # Z-score
            date_df['value_zscore'] = robust_zscore(
                date_df['value_winsorized'],
                use_robust=use_robust
            )
            
            # Apply direction
            date_df['value_zscore'] = date_df['value_zscore'] * direction
            
            # Convert to 0-100
            date_df['value_normalized'] = zscore_to_0_100(date_df['value_zscore'])
            
            results.append(date_df)
        
        return pd.concat(results, ignore_index=True)
    else:
        # Global normalization
        signal_df['value_winsorized'] = winsorize(
            signal_df['value_raw'],
            p_low=winsorize_pct[0],
            p_high=winsorize_pct[1]
        )
        
        signal_df['value_zscore'] = robust_zscore(
            signal_df['value_winsorized'],
            use_robust=use_robust
        )
        
        signal_df['value_zscore'] = signal_df['value_zscore'] * direction
        signal_df['value_normalized'] = zscore_to_0_100(signal_df['value_zscore'])
        
        return signal_df


def normalize_all_signals(
    df_signals: pd.DataFrame,
    config: Dict
) -> pd.DataFrame:
    """
    Normalize all signals according to configuration.
    
    Args:
        df_signals: DataFrame with all raw signals
        config: Configuration dict with signal directions and settings
        
    Returns:
        DataFrame with normalized signals
    """
    # Get normalization settings
    norm_config = config.get('normalization', {})
    winsorize_pct = (
        norm_config.get('winsorize', {}).get('p_low', 0.05),
        norm_config.get('winsorize', {}).get('p_high', 0.95)
    )
    use_robust = norm_config.get('z_score', {}).get('use_robust', True)
    
    # Get signal directions from all score blocks
    signal_directions = {}
    
    for block in ['contrarian', 'turnaround', 'piotroski', 'quality']:
        block_config = config.get(block, {})
        
        if 'signals' in block_config:
            for signal_name, signal_config in block_config['signals'].items():
                signal_directions[signal_name] = signal_config.get('direction', 1)
        
        if 'subblocks' in block_config:
            for subblock_name, subblock_config in block_config['subblocks'].items():
                for signal_name, signal_config in subblock_config.get('signals', {}).items():
                    signal_directions[signal_name] = signal_config.get('direction', 1)
    
    # Normalize each signal
    normalized_signals = []
    
    for signal_name in df_signals['signal_name'].unique():
        direction = signal_directions.get(signal_name, 1)
        
        normalized = normalize_signal(
            df_signals,
            signal_name,
            direction=direction,
            winsorize_pct=winsorize_pct,
            use_robust=use_robust
        )
        
        normalized_signals.append(normalized)
    
    if not normalized_signals:
        return pd.DataFrame()
    
    return pd.concat(normalized_signals, ignore_index=True)


def check_coverage(
    df_signals: pd.DataFrame,
    ticker: str,
    date: pd.Timestamp,
    required_signals: list,
    threshold: float = 0.7
) -> Tuple[bool, float]:
    """
    Check if a ticker/date has sufficient signal coverage.
    
    Args:
        df_signals: DataFrame with signals
        ticker: Ticker symbol
        date: Date to check
        required_signals: List of required signal names
        threshold: Minimum coverage ratio
        
    Returns:
        Tuple of (is_valid, coverage_ratio)
    """
    ticker_date_signals = df_signals[
        (df_signals['ticker'] == ticker) &
        (df_signals['date'] == date)
    ]
    
    available_signals = set(ticker_date_signals['signal_name'].unique())
    required_set = set(required_signals)
    
    coverage = len(available_signals & required_set) / len(required_set) if required_set else 0
    
    return coverage >= threshold, coverage
