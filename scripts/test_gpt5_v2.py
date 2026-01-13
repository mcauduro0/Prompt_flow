#!/usr/bin/env python3
"""Test GPT-5.1 and GPT-5.2 with correct parameters"""

import os
from openai import OpenAI

# Load env
env_path = "/home/ubuntu/Prompt_flow/.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if '=' in line:
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# GPT-5 models to test with max_completion_tokens
gpt5_models = [
    'gpt-5.1',
    'gpt-5.1-chat-latest',
    'gpt-5.2',
    'gpt-5.2-chat-latest',
]

print("=" * 60)
print("TESTING GPT-5.1/5.2 WITH max_completion_tokens")
print("=" * 60)

for model in gpt5_models:
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_completion_tokens=50
        )
        print(f"✅ {model}: WORKS - '{response.choices[0].message.content}'")
    except Exception as e:
        error_msg = str(e)[:100]
        print(f"❌ {model}: FAILED - {error_msg}")

print("\n" + "=" * 60)
print("TESTING gpt-5-chat-latest (confirmed working)")
print("=" * 60)

try:
    response = client.chat.completions.create(
        model='gpt-5-chat-latest',
        messages=[
            {"role": "system", "content": "You are a financial analyst."},
            {"role": "user", "content": "Analyze Apple stock briefly."}
        ],
        max_tokens=200
    )
    print(f"✅ gpt-5-chat-latest: WORKS")
    print(f"   Response: {response.choices[0].message.content[:200]}...")
    print(f"   Tokens: {response.usage.total_tokens}")
except Exception as e:
    print(f"❌ gpt-5-chat-latest: FAILED - {e}")
