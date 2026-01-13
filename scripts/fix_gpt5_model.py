#!/usr/bin/env python3
"""
Fix GPT-5 model to use gpt-5.2-chat-latest (the correct chat model)
"""

import json
from pathlib import Path

def fix_prompts():
    prompts_path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    
    with open(prompts_path, 'r') as f:
        data = json.load(f)
    
    changes = []
    
    for prompt in data['prompts']:
        prompt_id = prompt['prompt_id']
        llm_config = prompt.get('llm_config', {})
        current_model = llm_config.get('model', '')
        
        # Fix gpt-5.2-pro to gpt-5.2-chat-latest
        if current_model == 'gpt-5.2-pro':
            prompt['llm_config']['model'] = 'gpt-5.2-chat-latest'
            changes.append(f"{prompt_id}: gpt-5.2-pro -> gpt-5.2-chat-latest")
    
    # Save updated prompts
    with open(prompts_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return changes

def main():
    print("=" * 60)
    print("FIXING GPT-5 MODEL TO gpt-5.2-chat-latest")
    print("=" * 60)
    
    changes = fix_prompts()
    
    print(f"\n📝 Prompts fixed ({len(changes)}):")
    for change in changes[:10]:
        print(f"  ✅ {change}")
    if len(changes) > 10:
        print(f"  ... and {len(changes) - 10} more")
    
    print(f"\n💾 Changes saved to prompts_full.json")
    print(f"\n🚀 Total: {len(changes)} prompts now using gpt-5.2-chat-latest")

if __name__ == "__main__":
    main()
