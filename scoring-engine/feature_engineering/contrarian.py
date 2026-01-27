"""
ARC Scoring Engine - Contrarian Signals
Captures price stress signals, not fundamental thesis.
"""

import pandas as pd
import numpy as np
from typing import Optional


def compute_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """
    Compute Relative Strength Index.
    
    Args:
        prices: Series of adjusted close prices
        period: RSI period (default 14)
        
    Returns:
        Series of RSI values (0-100)
    """
    delta = prices.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    
    # Avoid division by zero
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    
    return rsi


def signal_rsi14_invert(df_prices: pd.DataFrame) -> pd.DataFrame:
    """
    RSI 14-period inverted: 100 - RSI
    Higher value = more oversold (contrarian opportunity)
    
    Args:
        df_prices: DataFrame with columns [date, ticker, adj_close]
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_prices['ticker'].unique():
        ticker_data = df_prices[df_prices['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date')
        
        rsi = compute_rsi(ticker_data['adj_close'], period=14)
        rsi_invert = 100 - rsi
        
        for idx, row in ticker_data.iterrows():
            date = row['date']
            value = rsi_invert.loc[idx] if idx in rsi_invert.index else np.nan
            
            results.append({
                'date': date,
                'ticker': ticker,
                'signal_name': 'rsi14_invert',
                'value_raw': value
            })
    
    return pd.DataFrame(results)


def signal_mom12m_invert(df_prices: pd.DataFrame) -> pd.DataFrame:
    """
    12-month momentum excluding last month, inverted.
    ret_12m_ex1m = (price_t-21 / price_t-252) - 1
    value_raw = -ret_12m_ex1m
    
    Higher value = more contrarian (price has fallen)
    
    Args:
        df_prices: DataFrame with columns [date, ticker, adj_close]
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_prices['ticker'].unique():
        ticker_data = df_prices[df_prices['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date').reset_index(drop=True)
        
        if len(ticker_data) < 252:
            continue
        
        # Calculate 12-month return excluding last month
        # price_t-21 / price_t-252 - 1
        ticker_data['price_t_minus_21'] = ticker_data['adj_close'].shift(21)
        ticker_data['price_t_minus_252'] = ticker_data['adj_close'].shift(252)
        
        ticker_data['ret_12m_ex1m'] = (
            ticker_data['price_t_minus_21'] / ticker_data['price_t_minus_252']
        ) - 1
        
        ticker_data['value_raw'] = -ticker_data['ret_12m_ex1m']
        
        for _, row in ticker_data.iterrows():
            results.append({
                'date': row['date'],
                'ticker': ticker,
                'signal_name': 'mom12m_invert',
                'value_raw': row['value_raw']
            })
    
    return pd.DataFrame(results)


def signal_dist_52wlow_invert(df_prices: pd.DataFrame) -> pd.DataFrame:
    """
    Distance to 52-week low, inverted.
    dist = (close / low_252) - 1
    value_raw = -dist
    
    Higher value = closer to 52-week low (contrarian opportunity)
    
    Args:
        df_prices: DataFrame with columns [date, ticker, adj_close, low]
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_prices['ticker'].unique():
        ticker_data = df_prices[df_prices['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date').reset_index(drop=True)
        
        if len(ticker_data) < 252:
            continue
        
        # 52-week low
        ticker_data['low_252'] = ticker_data['low'].rolling(252, min_periods=20).min()
        
        # Distance to 52-week low
        ticker_data['dist'] = (ticker_data['adj_close'] / ticker_data['low_252']) - 1
        
        # Invert: closer to low = higher value
        ticker_data['value_raw'] = -ticker_data['dist']
        
        for _, row in ticker_data.iterrows():
            results.append({
                'date': row['date'],
                'ticker': ticker,
                'signal_name': 'dist_52wlow_invert',
                'value_raw': row['value_raw']
            })
    
    return pd.DataFrame(results)


def compute_all_contrarian_signals(df_prices: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all contrarian signals.
    
    Args:
        df_prices: DataFrame with price data
        
    Returns:
        DataFrame with all contrarian signals
    """
    signals = []
    
    # RSI14 inverted
    rsi_signals = signal_rsi14_invert(df_prices)
    signals.append(rsi_signals)
    
    # 12-month momentum inverted
    mom12m_signals = signal_mom12m_invert(df_prices)
    signals.append(mom12m_signals)
    
    # Distance to 52-week low inverted
    dist_signals = signal_dist_52wlow_invert(df_prices)
    signals.append(dist_signals)
    
    return pd.concat(signals, ignore_index=True)
