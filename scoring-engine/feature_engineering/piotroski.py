"""
ARC Scoring Engine - Piotroski F-Score
Measures fundamental health with 9 binary criteria.
"""

import pandas as pd
import numpy as np
from typing import Dict, Optional


def compute_piotroski_components(row: Dict, prev_row: Optional[Dict] = None) -> Dict[str, int]:
    """
    Compute all 9 Piotroski F-Score components.
    
    Components:
    1. ROA > 0 (positive net income / total assets)
    2. Operating Cash Flow > 0
    3. Delta ROA > 0 (ROA improving)
    4. Accrual < 0 (CFO > Net Income)
    5. Delta Leverage < 0 (debt/assets decreasing)
    6. Delta Liquidity > 0 (current ratio improving)
    7. No equity dilution (shares not increasing)
    8. Delta Margin > 0 (gross margin improving)
    9. Delta Turnover > 0 (asset turnover improving)
    
    Args:
        row: Current period fundamental data
        prev_row: Previous period fundamental data
        
    Returns:
        Dict with component scores (0 or 1)
    """
    components = {}
    
    # Safe getters
    def safe_get(d, key, default=0):
        if d is None:
            return default
        val = d.get(key)
        return val if pd.notna(val) else default
    
    # Current period values
    net_income = safe_get(row, 'net_income')
    total_assets = safe_get(row, 'total_assets', 1)
    operating_cf = safe_get(row, 'operating_cash_flow')
    total_debt = safe_get(row, 'total_debt')
    current_assets = safe_get(row, 'current_assets')
    current_liabilities = safe_get(row, 'current_liabilities', 1)
    shares = safe_get(row, 'shares_outstanding')
    gross_profit = safe_get(row, 'gross_profit')
    revenue = safe_get(row, 'revenue', 1)
    
    # Previous period values
    prev_net_income = safe_get(prev_row, 'net_income')
    prev_total_assets = safe_get(prev_row, 'total_assets', 1)
    prev_total_debt = safe_get(prev_row, 'total_debt')
    prev_current_assets = safe_get(prev_row, 'current_assets')
    prev_current_liabilities = safe_get(prev_row, 'current_liabilities', 1)
    prev_shares = safe_get(prev_row, 'shares_outstanding')
    prev_gross_profit = safe_get(prev_row, 'gross_profit')
    prev_revenue = safe_get(prev_row, 'revenue', 1)
    
    # Calculate ratios
    roa = net_income / total_assets if total_assets != 0 else 0
    prev_roa = prev_net_income / prev_total_assets if prev_total_assets != 0 else 0
    
    leverage = total_debt / total_assets if total_assets != 0 else 0
    prev_leverage = prev_total_debt / prev_total_assets if prev_total_assets != 0 else 0
    
    current_ratio = current_assets / current_liabilities if current_liabilities != 0 else 0
    prev_current_ratio = prev_current_assets / prev_current_liabilities if prev_current_liabilities != 0 else 0
    
    gross_margin = gross_profit / revenue if revenue != 0 else 0
    prev_gross_margin = prev_gross_profit / prev_revenue if prev_revenue != 0 else 0
    
    asset_turnover = revenue / total_assets if total_assets != 0 else 0
    prev_asset_turnover = prev_revenue / prev_total_assets if prev_total_assets != 0 else 0
    
    # 1. Profitability: ROA > 0
    components['roa_positive'] = 1 if roa > 0 else 0
    
    # 2. Profitability: Operating Cash Flow > 0
    components['cfo_positive'] = 1 if operating_cf > 0 else 0
    
    # 3. Profitability: Delta ROA > 0
    components['delta_roa_positive'] = 1 if roa > prev_roa else 0
    
    # 4. Profitability: Accrual (CFO > Net Income)
    components['accrual_quality'] = 1 if operating_cf > net_income else 0
    
    # 5. Leverage: Delta Leverage < 0 (decreasing debt)
    components['delta_leverage_negative'] = 1 if leverage < prev_leverage else 0
    
    # 6. Liquidity: Delta Current Ratio > 0
    components['delta_liquidity_positive'] = 1 if current_ratio > prev_current_ratio else 0
    
    # 7. Equity: No dilution (shares not increasing)
    components['no_dilution'] = 1 if shares <= prev_shares or prev_shares == 0 else 0
    
    # 8. Margin: Delta Gross Margin > 0
    components['delta_margin_positive'] = 1 if gross_margin > prev_gross_margin else 0
    
    # 9. Turnover: Delta Asset Turnover > 0
    components['delta_turnover_positive'] = 1 if asset_turnover > prev_asset_turnover else 0
    
    return components


def signal_piotroski_raw(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Compute Piotroski F-Score (0-9) for each ticker/date.
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with columns [date, ticker, signal_name, value_raw, components]
    """
    results = []
    
    for ticker in df_fundamentals['ticker'].unique():
        ticker_data = df_fundamentals[df_fundamentals['ticker'] == ticker].copy()
        ticker_data = ticker_data.sort_values('date_effective').reset_index(drop=True)
        
        if len(ticker_data) < 2:
            continue
        
        for i in range(1, len(ticker_data)):
            row = ticker_data.iloc[i].to_dict()
            prev_row = ticker_data.iloc[i-1].to_dict()
            
            components = compute_piotroski_components(row, prev_row)
            f_score = sum(components.values())
            
            results.append({
                'date': row['date_effective'],
                'ticker': ticker,
                'signal_name': 'piotroski_raw',
                'value_raw': f_score,
                'components': components
            })
    
    return pd.DataFrame(results)


def compute_all_piotroski_signals(df_fundamentals: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all Piotroski signals.
    
    Args:
        df_fundamentals: DataFrame with fundamental data
        
    Returns:
        DataFrame with Piotroski signals
    """
    if df_fundamentals.empty:
        return pd.DataFrame(columns=['date', 'ticker', 'signal_name', 'value_raw'])
    
    return signal_piotroski_raw(df_fundamentals)


def interpret_piotroski(score: int) -> str:
    """
    Interpret Piotroski F-Score.
    
    Args:
        score: F-Score (0-9)
        
    Returns:
        Interpretation string
    """
    if score >= 8:
        return "Excellent"
    elif score >= 6:
        return "Strong"
    elif score >= 4:
        return "Moderate"
    elif score >= 2:
        return "Weak"
    else:
        return "Poor"
