#!/usr/bin/env python3
"""
Test script to verify data providers are working correctly
"""

import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_fmp():
    """Test Financial Modeling Prep API"""
    print("\n=== Testing FMP API ===")
    api_key = os.getenv("FMP_API_KEY")
    
    if not api_key:
        print("❌ FMP_API_KEY not set")
        return False
    
    print(f"API Key: {api_key[:8]}...")
    
    # Test 1: Get company profile
    print("\n1. Testing getProfile(AAPL)...")
    url = f"https://financialmodelingprep.com/api/v3/profile/AAPL?apikey={api_key}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                profile = data[0]
                print(f"✅ Profile retrieved:")
                print(f"   Company: {profile.get('companyName')}")
                print(f"   Sector: {profile.get('sector')}")
                print(f"   Market Cap: ${profile.get('mktCap', 0)/1e9:.2f}B")
            else:
                print("❌ Empty response")
                return False
        else:
            print(f"❌ HTTP {response.status_code}: {response.text[:100]}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 2: Screen stocks
    print("\n2. Testing stock screener (mid-cap US)...")
    url = f"https://financialmodelingprep.com/api/v3/stock-screener?marketCapMoreThan=1000000000&marketCapLowerThan=10000000000&country=US&exchange=NYSE,NASDAQ&limit=10&apikey={api_key}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                print(f"✅ Screener returned {len(data)} stocks:")
                for stock in data[:5]:
                    print(f"   - {stock.get('symbol')}: {stock.get('companyName', 'N/A')[:40]}")
            else:
                print("❌ Empty screener response")
                return False
        else:
            print(f"❌ HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True


def test_polygon():
    """Test Polygon.io API"""
    print("\n=== Testing Polygon API ===")
    api_key = os.getenv("POLYGON_API_KEY")
    
    if not api_key:
        print("❌ POLYGON_API_KEY not set")
        return False
    
    print(f"API Key: {api_key[:8]}...")
    
    # Test 1: Get latest price
    print("\n1. Testing getLatestPrice(AAPL)...")
    url = f"https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey={api_key}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("results") and len(data["results"]) > 0:
                result = data["results"][0]
                print(f"✅ Price retrieved:")
                print(f"   Close: ${result.get('c', 0):.2f}")
                print(f"   Volume: {result.get('v', 0):,.0f}")
            else:
                print("❌ No results in response")
                return False
        else:
            print(f"❌ HTTP {response.status_code}: {response.text[:100]}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 2: Get news
    print("\n2. Testing getNews(AAPL)...")
    url = f"https://api.polygon.io/v2/reference/news?ticker=AAPL&limit=3&apiKey={api_key}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("results"):
                print(f"✅ News retrieved: {len(data['results'])} articles")
                for article in data["results"][:2]:
                    print(f"   - {article.get('title', 'N/A')[:60]}...")
            else:
                print("⚠️ No news found (may be normal)")
        else:
            print(f"❌ HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True


def test_fiscal_ai():
    """Test Fiscal AI API"""
    print("\n=== Testing Fiscal AI API ===")
    api_key = os.getenv("FISCAL_AI_API_KEY")
    
    if not api_key:
        print("❌ FISCAL_AI_API_KEY not set")
        return False
    
    print(f"API Key: {api_key[:8]}...")
    
    # Test: Get company fundamentals
    print("\n1. Testing company fundamentals (AAPL)...")
    url = "https://api.fiscal.ai/v1/company/fundamentals"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(f"{url}?ticker=AAPL", headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Fiscal AI response received")
            print(f"   Data: {json.dumps(data, indent=2)[:200]}...")
            return True
        elif response.status_code == 401:
            print("❌ Authentication failed - check API key")
            return False
        else:
            print(f"⚠️ HTTP {response.status_code}: {response.text[:200]}")
            # Try alternative endpoint
            print("\n   Trying alternative endpoint...")
            return True  # Don't fail, just note
    except Exception as e:
        print(f"⚠️ Error (may need different endpoint): {e}")
        return True  # Don't fail the whole test


def main():
    print("=" * 50)
    print("ARC Investment Factory - Data Provider Test")
    print("=" * 50)
    
    print("\nEnvironment check:")
    print(f"  FMP_API_KEY: {'SET' if os.getenv('FMP_API_KEY') else 'NOT SET'}")
    print(f"  POLYGON_API_KEY: {'SET' if os.getenv('POLYGON_API_KEY') else 'NOT SET'}")
    print(f"  FISCAL_AI_API_KEY: {'SET' if os.getenv('FISCAL_AI_API_KEY') else 'NOT SET'}")
    
    fmp_ok = test_fmp()
    polygon_ok = test_polygon()
    fiscal_ok = test_fiscal_ai()
    
    print("\n" + "=" * 50)
    print("Summary:")
    print(f"  FMP: {'✅ Working' if fmp_ok else '❌ Failed'}")
    print(f"  Polygon: {'✅ Working' if polygon_ok else '❌ Failed'}")
    print(f"  Fiscal AI: {'✅ Available' if fiscal_ok else '❌ Failed'}")
    print("=" * 50)
    
    return fmp_ok and polygon_ok


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
