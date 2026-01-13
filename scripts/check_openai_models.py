#!/usr/bin/env python3
"""Check available OpenAI models"""

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

print("=" * 60)
print("AVAILABLE OPENAI MODELS")
print("=" * 60)

models = client.models.list()

# Filter and sort GPT models
gpt_models = [m for m in models.data if 'gpt' in m.id.lower()]
gpt_models.sort(key=lambda x: x.id)

print(f"\n📋 GPT Models ({len(gpt_models)}):\n")
for model in gpt_models:
    print(f"  - {model.id}")

# Look for GPT-5 specifically
print("\n" + "=" * 60)
print("GPT-5 MODELS:")
print("=" * 60)
gpt5_models = [m for m in models.data if 'gpt-5' in m.id.lower() or 'gpt5' in m.id.lower()]
if gpt5_models:
    for model in gpt5_models:
        print(f"  ✅ {model.id}")
else:
    print("  ❌ No GPT-5 models found in your account")
    print("\n  Available latest models:")
    latest = [m for m in gpt_models if any(x in m.id for x in ['4o', '4-turbo', 'o1', 'o3'])]
    for model in latest[-10:]:
        print(f"    - {model.id}")
