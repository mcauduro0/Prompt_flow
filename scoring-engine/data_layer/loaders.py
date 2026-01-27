"""
ARC Scoring Engine - Data Layer
Handles loading of prices, fundamentals, estimates, and risk inputs.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import os
import requests
from polygon import RESTClient

# Initialize Polygon client
POLYGON_API_KEY = os.environ.get('POLYGON_API_KEY')


class DataLoader:
    """
    Main data loader class for the scoring engine.
    Handles all data ingestion with proper date alignment and lookahead prevention.
    """
    
    def __init__(self, polygon_api_key: str = None):
        self.polygon_api_key = polygon_api_key or POLYGON_API_KEY
        if self.polygon_api_key:
            self.polygon_client = RESTClient(api_key=self.polygon_api_key)
        else:
            self.polygon_client = None
    
    def load_prices(
        self,
        tickers: List[str],
        start: str,
        end: str,
        adjusted: bool = True
    ) -> pd.DataFrame:
        """
        Load daily price data for given tickers.
        
        Args:
            tickers: List of ticker symbols
            start: Start date (YYYY-MM-DD)
            end: End date (YYYY-MM-DD)
            adjusted: Whether to use adjusted close prices
            
        Returns:
            DataFrame with columns: date, ticker, open, high, low, close, volume, adj_close
        """
        all_data = []
        
        for ticker in tickers:
            try:
                if self.polygon_client:
                    aggs = self.polygon_client.get_aggs(
                        ticker=ticker,
                        multiplier=1,
                        timespan="day",
                        from_=start,
                        to=end,
                        adjusted=adjusted,
                        limit=50000
                    )
                    
                    for agg in aggs:
                        all_data.append({
                            'date': pd.Timestamp(agg.timestamp, unit='ms').date(),
                            'ticker': ticker,
                            'open': agg.open,
                            'high': agg.high,
                            'low': agg.low,
                            'close': agg.close,
                            'volume': agg.volume,
                            'adj_close': agg.close if adjusted else None,
                            'vwap': agg.vwap if hasattr(agg, 'vwap') else None
                        })
            except Exception as e:
                print(f"Error loading prices for {ticker}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame(columns=['date', 'ticker', 'open', 'high', 'low', 'close', 'volume', 'adj_close'])
        
        df = pd.DataFrame(all_data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(['ticker', 'date']).reset_index(drop=True)
        
        return df
    
    def load_fundamentals(
        self,
        tickers: List[str],
        start: str,
        end: str
    ) -> pd.DataFrame:
        """
        Load fundamental data for given tickers.
        Uses date_effective to prevent lookahead bias.
        
        Args:
            tickers: List of ticker symbols
            start: Start date (YYYY-MM-DD)
            end: End date (YYYY-MM-DD)
            
        Returns:
            DataFrame with fundamental metrics and date_effective
        """
        all_data = []
        
        for ticker in tickers:
            try:
                if self.polygon_client:
                    # Get financial data from Polygon
                    financials = self.polygon_client.vx.list_stock_financials(
                        ticker=ticker,
                        limit=100,
                        filing_date_gte=start,
                        filing_date_lte=end
                    )
                    
                    for fin in financials:
                        # Use filing_date as date_effective (when market knew the data)
                        date_effective = fin.filing_date if hasattr(fin, 'filing_date') else fin.end_date
                        
                        # Extract key metrics
                        income = fin.financials.income_statement if hasattr(fin.financials, 'income_statement') else {}
                        balance = fin.financials.balance_sheet if hasattr(fin.financials, 'balance_sheet') else {}
                        cashflow = fin.financials.cash_flow_statement if hasattr(fin.financials, 'cash_flow_statement') else {}
                        
                        all_data.append({
                            'date_report': fin.end_date,
                            'date_effective': date_effective,
                            'ticker': ticker,
                            'fiscal_period': fin.fiscal_period,
                            'fiscal_year': fin.fiscal_year,
                            # Income Statement
                            'revenue': self._get_value(income, 'revenues'),
                            'gross_profit': self._get_value(income, 'gross_profit'),
                            'operating_income': self._get_value(income, 'operating_income_loss'),
                            'net_income': self._get_value(income, 'net_income_loss'),
                            'ebitda': self._get_value(income, 'ebitda'),
                            # Balance Sheet
                            'total_assets': self._get_value(balance, 'assets'),
                            'total_liabilities': self._get_value(balance, 'liabilities'),
                            'total_equity': self._get_value(balance, 'equity'),
                            'cash': self._get_value(balance, 'cash'),
                            'total_debt': self._get_value(balance, 'debt'),
                            'current_assets': self._get_value(balance, 'current_assets'),
                            'current_liabilities': self._get_value(balance, 'current_liabilities'),
                            'shares_outstanding': self._get_value(balance, 'shares_outstanding'),
                            # Cash Flow
                            'operating_cash_flow': self._get_value(cashflow, 'net_cash_flow_from_operating_activities'),
                            'capex': self._get_value(cashflow, 'capital_expenditure'),
                            'free_cash_flow': self._get_value(cashflow, 'free_cash_flow'),
                        })
            except Exception as e:
                print(f"Error loading fundamentals for {ticker}: {e}")
                continue
        
        if not all_data:
            return pd.DataFrame()
        
        df = pd.DataFrame(all_data)
        df['date_report'] = pd.to_datetime(df['date_report'])
        df['date_effective'] = pd.to_datetime(df['date_effective'])
        df = df.sort_values(['ticker', 'date_effective']).reset_index(drop=True)
        
        return df
    
    def load_estimates(
        self,
        tickers: List[str],
        start: str,
        end: str
    ) -> pd.DataFrame:
        """
        Load analyst estimates and actuals for earnings surprise calculation.
        
        Args:
            tickers: List of ticker symbols
            start: Start date (YYYY-MM-DD)
            end: End date (YYYY-MM-DD)
            
        Returns:
            DataFrame with columns: date, ticker, eps_consensus, eps_actual, surprise
        """
        # Note: Polygon doesn't have estimates data directly
        # This would need to be sourced from another provider (e.g., FMP, Alpha Vantage)
        # For now, return empty DataFrame with correct schema
        return pd.DataFrame(columns=['date', 'ticker', 'eps_consensus', 'eps_actual', 'surprise'])
    
    def load_metadata(
        self,
        tickers: List[str]
    ) -> pd.DataFrame:
        """
        Load ticker metadata (sector, industry, exchange, etc.)
        
        Args:
            tickers: List of ticker symbols
            
        Returns:
            DataFrame with columns: ticker, sector, industry, currency, exchange, country
        """
        all_data = []
        
        for ticker in tickers:
            try:
                if self.polygon_client:
                    details = self.polygon_client.get_ticker_details(ticker)
                    
                    all_data.append({
                        'ticker': ticker,
                        'name': details.name if hasattr(details, 'name') else None,
                        'sector': details.sic_description if hasattr(details, 'sic_description') else None,
                        'industry': details.sic_description if hasattr(details, 'sic_description') else None,
                        'currency': details.currency_name if hasattr(details, 'currency_name') else 'USD',
                        'exchange': details.primary_exchange if hasattr(details, 'primary_exchange') else None,
                        'country': details.locale if hasattr(details, 'locale') else 'US',
                        'market_cap': details.market_cap if hasattr(details, 'market_cap') else None,
                        'shares_outstanding': details.share_class_shares_outstanding if hasattr(details, 'share_class_shares_outstanding') else None
                    })
            except Exception as e:
                print(f"Error loading metadata for {ticker}: {e}")
                all_data.append({
                    'ticker': ticker,
                    'name': None,
                    'sector': None,
                    'industry': None,
                    'currency': 'USD',
                    'exchange': None,
                    'country': 'US',
                    'market_cap': None,
                    'shares_outstanding': None
                })
        
        return pd.DataFrame(all_data)
    
    def load_risk_inputs(
        self,
        tickers: List[str],
        start: str,
        end: str
    ) -> pd.DataFrame:
        """
        Load risk-related inputs (ADV, volatility, beta, etc.)
        
        Args:
            tickers: List of ticker symbols
            start: Start date (YYYY-MM-DD)
            end: End date (YYYY-MM-DD)
            
        Returns:
            DataFrame with risk metrics
        """
        # Load prices first
        prices = self.load_prices(tickers, start, end)
        
        if prices.empty:
            return pd.DataFrame()
        
        # Calculate risk metrics per ticker
        risk_data = []
        
        for ticker in tickers:
            ticker_prices = prices[prices['ticker'] == ticker].copy()
            
            if len(ticker_prices) < 20:
                continue
            
            ticker_prices = ticker_prices.sort_values('date')
            
            # Calculate returns
            ticker_prices['returns'] = ticker_prices['adj_close'].pct_change()
            
            # Rolling metrics
            ticker_prices['adv_20d'] = ticker_prices['volume'].rolling(20).mean()
            ticker_prices['vol_20d'] = ticker_prices['returns'].rolling(20).std() * np.sqrt(252)
            
            # 52-week high/low
            ticker_prices['high_52w'] = ticker_prices['high'].rolling(252, min_periods=20).max()
            ticker_prices['low_52w'] = ticker_prices['low'].rolling(252, min_periods=20).min()
            
            # Max drawdown (1 year)
            ticker_prices['cummax'] = ticker_prices['adj_close'].cummax()
            ticker_prices['drawdown'] = (ticker_prices['adj_close'] - ticker_prices['cummax']) / ticker_prices['cummax']
            ticker_prices['max_drawdown_1y'] = ticker_prices['drawdown'].rolling(252, min_periods=20).min()
            
            for _, row in ticker_prices.iterrows():
                risk_data.append({
                    'date': row['date'],
                    'ticker': ticker,
                    'adv_20d': row['adv_20d'],
                    'vol_20d': row['vol_20d'],
                    'high_52w': row['high_52w'],
                    'low_52w': row['low_52w'],
                    'max_drawdown_1y': row['max_drawdown_1y']
                })
        
        return pd.DataFrame(risk_data)
    
    def _get_value(self, obj: Any, key: str) -> Optional[float]:
        """Helper to safely extract values from nested objects."""
        if isinstance(obj, dict):
            item = obj.get(key)
            if item and hasattr(item, 'value'):
                return item.value
            return item
        elif hasattr(obj, key):
            item = getattr(obj, key)
            if item and hasattr(item, 'value'):
                return item.value
            return item
        return None


def forward_fill_fundamentals(
    fundamentals: pd.DataFrame,
    dates: pd.DatetimeIndex,
    tickers: List[str]
) -> pd.DataFrame:
    """
    Forward fill fundamental data to create daily series.
    Uses date_effective to prevent lookahead bias.
    
    Args:
        fundamentals: DataFrame with fundamental data
        dates: DatetimeIndex of all dates to fill
        tickers: List of tickers
        
    Returns:
        DataFrame with daily fundamental data (forward filled)
    """
    if fundamentals.empty:
        return pd.DataFrame()
    
    # Create full date x ticker grid
    grid = pd.MultiIndex.from_product([dates, tickers], names=['date', 'ticker'])
    result = pd.DataFrame(index=grid).reset_index()
    
    # Merge and forward fill
    fundamentals = fundamentals.sort_values(['ticker', 'date_effective'])
    
    # For each ticker, forward fill from date_effective
    filled_data = []
    
    for ticker in tickers:
        ticker_fund = fundamentals[fundamentals['ticker'] == ticker].copy()
        ticker_dates = result[result['ticker'] == ticker][['date']].copy()
        
        if ticker_fund.empty:
            continue
        
        # Merge on date_effective <= date
        ticker_fund = ticker_fund.rename(columns={'date_effective': 'date'})
        merged = pd.merge_asof(
            ticker_dates.sort_values('date'),
            ticker_fund.sort_values('date'),
            on='date',
            direction='backward'
        )
        merged['ticker'] = ticker
        filled_data.append(merged)
    
    if not filled_data:
        return pd.DataFrame()
    
    return pd.concat(filled_data, ignore_index=True)


# =============================================================================
# STANDALONE WRAPPER FUNCTIONS
# =============================================================================

# Global loader instance
_loader = None

def _get_loader() -> DataLoader:
    """Get or create global DataLoader instance."""
    global _loader
    if _loader is None:
        _loader = DataLoader()
    return _loader


def load_prices(
    tickers: List[str],
    start: str,
    end: str,
    adjusted: bool = True
) -> pd.DataFrame:
    """
    Load daily price data for given tickers.
    Wrapper for DataLoader.load_prices().
    """
    return _get_loader().load_prices(tickers, start, end, adjusted)


def load_fundamentals(
    tickers: List[str],
    start: str,
    end: str
) -> pd.DataFrame:
    """
    Load fundamental data for given tickers.
    Wrapper for DataLoader.load_fundamentals().
    """
    return _get_loader().load_fundamentals(tickers, start, end)


def load_estimates(
    tickers: List[str]
) -> pd.DataFrame:
    """
    Load analyst estimates for given tickers.
    Wrapper for DataLoader.load_estimates().
    """
    return _get_loader().load_estimates(tickers)


def load_ic_memos(
    tickers: Optional[List[str]] = None
) -> pd.DataFrame:
    """
    Load IC Memo data from ARC database.
    Wrapper for DataLoader.load_ic_memos().
    """
    return _get_loader().load_ic_memos(tickers)
