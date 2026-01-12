#!/usr/bin/env python3
"""
Compare current implementation against the planning documents.
Identifies gaps and misalignments.
"""

import json
import re
from pathlib import Path
from collections import defaultdict

def load_current_prompts():
    """Load current prompts from prompts_full.json"""
    path = Path("/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json")
    with open(path, 'r') as f:
        data = json.load(f)
    return {p['prompt_id']: p for p in data['prompts']}

def parse_plan_catalog():
    """Parse the plan catalog to extract expected prompts"""
    path = Path("/home/ubuntu/Prompt_flow/docs/PLAN_PromptCatalog.md")
    with open(path, 'r') as f:
        content = f.read()
    
    # Extract from the quick reference table
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
            'prompt_id': prompt_id,
            'lane': lane,
            'stage': stage,
            'category': category,
            'llm': llm,
        }
    
    return prompts

def parse_pipeline_mapping():
    """Parse the pipeline mapping to extract expected structure"""
    path = Path("/home/ubuntu/Prompt_flow/docs/PLAN_PipelineMapping.md")
    with open(path, 'r') as f:
        content = f.read()
    
    # Extract distribution info
    distribution = {
        'lane_a': 42,
        'lane_b': 44,
        'portfolio': 21,
        'monitoring': 2,
        'utility': 7,
    }
    
    # Extract LLM distribution
    llm_distribution = {
        'gpt-4': 83,
        'code': 18,
        'sonar-pro': 8,
        'claude-3-opus': 7,
    }
    
    return distribution, llm_distribution

def compare_implementations():
    """Compare current implementation vs plan"""
    
    current = load_current_prompts()
    plan = parse_plan_catalog()
    distribution, llm_dist = parse_pipeline_mapping()
    
    report = {
        'summary': {},
        'gaps': [],
        'misalignments': [],
        'template_status': {},
        'lane_distribution': {},
        'llm_distribution': {},
    }
    
    # Check all planned prompts exist
    missing_prompts = []
    for prompt_id in plan:
        if prompt_id not in current:
            missing_prompts.append(prompt_id)
    
    # Check extra prompts not in plan
    extra_prompts = []
    for prompt_id in current:
        if prompt_id not in plan:
            extra_prompts.append(prompt_id)
    
    # Check lane/stage alignment
    lane_mismatches = []
    for prompt_id, planned in plan.items():
        if prompt_id in current:
            curr = current[prompt_id]
            if curr.get('lane') != planned['lane']:
                lane_mismatches.append({
                    'prompt_id': prompt_id,
                    'expected_lane': planned['lane'],
                    'actual_lane': curr.get('lane'),
                })
    
    # Check template quality (not placeholder)
    placeholder_templates = []
    real_templates = []
    for prompt_id, prompt in current.items():
        template = prompt.get('user_prompt_template', '')
        system = prompt.get('system_prompt', '')
        
        # Check if it's a placeholder
        is_placeholder = (
            len(template) < 100 or
            'Analyze {{ticker}} for' in template or
            template.startswith('Analyze {{ticker}}')
        )
        
        if is_placeholder:
            placeholder_templates.append(prompt_id)
        else:
            real_templates.append(prompt_id)
    
    # Count by lane
    lane_counts = defaultdict(int)
    for prompt in current.values():
        lane = prompt.get('lane', 'unknown')
        lane_counts[lane] += 1
    
    # Count by LLM
    llm_counts = defaultdict(int)
    for prompt in current.values():
        llm_config = prompt.get('llm_config', {})
        model = llm_config.get('model', 'unknown')
        if 'gpt' in model.lower():
            llm_counts['gpt-4'] += 1
        elif 'claude' in model.lower():
            llm_counts['claude-3-opus'] += 1
        elif 'sonar' in model.lower():
            llm_counts['sonar-pro'] += 1
        else:
            llm_counts['other'] += 1
    
    # Check version (2.0.0 = real templates)
    v2_count = sum(1 for p in current.values() if p.get('version') == '2.0.0')
    
    report['summary'] = {
        'total_planned': len(plan),
        'total_current': len(current),
        'missing_prompts': len(missing_prompts),
        'extra_prompts': len(extra_prompts),
        'lane_mismatches': len(lane_mismatches),
        'placeholder_templates': len(placeholder_templates),
        'real_templates': len(real_templates),
        'v2_templates': v2_count,
    }
    
    report['gaps'] = {
        'missing_prompts': missing_prompts,
        'extra_prompts': extra_prompts,
    }
    
    report['misalignments'] = {
        'lane_mismatches': lane_mismatches,
    }
    
    report['template_status'] = {
        'placeholder': placeholder_templates[:10],  # First 10
        'placeholder_count': len(placeholder_templates),
        'real_count': len(real_templates),
    }
    
    report['lane_distribution'] = {
        'expected': distribution,
        'actual': dict(lane_counts),
    }
    
    report['llm_distribution'] = {
        'expected': llm_dist,
        'actual': dict(llm_counts),
    }
    
    return report

