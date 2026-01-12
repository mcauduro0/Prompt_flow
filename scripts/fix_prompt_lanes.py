#!/usr/bin/env python3
"""
Fix prompt lanes to align with the planning documents.
Based on PLAN_PromptCatalog.md specifications.
"""

import json
import re
from pathlib import Path

def parse_plan_catalog():
    """Parse the plan catalog to extract expected lanes and stages"""
    path = Path("/home/ubuntu/Prompt_flow/docs/PLAN_PromptCatalog.md")
    with open(path, 'r') as f:
        content = f.read()
    
    prompts = {}
    # Pattern: | 1 | `bull_bear_analysis` | lane_b | thesis_development | Due Diligence | gpt-4 |
    pattern = r'\|\s*\d+\s*\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|'
    
    for match in re.finditer(pattern, content):
        prompt_id = match.group(1).strip()
        lane = match.group(2).strip()
        stage = match.group(3).strip()
        category = match.group(4).strip()
        llm = match.group(5).strip()
        
        prompts[prompt_id] = {
            'lane': lane,
            'stage': stage,
            'category': category,
            'llm': llm,
        }
    
    return prompts

def fix_prompt_lanes():
    """Fix lanes in prompts_full.json to match the plan"""
    
    # Load plan
    plan = parse_plan_catalog()
    print(f"Loaded {len(plan)} prompts from plan")
    
    # Load current prompts
    prompts_path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    with open(prompts_path, 'r') as f:
        data = json.load(f)
    
    # Track changes
    changes = []
    
    # Fix each prompt
    for prompt in data['prompts']:
        prompt_id = prompt['prompt_id']
        
        if prompt_id in plan:
            planned = plan[prompt_id]
            
            # Check and fix lane
            if prompt.get('lane') != planned['lane']:
                old_lane = prompt.get('lane')
                prompt['lane'] = planned['lane']
                changes.append({
                    'prompt_id': prompt_id,
                    'field': 'lane',
                    'old': old_lane,
                    'new': planned['lane'],
                })
            
            # Also fix stage to match plan
            if prompt.get('stage') != planned['stage']:
                old_stage = prompt.get('stage')
                prompt['stage'] = planned['stage']
                changes.append({
                    'prompt_id': prompt_id,
                    'field': 'stage',
                    'old': old_stage,
                    'new': planned['stage'],
                })
            
            # Fix category
            if prompt.get('category') != planned['category']:
                old_cat = prompt.get('category')
                prompt['category'] = planned['category']
                changes.append({
                    'prompt_id': prompt_id,
                    'field': 'category',
                    'old': old_cat,
                    'new': planned['category'],
                })
    
    # Save updated prompts
    with open(prompts_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return changes

def main():
    print("=" * 60)
    print("FIXING PROMPT LANES TO MATCH PLAN")
    print("=" * 60)
    
    changes = fix_prompt_lanes()
    
    # Summarize changes
    lane_changes = [c for c in changes if c['field'] == 'lane']
    stage_changes = [c for c in changes if c['field'] == 'stage']
    category_changes = [c for c in changes if c['field'] == 'category']
    
    print(f"\n📊 CHANGES MADE:")
    print(f"   Lane changes: {len(lane_changes)}")
    print(f"   Stage changes: {len(stage_changes)}")
    print(f"   Category changes: {len(category_changes)}")
    
    if lane_changes:
        print(f"\n🔄 LANE CHANGES ({len(lane_changes)}):")
        for c in lane_changes:
            print(f"   {c['prompt_id']}: {c['old']} → {c['new']}")
    
    # Verify distribution
    prompts_path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    with open(prompts_path, 'r') as f:
        data = json.load(f)
    
    from collections import Counter
    lane_counts = Counter(p.get('lane') for p in data['prompts'])
    
    print(f"\n📈 NEW LANE DISTRIBUTION:")
    for lane in ['lane_a', 'lane_b', 'portfolio', 'monitoring', 'utility']:
        count = lane_counts.get(lane, 0)
        print(f"   {lane}: {count}")
    
    print(f"\n✅ Changes saved to prompts_full.json")
    
    # Save change log
    log_path = Path("/home/ubuntu/Prompt_flow/docs/LANE_FIX_LOG.json")
    with open(log_path, 'w') as f:
        json.dump({
            'timestamp': '2026-01-12',
            'total_changes': len(changes),
            'lane_changes': len(lane_changes),
            'stage_changes': len(stage_changes),
            'category_changes': len(category_changes),
            'changes': changes,
        }, f, indent=2)
    
    print(f"📝 Change log saved to: {log_path}")

if __name__ == "__main__":
    main()
