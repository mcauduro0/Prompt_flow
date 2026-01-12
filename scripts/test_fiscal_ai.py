#!/usr/bin/env python3
"""
Test Fiscal AI API endpoints
"""

import os
import requests
import json

FISCAL_AI_API_KEY = os.environ.get('FISCAL_AI_API_KEY', 'b439043d-65e0-4547-89fa-6a4b9ece83a0')
BASE_URL = 'https://api.fiscal.ai'

def test_companies_list():
    """Test companies list endpoint"""
    print("\n=== Testing Companies List ===")
    url = f"{BASE_URL}/v2/companies-list"
    params = {
        'apiKey': FISCAL_AI_API_KEY,
        'pageNumber': 1,
        'pageSize': 5
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            print(f"Total companies: {data.get('pagination', {}).get('totalCount', 'N/A')}")
            companies = data.get('data', [])
            print(f"Sample companies:")
            for c in companies[:3]:
                print(f"  - {c.get('name')} ({c.get('ticker')}) - {c.get('exchangeName')}")
            return True
        else:
            print(f"Error: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def test_company_profile(ticker='AAPL'):
    """Test company profile endpoint"""
    print(f"\n=== Testing Company Profile ({ticker}) ===")
    url = f"{BASE_URL}/v2/company/profile"
    params = {
        'apiKey': FISCAL_AI_API_KEY,
        'ticker': ticker
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            print(f"Company: {data.get('name')}")
            print(f"Sector: {data.get('sector')}")
            print(f"Industry: {data.get('industry')}")
            print(f"Available Datasets: {data.get('availableDatasets', [])}")
            return True
        else:
            print(f"Error: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def test_income_statement(ticker='AAPL'):
    """Test income statement endpoint"""
    print(f"\n=== Testing Income Statement ({ticker}) ===")
    url = f"{BASE_URL}/v1/company/financials/income-statement/as-reported"
    params = {
        'apiKey': FISCAL_AI_API_KEY,
        'ticker': ticker,
        'periodType': 'annual'
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            metrics = data.get('metrics', [])
            periods = data.get('data', [])
            print(f"Metrics available: {len(metrics)}")
            print(f"Periods available: {len(periods)}")
            if periods:
                latest = periods[0]
                print(f"Latest period: {latest.get('periodId')} ({latest.get('periodType')})")
            return True
        else:
            print(f"Error: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def test_balance_sheet(ticker='AAPL'):
    """Test balance sheet endpoint"""
    print(f"\n=== Testing Balance Sheet ({ticker}) ===")
    url = f"{BASE_URL}/v1/company/financials/balance-sheet/as-reported"
    params = {
        'apiKey': FISCAL_AI_API_KEY,
        'ticker': ticker,
        'periodType': 'annual'
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            data = response.json()
            metrics = data.get('metrics', [])
            periods = data.get('data', [])
            print(f"Metrics available: {len(metrics)}")
            print(f"Periods available: {len(periods)}")
            return True
        else:
            print(f"Error: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

if __name__ == '__main__':
    print("=" * 50)
    print("Fiscal AI API Test")
    print("=" * 50)
    print(f"API Key: {FISCAL_AI_API_KEY[:8]}...")
    
    results = {
        'companies_list': test_companies_list(),
        'company_profile': test_company_profile('FAST'),
        'income_statement': test_income_statement('FAST'),
        'balance_sheet': test_balance_sheet('FAST'),
    }
    
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for endpoint, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {endpoint}: {status}")
    
    all_passed = all(results.values())
    print(f"\nOverall: {'✅ All tests passed' if all_passed else '❌ Some tests failed'}")
