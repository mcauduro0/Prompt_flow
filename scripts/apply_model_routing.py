#!/usr/bin/env python3
"""
Apply optimal model routing strategy to all prompts.
- GPT-5.2-chat-latest: Lane A, Portfolio, Monitoring, Utility
- Gemini 2.5 Pro: Lane B Research & Analysis
- Claude Opus 4: Lane B Synthesis & Complex Reasoning
"""

import json
from pathlib import Path

# Claude Opus 4 prompts (Complex Reasoning & Synthesis)
CLAUDE_OPUS_PROMPTS = {
    'investment_thesis_synthesis',
    'bull_bear_analysis',
    'contrarian_thesis_development',
    'variant_perception',
    'investment_memo',
    'thesis_presentation',
    'management_quality_assessment',
    'ceo_track_record',
    'activist_situation_analyzer',
}

# Gemini 2.5 Pro prompts (Deep Research)
GEMINI_PRO_PROMPTS = {
    'business_overview_report',
    'financial_statement_analysis',
    'valuation_analysis',
    'competitive_analysis',
    'industry_overview',
    'risk_assessment',
    'risk_factor_identifier',
    'regulatory_risk_analysis',
    'supply_chain_analysis',
    'customer_analysis',
    'segment_analysis',
    'geographic_analysis',
    'capital_allocation_analysis',
    'debt_structure_analysis',
    'working_capital_analysis',
    'earnings_quality_analysis',
    'technology_ip_analysis',
    'esg_analysis',
    'ma_history_analysis',
    'ipo_analysis',
    'spinoff_opportunity_analyzer',
    'tam_sam_som_analyzer',
    'capital_structure_optimizer',
    'commodity_analysis',
    'credit_cycle_analysis',
    'currency_analysis',
    'election_impact_analysis',
    'liquidity_conditions_analysis',
    'market_regime_analysis',
    'yield_curve_analysis',
    'currency_hedging_analysis',
    'esg_portfolio_analysis',
    'short_interest_analysis',
}

def apply_routing():
    prompts_path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    
    with open(prompts_path, 'r') as f:
        data = json.load(f)
    
    changes = {
        'claude_opus': [],
        'gemini_pro': [],
        'gpt_5_2': [],
        'unchanged': []
    }
    
    for prompt in data['prompts']:
        prompt_id = prompt['prompt_id']
        executor_type = prompt.get('executor_type', 'llm')
        
        # Skip code-only prompts
        if executor_type == 'code':
            changes['unchanged'].append(prompt_id)
            continue
        
        # Ensure llm_config exists
        if 'llm_config' not in prompt:
            prompt['llm_config'] = {
                'provider': 'openai',
                'model': 'gpt-5.2-chat-latest',
                'temperature': 0.7,
                'max_tokens': 4000
            }
        
        old_model = prompt['llm_config'].get('model', 'unknown')
        
        # Apply routing
        if prompt_id in CLAUDE_OPUS_PROMPTS:
            prompt['llm_config']['provider'] = 'anthropic'
            prompt['llm_config']['model'] = 'claude-opus-4-20250514'
            prompt['llm_config']['temperature'] = 0.7
            prompt['llm_config']['max_tokens'] = 8000
            changes['claude_opus'].append(f"{prompt_id}: {old_model} -> claude-opus-4-20250514")
        elif prompt_id in GEMINI_PRO_PROMPTS:
            prompt['llm_config']['provider'] = 'google'
            prompt['llm_config']['model'] = 'gemini-2.5-pro'
            prompt['llm_config']['temperature'] = 0.7
            prompt['llm_config']['max_tokens'] = 8000
            changes['gemini_pro'].append(f"{prompt_id}: {old_model} -> gemini-2.5-pro")
        else:
            # GPT-5.2 for everything else
            prompt['llm_config']['provider'] = 'openai'
            prompt['llm_config']['model'] = 'gpt-5.2-chat-latest'
            # Note: GPT-5.2 doesn't support temperature, so we keep it but it will be ignored
            prompt['llm_config']['max_tokens'] = 4000
            if old_model != 'gpt-5.2-chat-latest':
                changes['gpt_5_2'].append(f"{prompt_id}: {old_model} -> gpt-5.2-chat-latest")
            else:
                changes['unchanged'].append(prompt_id)
    
    # Save updated prompts
    with open(prompts_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return changes

def main():
    print("=" * 70)
    print("APPLYING OPTIMAL MODEL ROUTING STRATEGY")
    print("=" * 70)
    
    changes = apply_routing()
    
    print(f"\n🔵 Claude Opus 4 ({len(changes['claude_opus'])} prompts):")
    for change in changes['claude_opus']:
        print(f"  ✅ {change}")
    
    print(f"\n🟢 Gemini 2.5 Pro ({len(changes['gemini_pro'])} prompts):")
    for change in changes['gemini_pro'][:10]:
        print(f"  ✅ {change}")
    if len(changes['gemini_pro']) > 10:
        print(f"  ... and {len(changes['gemini_pro']) - 10} more")
    
    print(f"\n🟡 GPT-5.2 ({len(changes['gpt_5_2'])} prompts updated):")
    if changes['gpt_5_2']:
        for change in changes['gpt_5_2'][:5]:
            print(f"  ✅ {change}")
        if len(changes['gpt_5_2']) > 5:
            print(f"  ... and {len(changes['gpt_5_2']) - 5} more")
    
    print(f"\n⚪ Unchanged: {len(changes['unchanged'])} prompts")
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Claude Opus 4:    {len(changes['claude_opus'])} prompts (Complex Reasoning)")
    print(f"  Gemini 2.5 Pro:   {len(changes['gemini_pro'])} prompts (Deep Research)")
    print(f"  GPT-5.2:          {len(changes['gpt_5_2']) + len([x for x in changes['unchanged'] if 'gate' not in x])} prompts (General)")
    print(f"  Code-only:        {len([x for x in changes['unchanged'] if 'gate' in x])} prompts")
    print("\n💾 Changes saved to prompts_full.json")

if __name__ == "__main__":
    main()
