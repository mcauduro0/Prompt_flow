#!/usr/bin/env python3
"""
Analyze all prompts from all_prompts_final.md and create a comprehensive mapping
to the pipeline stages and lanes.
"""

import re
import json
from collections import defaultdict

# Read the markdown file
with open('/home/ubuntu/Prompt_flow/docs/all_prompts_final.md', 'r') as f:
    content = f.read()

# Parse prompts
prompts = []
current_category = None
current_prompt = None

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i].strip()
    
    # Category header (## Category Name)
    if line.startswith('## ') and not line.startswith('## Table'):
        current_category = line[3:].strip()
        i += 1
        continue
    
    # Prompt header (### N. Prompt Name)
    if re.match(r'^### \d+\.', line):
        if current_prompt:
            prompts.append(current_prompt)
        
        prompt_name = re.sub(r'^### \d+\.\s*', '', line)
        current_prompt = {
            'category': current_category,
            'title': prompt_name,
            'name': None,
            'subcategory': None,
            'description': None,
            'llm_provider': None,
            'llm_model': None,
            'temperature': None,
            'max_tokens': None,
            'template': None,
            'variables': []
        }
        i += 1
        continue
    
    # Parse prompt fields
    if current_prompt:
        if line.startswith('**Name:**'):
            match = re.search(r'`([^`]+)`', line)
            if match:
                current_prompt['name'] = match.group(1)
        elif line.startswith('**Subcategory:**'):
            current_prompt['subcategory'] = line.replace('**Subcategory:**', '').strip()
        elif line.startswith('**Description:**'):
            current_prompt['description'] = line.replace('**Description:**', '').strip()
        elif line.startswith('**LLM:**'):
            llm_match = re.search(r'(\w+)\s*/\s*(\S+)\s*\(temp:\s*([\d.]+|N/A),\s*max_tokens:\s*(\d+|N/A)\)', line)
            if llm_match:
                current_prompt['llm_provider'] = llm_match.group(1) if llm_match.group(1) != 'N/A' else None
                current_prompt['llm_model'] = llm_match.group(2) if llm_match.group(2) != 'N/A' else None
                current_prompt['temperature'] = float(llm_match.group(3)) if llm_match.group(3) != 'N/A' else None
                current_prompt['max_tokens'] = int(llm_match.group(4)) if llm_match.group(4) != 'N/A' else None
        elif line.startswith('**Variables:**'):
            var_match = re.search(r'\[([^\]]*)\]', line)
            if var_match:
                vars_str = var_match.group(1)
                current_prompt['variables'] = [v.strip().strip('"\'') for v in vars_str.split(',') if v.strip()]
        elif line == '```' and current_prompt['template'] is None:
            # Start of template
            template_lines = []
            i += 1
            while i < len(lines) and lines[i].strip() != '```':
                template_lines.append(lines[i])
                i += 1
            current_prompt['template'] = '\n'.join(template_lines)
    
    i += 1

# Add last prompt
if current_prompt:
    prompts.append(current_prompt)

