#!/usr/bin/env python3
"""
Test all data providers: Polygon, FMP, FRED, Reddit, Fiscal AI
"""

import os
import json
import requests
from datetime import datetime, timedelta

# Load env
env_path = "/home/ubuntu/Prompt_flow/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                if value and not value.startswith('$'):
                    os.environ[key] = value

print("=" * 70)
print("TESTING ALL DATA PROVIDERS - REAL MARKET DATA")
print("=" * 70)

TEST_TICKER = "AAPL"
results = {}

# ============================================================================
# 1. POLYGON.IO - Real-time prices, historical data, news
# ============================================================================
print("\n" + "─" * 70)
print("1. POLYGON.IO")
print("─" * 70)

polygon_key = os.environ.get('POLYGON_API_KEY')
if polygon_key:
    try:
        # Test 1: Get last trade
        url = f"https://api.polygon.io/v2/last/trade/{TEST_TICKER}?apiKey={polygon_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'results' in data:
            price = data['results'].get('p', 'N/A')
            print(f"  ✅ Last Trade: ${price}")
            results['polygon_price'] = True
        else:
            print(f"  ⚠️ Last Trade: {data.get('message', 'No data')}")
            results['polygon_price'] = False
        
        # Test 2: Get news
        url = f"https://api.polygon.io/v2/reference/news?ticker={TEST_TICKER}&limit=3&apiKey={polygon_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'results' in data and len(data['results']) > 0:
            print(f"  ✅ News: {len(data['results'])} articles found")
            print(f"     Latest: {data['results'][0].get('title', 'N/A')[:60]}...")
            results['polygon_news'] = True
        else:
            print(f"  ⚠️ News: No articles found")
            results['polygon_news'] = False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:60]}")
        results['polygon_price'] = False
        results['polygon_news'] = False
else:
    print("  ❌ POLYGON_API_KEY not set")
    results['polygon_price'] = False
    results['polygon_news'] = False

# ============================================================================
# 2. FMP (Financial Modeling Prep) - Fundamentals, Financials
# ============================================================================
print("\n" + "─" * 70)
print("2. FMP (Financial Modeling Prep)")
print("─" * 70)

fmp_key = os.environ.get('FMP_API_KEY')
if fmp_key:
    try:
        # Test 1: Company profile
        url = f"https://financialmodelingprep.com/api/v3/profile/{TEST_TICKER}?apikey={fmp_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data and len(data) > 0:
            company = data[0]
            print(f"  ✅ Profile: {company.get('companyName', 'N/A')}")
            print(f"     Market Cap: ${company.get('mktCap', 0)/1e9:.1f}B")
            print(f"     Sector: {company.get('sector', 'N/A')}")
            results['fmp_profile'] = True
        else:
            print(f"  ⚠️ Profile: No data")
            results['fmp_profile'] = False
        
        # Test 2: Financial ratios
        url = f"https://financialmodelingprep.com/api/v3/ratios/{TEST_TICKER}?limit=1&apikey={fmp_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data and len(data) > 0:
            ratios = data[0]
            print(f"  ✅ Ratios: P/E={ratios.get('priceEarningsRatio', 'N/A'):.1f}, ROE={ratios.get('returnOnEquity', 0)*100:.1f}%")
            results['fmp_ratios'] = True
        else:
            print(f"  ⚠️ Ratios: No data")
            results['fmp_ratios'] = False
            
        # Test 3: Stock screener
        url = f"https://financialmodelingprep.com/api/v3/stock-screener?marketCapMoreThan=1000000000&marketCapLowerThan=50000000000&limit=5&apikey={fmp_key}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data and len(data) > 0:
            print(f"  ✅ Screener: {len(data)} mid-cap stocks found")
            results['fmp_screener'] = True
        else:
            print(f"  ⚠️ Screener: No data")
            results['fmp_screener'] = False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:60]}")
        results['fmp_profile'] = False
        results['fmp_ratios'] = False
        results['fmp_screener'] = False
else:
    print("  ❌ FMP_API_KEY not set")
    results['fmp_profile'] = False
    results['fmp_ratios'] = False
    results['fmp_screener'] = False

# ============================================================================
# 3. FRED (Federal Reserve Economic Data) - Macro indicators
# ============================================================================
print("\n" + "─" * 70)
print("3. FRED (Federal Reserve Economic Data)")
print("─" * 70)