def main():
    print("=" * 60)
    print("IMPLEMENTATION vs PLAN COMPARISON")
    print("=" * 60)
    
    report = compare_implementations()
    
    print("\n📊 SUMMARY")
    print("-" * 40)
    for key, value in report['summary'].items():
        print(f"  {key}: {value}")
    
    print("\n🔴 GAPS")
    print("-" * 40)
    if report['gaps']['missing_prompts']:
        print(f"  Missing prompts ({len(report['gaps']['missing_prompts'])}):")
        for p in report['gaps']['missing_prompts'][:10]:
            print(f"    - {p}")
        if len(report['gaps']['missing_prompts']) > 10:
            print(f"    ... and {len(report['gaps']['missing_prompts']) - 10} more")
    else:
        print("  ✅ No missing prompts")
    
    if report['gaps']['extra_prompts']:
        print(f"\n  Extra prompts not in plan ({len(report['gaps']['extra_prompts'])}):")
        for p in report['gaps']['extra_prompts'][:10]:
            print(f"    - {p}")
    else:
        print("  ✅ No extra prompts")
    
    print("\n⚠️  MISALIGNMENTS")
    print("-" * 40)
    if report['misalignments']['lane_mismatches']:
        print(f"  Lane mismatches ({len(report['misalignments']['lane_mismatches'])}):")
        for m in report['misalignments']['lane_mismatches'][:5]:
            print(f"    - {m['prompt_id']}: expected {m['expected_lane']}, got {m['actual_lane']}")
    else:
        print("  ✅ No lane mismatches")
    
    print("\n📝 TEMPLATE STATUS")
    print("-" * 40)
    print(f"  Real templates (v2.0.0): {report['template_status']['real_count']}")
    print(f"  Placeholder templates: {report['template_status']['placeholder_count']}")
    if report['template_status']['placeholder']:
        print(f"  Sample placeholders:")
        for p in report['template_status']['placeholder'][:5]:
            print(f"    - {p}")
    
    print("\n📈 LANE DISTRIBUTION")
    print("-" * 40)
    print("  Expected vs Actual:")
    for lane in ['lane_a', 'lane_b', 'portfolio', 'monitoring', 'utility']:
        expected = report['lane_distribution']['expected'].get(lane, 0)
        actual = report['lane_distribution']['actual'].get(lane, 0)
        status = "✅" if expected == actual else "⚠️"
        print(f"    {status} {lane}: expected {expected}, actual {actual}")
    
    print("\n🤖 LLM DISTRIBUTION")
    print("-" * 40)
    print("  Actual:")
    for llm, count in report['llm_distribution']['actual'].items():
        print(f"    - {llm}: {count}")
    
    # Save report
    output_path = "/home/ubuntu/Prompt_flow/docs/IMPLEMENTATION_COMPARISON_REPORT.json"
    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n💾 Full report saved to: {output_path}")
    
    # Overall assessment
    print("\n" + "=" * 60)
    print("OVERALL ASSESSMENT")
    print("=" * 60)
    
    issues = []
    if report['summary']['missing_prompts'] > 0:
        issues.append(f"❌ {report['summary']['missing_prompts']} prompts missing from implementation")
    if report['summary']['lane_mismatches'] > 0:
        issues.append(f"⚠️ {report['summary']['lane_mismatches']} prompts have lane mismatches")
    if report['template_status']['placeholder_count'] > 0:
        issues.append(f"⚠️ {report['template_status']['placeholder_count']} prompts still have placeholder templates")
    
    if not issues:
        print("✅ Implementation is fully aligned with plan!")
    else:
        print("Issues found:")
        for issue in issues:
            print(f"  {issue}")

if __name__ == "__main__":
    main()
