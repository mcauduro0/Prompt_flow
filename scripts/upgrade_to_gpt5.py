#!/usr/bin/env python3
"""
Upgrade all OpenAI prompts to GPT-5.2 Pro
"""

import json
from pathlib import Path

def upgrade_prompts():
    prompts_path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    
    with open(prompts_path, 'r') as f:
        data = json.load(f)
    
    changes = []
    openai_models = ['gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    
    for prompt in data['prompts']:
        prompt_id = prompt['prompt_id']
        llm_config = prompt.get('llm_config', {})
        current_model = llm_config.get('model', 'default')
        provider = llm_config.get('provider', 'openai')
        
        # Only update OpenAI models (not Claude or other providers)
        if provider in ['openai', None] and any(m in current_model for m in openai_models + ['default']):
            old_model = current_model
            
            # Update to GPT-5.2 Pro
            prompt['llm_config'] = {
                **llm_config,
                'model': 'gpt-5.2-pro',
                'provider': 'openai',
                'max_tokens': llm_config.get('max_tokens', 4096),
                'temperature': llm_config.get('temperature', 0.7)
            }
            
            changes.append(f"{prompt_id}: {old_model} -> gpt-5.2-pro")
    
    # Save updated prompts
    with open(prompts_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return changes

def main():
    print("=" * 60)
    print("UPGRADING TO GPT-5.2 PRO")
    print("=" * 60)
    
    changes = upgrade_prompts()
    
    print(f"\n📝 Prompts upgraded ({len(changes)}):\n")
    for change in changes:
        print(f"  ✅ {change}")
    
    print(f"\n💾 Changes saved to prompts_full.json")
    print(f"\n🚀 Total: {len(changes)} prompts now using gpt-5.2-pro")

if __name__ == "__main__":
    main()