fred_key = os.environ.get('FRED_API_KEY')
if fred_key:
    try:
        # Test: Get GDP data
        url = f"https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key={fred_key}&file_type=json&limit=1&sort_order=desc"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if 'observations' in data and len(data['observations']) > 0:
            obs = data['observations'][0]
            print(f"  ✅ GDP: ${float(obs['value'])/1000:.1f}T ({obs['date']})")
            results['fred'] = True
        else:
            print(f"  ⚠️ GDP: No data")
            results['fred'] = False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:60]}")
        results['fred'] = False
else:
    print("  ⚠️ FRED_API_KEY not set (free key available at fred.stlouisfed.org)")
    print("     Using public endpoints without key...")
    
    try:
        # FRED allows some public access
        url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            if len(lines) > 1:
                latest = lines[-1].split(',')
                print(f"  ✅ 10Y Treasury: {latest[1]}% ({latest[0]})")
                results['fred'] = True
        else:
            results['fred'] = False
    except:
        results['fred'] = False

# ============================================================================
# 4. REDDIT - Social sentiment (public API)
# ============================================================================
print("\n" + "─" * 70)
print("4. REDDIT (Social Sentiment)")
print("─" * 70)

try:
    # Use public Reddit JSON API
    headers = {'User-Agent': 'ARC Investment Factory/1.0'}
    url = f"https://www.reddit.com/r/wallstreetbets/search.json?q={TEST_TICKER}&sort=new&limit=5&restrict_sr=1"
    response = requests.get(url, headers=headers, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        posts = data.get('data', {}).get('children', [])
        
        if posts:
            print(f"  ✅ r/wallstreetbets: {len(posts)} posts about {TEST_TICKER}")
            if posts[0]['data'].get('title'):
                print(f"     Latest: {posts[0]['data']['title'][:60]}...")
            results['reddit'] = True
        else:
            print(f"  ⚠️ No posts found for {TEST_TICKER}")
            results['reddit'] = False
    else:
        print(f"  ⚠️ Reddit API returned {response.status_code}")
        results['reddit'] = False
        
except Exception as e:
    print(f"  ❌ Error: {str(e)[:60]}")
    results['reddit'] = False

# ============================================================================
# 5. FISCAL AI - Alternative fundamental data
# ============================================================================
print("\n" + "─" * 70)
print("5. FISCAL AI")
print("─" * 70)

fiscal_key = os.environ.get('FISCAL_AI_API_KEY')
if fiscal_key:
    try:
        # Test API access
        headers = {'Authorization': f'Bearer {fiscal_key}'}
        url = f"https://api.fiscal.ai/v1/companies/{TEST_TICKER}"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Fiscal AI: Connected")
            results['fiscal_ai'] = True
        elif response.status_code == 403:
            print(f"  ⚠️ Fiscal AI: Free trial - limited companies available")
            results['fiscal_ai'] = 'limited'
        else:
            print(f"  ⚠️ Fiscal AI: {response.status_code}")
            results['fiscal_ai'] = False
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:60]}")
        results['fiscal_ai'] = False
else:
    print("  ❌ FISCAL_AI_API_KEY not set")
    results['fiscal_ai'] = False

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("DATA PROVIDER SUMMARY")
print("=" * 70)

providers = [
    ("Polygon.io (Prices)", results.get('polygon_price', False)),
    ("Polygon.io (News)", results.get('polygon_news', False)),
    ("FMP (Profile)", results.get('fmp_profile', False)),
    ("FMP (Ratios)", results.get('fmp_ratios', False)),
    ("FMP (Screener)", results.get('fmp_screener', False)),
    ("FRED (Macro)", results.get('fred', False)),
    ("Reddit (Social)", results.get('reddit', False)),
    ("Fiscal AI", results.get('fiscal_ai', False)),
]

working = sum(1 for _, status in providers if status == True)
limited = sum(1 for _, status in providers if status == 'limited')
total = len(providers)

print(f"\n  Working: {working}/{total}")
print(f"  Limited: {limited}/{total}")
print(f"  Failed:  {total - working - limited}/{total}")

print("\n  Provider Status:")
for name, status in providers:
    if status == True:
        print(f"    ✅ {name}")
    elif status == 'limited':
        print(f"    ⚠️ {name} (limited)")
    else:
        print(f"    ❌ {name}")

print("\n" + "=" * 70)
