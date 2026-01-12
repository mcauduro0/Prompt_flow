#!/usr/bin/env python3
"""
Test Gemini API integration for ARC Investment Factory
"""

import os
import json
import requests

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not set")
    exit(1)

print("=" * 60)
print("ARC Investment Factory - Gemini Integration Test")
print("=" * 60)

# Test 1: Simple completion
print("\n[Test 1] Simple completion...")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

payload = {
    "contents": [
        {
            "role": "user",
            "parts": [{"text": "What is 2+2? Reply with just the number."}]
        }
    ],
    "generationConfig": {
        "temperature": 0.1,
        "maxOutputTokens": 100
    }
}

response = requests.post(url, json=payload)
if response.ok:
    data = response.json()
    content = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
    usage = data.get('usageMetadata', {})
    print(f"✅ Response: {content.strip()}")
    print(f"   Tokens: {usage.get('totalTokenCount', 'N/A')}")
else:
    print(f"❌ Error: {response.status_code} - {response.text}")

# Test 2: JSON mode with financial analysis
print("\n[Test 2] JSON mode with financial analysis...")
payload = {
    "contents": [
        {
            "role": "user",
            "parts": [{"text": """Analyze Apple Inc (AAPL) briefly. Respond in JSON format with these fields:
{
  "ticker": "string",
  "sector": "string",
  "moat_score": number (1-10),
  "key_strength": "string"
}"""}]
        }
    ],
    "generationConfig": {
        "temperature": 0.2,
        "maxOutputTokens": 500,
        "responseMimeType": "application/json"
    }
}

response = requests.post(url, json=payload)
if response.ok:
    data = response.json()
    content = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
    usage = data.get('usageMetadata', {})
    
    try:
        parsed = json.loads(content)
        print(f"✅ JSON Response:")
        print(f"   Ticker: {parsed.get('ticker')}")
        print(f"   Sector: {parsed.get('sector')}")
        print(f"   Moat Score: {parsed.get('moat_score')}/10")
        print(f"   Key Strength: {parsed.get('key_strength')}")
        print(f"   Tokens: {usage.get('totalTokenCount', 'N/A')}")
    except json.JSONDecodeError:
        print(f"⚠️ Response not valid JSON: {content[:200]}")
else:
    print(f"❌ Error: {response.status_code} - {response.text}")

# Test 3: System instruction with due diligence prompt
print("\n[Test 3] System instruction with due diligence prompt...")
payload = {
    "systemInstruction": {
        "parts": [{"text": "You are a senior equity research analyst at a fundamental-focused hedge fund. Provide concise, data-driven analysis."}]
    },
    "contents": [
        {
            "role": "user",
            "parts": [{"text": """Provide a quick competitive analysis for Microsoft (MSFT). 
Focus on: market position, key competitors, and competitive advantages.
Keep it under 100 words."""}]
        }
    ],
    "generationConfig": {
        "temperature": 0.2,
        "maxOutputTokens": 300
    }
}

response = requests.post(url, json=payload)
if response.ok:
    data = response.json()
    content = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
    usage = data.get('usageMetadata', {})
    print(f"✅ Analysis:")
    print(f"   {content[:300]}...")
    print(f"   Tokens: {usage.get('totalTokenCount', 'N/A')}")
else:
    print(f"❌ Error: {response.status_code} - {response.text}")

print("\n" + "=" * 60)
print("Gemini Integration Test Complete")
print("=" * 60)
