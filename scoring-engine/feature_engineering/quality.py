"""
ARC Scoring Engine - Quality Signals
Measures structural business quality with 4 sub-blocks.
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional, List


# =============================================================================
# FINANCIAL QUALITY SIGNALS (Quantitative)
# =============================================================================

def signal_roic_level(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    ROIC level = NOPAT / Invested Capital
    NOPAT = Operating Income * (1 - tax_rate)
    Invested Capital = Total Equity + Total Debt - Cash
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    tax_rate = 0.25  # Assumed effective tax rate
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date_effective').reset_index(drop=True)
        
        for _, row in ticker_data.iterrows():
            operating_income = row.get('operating_income', 0) or 0
            total_equity = row.get('total_equity', 0) or 0
            total_debt = row.get('total_debt', 0) or 0
            cash = row.get('cash', 0) or 0
            
            nopat = operating_income * (1 - tax_rate)
            invested_capital = total_equity + total_debt - cash
            
            roic = nopat / invested_capital if invested_capital > 0 else np.nan
            
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'roic_level',
                    'value_raw': roic
                })
    
    return pd.DataFrame(results)


def signal_roic_stability(df_fundamentals: pd.DataFrame, lookback: int = 12) -> pd.DataFrame:
    """
    ROIC stability = 1 / std(ROIC) over lookback periods
    Higher = more stable
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        lookback: Number of periods for std calculation
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    # First compute ROIC for all periods
    roic_df = signal_roic_level(df_fundamentals)
    
    results = []
    
    for ticker in roic_df['ticker'].unique():
        ticker_data = roic_df[roic_df['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date').reset_index(drop=True)
        
        if len(ticker_data) < 4:
            continue
        
        ticker_data['roic_std'] = ticker_data['value_raw'].rolling(
            lookback, min_periods=4
        ).std()
        
        # Stability = 1 / std (with floor to avoid infinity)
        ticker_data['stability'] = 1 / ticker_data['roic_std'].clip(lower=0.01)
        
        for _, row in ticker_data.iterrows():
            results.append({
                'date': row['date'],
                'ticker': ticker,
                'signal_name': 'roic_stability',
                'value_raw': row['stability']
            })
    
    return pd.DataFrame(results)


def signal_fcf_margin(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    FCF Margin = Free Cash Flow / Revenue
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            fcf = row.get('free_cash_flow', 0) or 0
            revenue = row.get('revenue', 0) or 0
            
            fcf_margin = fcf / revenue if revenue > 0 else np.nan
            
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'fcf_margin',
                    'value_raw': fcf_margin
                })
    
    return pd.DataFrame(results)


def signal_fcf_conversion(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    FCF Conversion = Free Cash Flow / Net Income
    Measures quality of earnings
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            fcf = row.get('free_cash_flow', 0) or 0
            net_income = row.get('net_income', 0) or 0
            
            conversion = fcf / net_income if net_income > 0 else np.nan
            
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'fcf_conversion',
                    'value_raw': conversion
                })
    
    return pd.DataFrame(results)


def signal_net_leverage(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Net Leverage = (Total Debt - Cash) / EBITDA
    Lower is better (will be inverted in scoring)
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            total_debt = row.get('total_debt', 0) or 0
            cash = row.get('cash', 0) or 0
            ebitda = row.get('ebitda', 0) or 0
            
            net_debt = total_debt - cash
            leverage = net_debt / ebitda if ebitda > 0 else np.nan
            
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'net_leverage',
                    'value_raw': leverage
                })
    
    return pd.DataFrame(results)


def signal_interest_coverage(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Interest Coverage = EBIT / Interest Expense
    Higher is better
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            operating_income = row.get('operating_income', 0) or 0
            # Estimate interest expense from debt (if not available)
            total_debt = row.get('total_debt', 0) or 0
            interest_expense = total_debt * 0.05  # Assumed 5% interest rate
            
            coverage = operating_income / interest_expense if interest_expense > 0 else np.nan
            
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'interest_coverage',
                    'value_raw': coverage
                })
    
    return pd.DataFrame(results)


