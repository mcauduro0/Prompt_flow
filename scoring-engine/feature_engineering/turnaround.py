"""
ARC Scoring Engine - Turnaround Signals
Measures recent operational inflection, not structural quality.
"""

import pandas as pd
import numpy as np
from typing import Optional


def signal_seq_roe_improve(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Sequential ROE improvement (delta quarterly).
    roe_q = net_income_ttm / avg_equity_ttm
    delta_roe = roe_q - roe_q_minus_1
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date_effective').reset_index(drop=True)
        
        if len(ticker_data) < 2:
            continue
        
        # Calculate ROE
        ticker_data['avg_equity'] = (
            ticker_data['total_equity'] + ticker_data['total_equity'].shift(1)
        ) / 2
        
        ticker_data['roe'] = ticker_data['net_income'] / ticker_data['avg_equity'].replace(0, np.nan)
        
        # Delta ROE (sequential improvement)
        ticker_data['delta_roe'] = ticker_data['roe'] - ticker_data['roe'].shift(1)
        
        for _, row in ticker_data.iterrows():
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'seq_roe_improve',
                    'value_raw': row['delta_roe']
                })
    
    return pd.DataFrame(results)


def signal_seq_margin_improve(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Sequential operating margin improvement.
    margin = operating_income / revenue
    delta_margin = margin_q - margin_q_minus_1
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date_effective').reset_index(drop=True)
        
        if len(ticker_data) < 2:
            continue
        
        # Calculate operating margin
        ticker_data['op_margin'] = (
            ticker_data['operating_income'] / ticker_data['revenue'].replace(0, np.nan)
        )
        
        # Delta margin (sequential improvement)
        ticker_data['delta_margin'] = ticker_data['op_margin'] - ticker_data['op_margin'].shift(1)
        
        for _, row in ticker_data.iterrows():
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'seq_margin_improve',
                    'value_raw': row['delta_margin']
                })
    
    return pd.DataFrame(results)


def signal_earnings_surprise_norm(
    df_estimates: pd.DataFrame,
    min_history: int = 8
) -> pd.DataFrame:
    """
    Earnings surprise normalized by historical standard deviation.
    surprise = eps_actual - eps_consensus
    sigma_surprise = rolling std of surprises (8 quarters)
    value_raw = surprise / sigma_surprise
    
    Args:
        df_estimates: DataFrame with estimates data
        min_history: Minimum quarters for std calculation
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    if df_estimates.empty:
        return pd.DataFrame(columns=['date', 'ticker', 'signal_name', 'value_raw'])
    
    for ticker in df_estimates['ticker'].unique():
        ticker_data = df_estimates[df_estimates['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date').reset_index(drop=True)
        
        if len(ticker_data) < min_history:
            continue
        
        # Calculate surprise
        ticker_data['surprise'] = ticker_data['eps_actual'] - ticker_data['eps_consensus']
        
        # Rolling std of surprises (with floor to avoid division by zero)
        ticker_data['sigma_surprise'] = ticker_data['surprise'].rolling(
            min_history, min_periods=4
        ).std()
        ticker_data['sigma_surprise'] = ticker_data['sigma_surprise'].clip(lower=0.01)
        
        # Normalized surprise
        ticker_data['value_raw'] = ticker_data['surprise'] / ticker_data['sigma_surprise']
        
        for _, row in ticker_data.iterrows():
            results.append({
                'date': row['date'],
                'ticker': ticker,
                'signal_name': 'earnings_surprise_norm',
                'value_raw': row['value_raw']
            })
    
    return pd.DataFrame(results)


def signal_mom1m(df_prices: pd.DataFrame) -> pd.DataFrame:
    """
    1-month momentum (direct).
    ret_1m = (close / close_21d) - 1
    
    Args:
        df_prices: DataFrame with price data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_prices['ticker'].unique():
        ticker_data = df_prices[df_prices['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date').reset_index(drop=True)
        
        if len(ticker_data) < 21:
            continue
        
        # 1-month return
        ticker_data['close_21d'] = ticker_data['adj_close'].shift(21)
        ticker_data['ret_1m'] = (ticker_data['adj_close'] / ticker_data['close_21d']) - 1
        
        for _, row in ticker_data.iterrows():
            results.append({
                'date': row['date'],
                'ticker': ticker,
                'signal_name': 'mom1m',
                'value_raw': row['ret_1m']
            })
    
    return pd.DataFrame(results)


def compute_all_turnaround_signals(
    df_prices: pd.DataFrame,
    df_fundamentals: pd.DataFrame,
    df_estimates: pd.DataFrame
) -> pd.DataFrame:
    """
    Compute all turnaround signals.
    
    Args:
        df_prices: DataFrame with price data
        df_fundamentals: DataFrame with fundamental data
        df_estimates: DataFrame with estimates data
        
    Returns:
        DataFrame with all turnaround signals
    """
    signals = []
    
    # Sequential ROE improvement
    if not df_fundamentals.empty:
        roe_signals = signal_seq_roe_improve(df_fundamentals)
        signals.append(roe_signals)
        
        # Sequential margin improvement
        margin_signals = signal_seq_margin_improve(df_fundamentals)
        signals.append(margin_signals)
    
    # Earnings surprise normalized
    if not df_estimates.empty:
        surprise_signals = signal_earnings_surprise_norm(df_estimates)
        signals.append(surprise_signals)
    
    # 1-month momentum
    mom_signals = signal_mom1m(df_prices)
    signals.append(mom_signals)
    
    if not signals:
        return pd.DataFrame(columns=['date', 'ticker', 'signal_name', 'value_raw'])
    
    return pd.concat(signals, ignore_index=True)
