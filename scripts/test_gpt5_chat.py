#!/usr/bin/env python3
"""Test which GPT-5 models support chat completions"""

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

# GPT-5 models to test
gpt5_models = [
    'gpt-5',
    'gpt-5-chat-latest',
    'gpt-5-mini',
    'gpt-5-pro',
    'gpt-5.1',
    'gpt-5.1-chat-latest',
    'gpt-5.2',
    'gpt-5.2-chat-latest',
    'gpt-5.2-pro',
]

print("=" * 60)
print("TESTING GPT-5 MODELS FOR CHAT SUPPORT")
print("=" * 60)

for model in gpt5_models:
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10
        )
        print(f"✅ {model}: WORKS - '{response.choices[0].message.content}'")
    except Exception as e:
        error_msg = str(e)[:80]
        print(f"❌ {model}: FAILED - {error_msg}")

print("\n" + "=" * 60)
print("RECOMMENDATION: Use a model marked with ✅ for chat")
print("=" * 60)