def signal_earnings_volatility(df_fundamentals: pd.DataFrame, lookback: int = 12) -> pd.DataFrame:
    """
    Earnings Volatility = std(Net Income) / mean(Net Income)
    Lower is better (will be inverted in scoring)
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        lookback: Number of periods for calculation
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date_effective').reset_index(drop=True)
        
        if len(ticker_data) < 4:
            continue
        
        ticker_data['ni_std'] = ticker_data['net_income'].rolling(lookback, min_periods=4).std()
        ticker_data['ni_mean'] = ticker_data['net_income'].rolling(lookback, min_periods=4).mean().abs()
        
        ticker_data['volatility'] = ticker_data['ni_std'] / ticker_data['ni_mean'].clip(lower=1)
        
        for _, row in ticker_data.iterrows():
            if pd.notna(row.get('date_effective')):
                results.append({
                    'date': row['date_effective'],
                    'ticker': ticker,
                    'signal_name': 'earnings_volatility',
                    'value_raw': row['volatility']
                })
    
    return pd.DataFrame(results)


# =============================================================================
# VALUATION SIGNALS (Quantitative)
# =============================================================================

def signal_ev_ebitda_zscore(
    df_fundamentals: pd.DataFrame,
    df_prices: pd.DataFrame
) -> pd.DataFrame:
    """
    EV/EBITDA z-score (cross-sectional)
    Lower is better (cheaper)
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        df_prices: DataFrame with price data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    # This would require market cap calculation from prices
    # Simplified implementation
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            ebitda = row.get('ebitda', 0) or 0
            total_debt = row.get('total_debt', 0) or 0
            cash = row.get('cash', 0) or 0
            shares = row.get('shares_outstanding', 0) or 0
            
            # Get price for this date
            date = row.get('date_effective')
            if pd.isna(date):
                continue
            
            ticker_prices = df_prices[
                (df_prices['ticker'] == ticker) & 
                (df_prices['date'] <= date)
            ]
            
            if ticker_prices.empty:
                continue
            
            price = ticker_prices.iloc[-1]['adj_close']
            market_cap = price * shares if shares > 0 else 0
            
            ev = market_cap + total_debt - cash
            ev_ebitda = ev / ebitda if ebitda > 0 else np.nan
            
            results.append({
                'date': date,
                'ticker': ticker,
                'signal_name': 'ev_ebitda_zscore',
                'value_raw': ev_ebitda
            })
    
    return pd.DataFrame(results)


def signal_fcf_yield(
    df_fundamentals: pd.DataFrame,
    df_prices: pd.DataFrame
) -> pd.DataFrame:
    """
    FCF Yield = Free Cash Flow / Market Cap
    Higher is better
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        df_prices: DataFrame with price data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        
        for _, row in ticker_data.iterrows():
            fcf = row.get('free_cash_flow', 0) or 0
            shares = row.get('shares_outstanding', 0) or 0
            
            date = row.get('date_effective')
            if pd.isna(date):
                continue
            
            ticker_prices = df_prices[
                (df_prices['ticker'] == ticker) & 
                (df_prices['date'] <= date)
            ]
            
            if ticker_prices.empty:
                continue
            
            price = ticker_prices.iloc[-1]['adj_close']
            market_cap = price * shares if shares > 0 else 0
            
            fcf_yield = fcf / market_cap if market_cap > 0 else np.nan
            
            results.append({
                'date': date,
                'ticker': ticker,
                'signal_name': 'fcf_yield',
                'value_raw': fcf_yield
            })
    
    return pd.DataFrame(results)


# =============================================================================
# QUALITATIVE SIGNALS (From IC Memo)
# =============================================================================

def load_qualitative_signals(df_ic_memos: pd.DataFrame) -> pd.DataFrame:
    """
    Load qualitative signals from IC Memos.
    These are human-assessed scores (1-5 scale).
    
    Expected columns in df_ic_memos:
    - ticker
    - date
    - moat, opportunity, value_creation_mechanism, sustainability
    - structural_vs_cyclical, why_now
    - management_quality, risks_qualitative, variant_perception
    
    Args:
        df_ic_memos: DataFrame with IC Memo qualitative assessments
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw]
    """
    qualitative_signals = [
        'moat', 'opportunity', 'value_creation_mechanism', 'sustainability',
        'structural_vs_cyclical', 'why_now', 'management_quality',
        'risks_qualitative', 'variant_perception'
    ]
    
    results = []
    
    for _, row in df_ic_memos.iterrows():
        ticker = row.get('ticker')
        date = row.get('date')
        
        for signal in qualitative_signals:
            value = row.get(signal)
            if pd.notna(value):
                results.append({
                    'date': date,
                    'ticker': ticker,
                    'signal_name': signal,
                    'value_raw': value
                })
    
    return pd.DataFrame(results)


# =============================================================================
# AGGREGATE FUNCTION
# =============================================================================

def compute_all_quality_signals(
    df_fundamentals: pd.DataFrame,
    df_prices: pd.DataFrame,
    df_ic_memos: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Compute all quality signals.
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        df_prices: DataFrame with price data
        df_ic_memos: Optional DataFrame with IC Memo qualitative assessments
        
    Returns:
        DataFrame with all quality signals
    """
    signals = []
    
    if not df_fundamentals.empty:
        # Financial quality signals
        signals.append(signal_roic_level(df_fundamentals))
        signals.append(signal_roic_stability(df_fundamentals))
        signals.append(signal_fcf_margin(df_fundamentals))
        signals.append(signal_fcf_conversion(df_fundamentals))
        signals.append(signal_net_leverage(df_fundamentals))
        signals.append(signal_interest_coverage(df_fundamentals))
        signals.append(signal_earnings_volatility(df_fundamentals))
        
        # Valuation signals
        if not df_prices.empty:
            signals.append(signal_ev_ebitda_zscore(df_fundamentals, df_prices))
            signals.append(signal_fcf_yield(df_fundamentals, df_prices))
    
    # Qualitative signals from IC Memos
    if df_ic_memos is not None and not df_ic_memos.empty:
        signals.append(load_qualitative_signals(df_ic_memos))
    
    if not signals:
        return pd.DataFrame(columns=['date', 'ticker', 'signal_name', 'value_raw'])
    
    return pd.concat(signals, ignore_index=True)
