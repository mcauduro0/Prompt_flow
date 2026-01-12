#!/usr/bin/env python3
"""
Fix prompts that failed in smoke tests:
1. Change sonar-pro to gpt-4o-mini (Perplexity not available via OpenAI)
2. Improve portfolio_construction template
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
        
        # Fix 1: Change sonar-pro to gpt-4o-mini
        if prompt.get('llm_config', {}).get('model') == 'sonar-pro':
            old_model = prompt['llm_config']['model']
            prompt['llm_config']['model'] = 'gpt-4o-mini'
            prompt['llm_config']['provider'] = 'openai'
            changes.append(f"Changed {prompt_id}: {old_model} -> gpt-4o-mini")
        
        # Fix 2: Improve portfolio_construction template
        if prompt_id == 'portfolio_construction':
            prompt['user_prompt_template'] = """You are a portfolio construction specialist.

Given the following investment ideas and constraints, construct an optimal portfolio allocation.

INVESTMENT IDEAS:
{{ideas}}

CONSTRAINTS:
{{constraints}}

Please provide:

1. PORTFOLIO ALLOCATION
   - For each idea, recommend a weight (% of portfolio)
   - Ensure weights sum to 100% or less (cash can be held)
   - Consider diversification across sectors

2. RATIONALE
   - Explain the allocation logic
   - Discuss risk/return tradeoffs
   - Note any concentration concerns

3. RISK METRICS (estimated)
   - Expected portfolio beta
   - Sector concentration
   - Top position size

4. REBALANCING TRIGGERS
   - When to rebalance
   - Position size limits

Format your response as a structured analysis with clear sections."""

            prompt['system_prompt'] = """You are an experienced portfolio manager specializing in equity portfolio construction. 
You follow modern portfolio theory principles while incorporating practical considerations like liquidity, transaction costs, and risk management.
Always provide specific percentage allocations and clear rationale for your recommendations.
If insufficient information is provided, make reasonable assumptions and state them clearly."""

            changes.append(f"Improved {prompt_id} template for better handling of minimal inputs")
    
    # Save updated prompts
    with open(prompts_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return changes

def main():
    print("=" * 60)
    print("FIXING FAILED PROMPTS")
    print("=" * 60)
    
    changes = fix_prompts()
    
    print(f"\n📝 Changes made ({len(changes)}):")
    for change in changes:
        print(f"  ✅ {change}")
    
    print(f"\n💾 Changes saved to prompts_full.json")

if __name__ == "__main__":
    main()