# Define pipeline mapping based on category and subcategory
def map_to_pipeline(prompt):
    """Map prompt to lane and stage based on category/subcategory"""
    category = prompt['category']
    subcategory = prompt['subcategory']
    name = prompt['name']
    
    # Lane mapping
    lane = 'lane_b'  # Default to Lane B (research)
    stage = 'research'  # Default stage
    
    # Idea Generation -> Lane A
    if category == 'Idea Generation':
        lane = 'lane_a'
        if subcategory in ['screening', 'thematic']:
            stage = 'screening'
        elif subcategory in ['alternative_sources', 'social_sentiment', 'alternative_data', 'sec_filings']:
            stage = 'signal_collection'
        elif subcategory in ['pattern_recognition', 'industry']:
            stage = 'analysis'
        else:
            stage = 'discovery'
    
    # Due Diligence -> Lane B Research
    elif category == 'Due Diligence':
        lane = 'lane_b'
        if subcategory in ['business_model', 'operations']:
            stage = 'business_analysis'
        elif subcategory in ['financial', 'financial_analysis', 'valuation']:
            stage = 'financial_analysis'
        elif subcategory in ['management']:
            stage = 'management_analysis'
        elif subcategory in ['industry', 'market_analysis']:
            stage = 'industry_analysis'
        elif subcategory in ['risk', 'risk_analysis']:
            stage = 'risk_analysis'
        elif subcategory in ['catalysts']:
            stage = 'catalyst_analysis'
        elif subcategory in ['thesis']:
            stage = 'thesis_development'
        elif subcategory in ['technical']:
            stage = 'technical_analysis'
        elif subcategory in ['esg']:
            stage = 'esg_analysis'
        else:
            stage = 'research'
    
    # Macro -> Lane A (macro context)
    elif category == 'Macro':
        lane = 'lane_a'
        stage = 'macro_context'
    
    # Market Analysis -> Lane A
    elif category == 'Market Analysis':
        lane = 'lane_a'
        stage = 'market_analysis'
    
    # Monitoring -> Post-research
    elif category == 'Monitoring':
        lane = 'monitoring'
        stage = 'position_monitoring'
    
    # Portfolio Management -> Portfolio lane
    elif category == 'Portfolio Management':
        lane = 'portfolio'
        if subcategory in ['construction', 'sizing']:
            stage = 'construction'
        elif subcategory in ['risk', 'analytics']:
            stage = 'risk_management'
        elif subcategory in ['execution']:
            stage = 'execution'
        elif subcategory in ['hedging']:
            stage = 'hedging'
        elif subcategory in ['compliance']:
            stage = 'compliance'
        elif subcategory in ['tax']:
            stage = 'tax_management'
        elif subcategory in ['strategy']:
            stage = 'strategy'
        else:
            stage = 'portfolio_analytics'
    
    # Research Synthesis -> Lane B Synthesis
    elif category == 'Research Synthesis':
        lane = 'lane_b'
        stage = 'synthesis'
    
    # Special Situations -> Lane B Special
    elif category == 'Special Situations':
        lane = 'lane_b'
        stage = 'special_situations'
    
    # Thesis -> Lane B Thesis
    elif category == 'Thesis':
        lane = 'lane_b'
        if subcategory in ['output']:
            stage = 'output'
        elif subcategory in ['monitoring']:
            stage = 'thesis_monitoring'
        elif subcategory in ['execution']:
            stage = 'execution'
        elif subcategory in ['risk']:
            stage = 'risk_assessment'
        else:
            stage = 'thesis_development'
    
    # Other
    elif category == 'Other':
        lane = 'utility'
        stage = 'utility'
    
    return lane, stage

# Process all prompts
for prompt in prompts:
    lane, stage = map_to_pipeline(prompt)
    prompt['lane'] = lane
    prompt['stage'] = stage

# Generate summary
print("=" * 80)
print("PROMPT ANALYSIS SUMMARY")
print("=" * 80)

# By category
print("\n### Prompts by Category ###")
by_category = defaultdict(list)
for p in prompts:
    by_category[p['category']].append(p)

for cat, cat_prompts in sorted(by_category.items()):
    print(f"\n{cat}: {len(cat_prompts)} prompts")
    for p in cat_prompts:
        print(f"  - {p['name']} ({p['subcategory']}) -> {p['lane']}/{p['stage']}")

# By lane
print("\n" + "=" * 80)
print("### Prompts by Lane ###")
by_lane = defaultdict(list)
for p in prompts:
    by_lane[p['lane']].append(p)

for lane, lane_prompts in sorted(by_lane.items()):
    print(f"\n{lane.upper()}: {len(lane_prompts)} prompts")
    by_stage = defaultdict(list)
    for p in lane_prompts:
        by_stage[p['stage']].append(p)
    for stage, stage_prompts in sorted(by_stage.items()):
        print(f"  {stage}:")
        for p in stage_prompts:
            print(f"    - {p['name']}")

# Summary stats
print("\n" + "=" * 80)
print("### Summary Statistics ###")
print(f"Total prompts: {len(prompts)}")
print(f"Categories: {len(by_category)}")
print(f"Lanes: {len(by_lane)}")

# LLM distribution
llm_dist = defaultdict(int)
for p in prompts:
    if p['llm_provider'] and p['llm_model']:
        llm_dist[f"{p['llm_provider']}/{p['llm_model']}"] += 1
    else:
        llm_dist['code/no-llm'] += 1

print("\nLLM Distribution:")
for llm, count in sorted(llm_dist.items(), key=lambda x: -x[1]):
    print(f"  {llm}: {count}")

# Save structured data
output = {
    'total_prompts': len(prompts),
    'categories': list(by_category.keys()),
    'lanes': list(by_lane.keys()),
    'prompts': prompts
}

with open('/home/ubuntu/Prompt_flow/docs/prompts_analysis.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"\nSaved analysis to /home/ubuntu/Prompt_flow/docs/prompts_analysis.json")
