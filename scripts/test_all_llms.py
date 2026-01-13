#!/usr/bin/env python3
"""
Test all LLM providers: GPT-5.2, Gemini 3 Pro, Claude Opus 4.5
"""

import os
import json

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
print("TESTING ALL LLM PROVIDERS - STATE OF THE ART MODELS")
print("=" * 70)

# Test prompt
TEST_PROMPT = "Analyze Apple (AAPL) stock briefly in 2-3 sentences."

# ============================================================================
# TEST 1: OpenAI GPT-5.2
# ============================================================================
print("\n" + "─" * 70)
print("1. OPENAI GPT-5.2-chat-latest")
print("─" * 70)

try:
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
    
    response = client.chat.completions.create(
        model='gpt-5.2-chat-latest',
        messages=[
            {"role": "system", "content": "You are a financial analyst."},
            {"role": "user", "content": TEST_PROMPT}
        ],
        max_completion_tokens=200
    )
    
    print(f"✅ GPT-5.2-chat-latest: WORKING")
    print(f"   Response: {response.choices[0].message.content[:150]}...")
    print(f"   Tokens: {response.usage.total_tokens}")
except Exception as e:
    print(f"❌ GPT-5.2-chat-latest: FAILED - {str(e)[:100]}")

# ============================================================================
# TEST 2: Google Gemini 3 Pro
# ============================================================================
print("\n" + "─" * 70)
print("2. GOOGLE GEMINI 3 PRO")
print("─" * 70)

try:
    import google.generativeai as genai
    
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    
    # List available models to find Gemini 3
    models = genai.list_models()
    gemini_models = [m.name for m in models if 'gemini' in m.name.lower()]
    print(f"   Available Gemini models: {gemini_models[:5]}...")
    
    # Try gemini-2.0-flash-exp or gemini-1.5-pro as fallback
    model_to_use = None
    for model_name in ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-pro']:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(TEST_PROMPT)
            model_to_use = model_name
            print(f"✅ {model_name}: WORKING")
            print(f"   Response: {response.text[:150]}...")
            break
        except Exception as e:
            print(f"   ⚠️ {model_name}: {str(e)[:50]}")
            continue
    
    if not model_to_use:
        print("❌ No Gemini model available")
        
except ImportError:
    print("⚠️ google-generativeai not installed. Installing...")
    os.system("pip install google-generativeai -q")
    print("   Please re-run the script after installation")
except Exception as e:
    print(f"❌ Gemini: FAILED - {str(e)[:100]}")

# ============================================================================
# TEST 3: Anthropic Claude Opus 4.5
# ============================================================================
print("\n" + "─" * 70)
print("3. ANTHROPIC CLAUDE OPUS 4.5")
print("─" * 70)

try:
    from anthropic import Anthropic
    
    client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
    
    # Try different Claude models
    claude_models = ['claude-opus-4-5', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-sonnet-4-20250514']
    
    for model_name in claude_models:
        try:
            response = client.messages.create(
                model=model_name,
                max_tokens=200,
                system="You are a financial analyst.",
                messages=[{"role": "user", "content": TEST_PROMPT}]
            )
            
            print(f"✅ {model_name}: WORKING")
            print(f"   Response: {response.content[0].text[:150]}...")
            print(f"   Tokens: {response.usage.input_tokens + response.usage.output_tokens}")
            break
        except Exception as e:
            error_msg = str(e)[:80]
            if 'not found' in error_msg.lower() or '404' in error_msg:
                print(f"   ⚠️ {model_name}: Model not available")
            else:
                print(f"   ⚠️ {model_name}: {error_msg}")
            continue
            
except Exception as e:
    print(f"❌ Claude: FAILED - {str(e)[:100]}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("SUMMARY - AVAILABLE MODELS FOR PRODUCTION")
print("=" * 70)
print("""
Recommended Configuration:
- Primary (General): gpt-5.2-chat-latest
- Deep Research: gemini-2.5-pro or gemini-2.0-flash-exp  
- Complex Reasoning: claude-sonnet-4-20250514 or claude-3-5-sonnet-20241022
""")
