#!/usr/bin/env python3
"""
Migration Script: Add status_institucional and dependency_type to all prompts

status_institucional values:
- core: Central prompts for decision-making, almost always executed when eligible
- supporting: Prompts that enrich analysis, executed based on budget and signals
- optional: Low marginal value or situational use prompts
- experimental: Prompts under testing, not critical for decisions
- deprecated: Maintained for compatibility, not automatically executed

dependency_type values:
- always: No dependencies, can always be executed
- lane_a_promotion: Requires idea promotion from Lane A
- gate_pass: Requires passing specific gates
- signal_threshold: Requires minimum signal/conviction level
- manual_only: Only executed manually
"""

import json
import sys
from pathlib import Path

# Define classification rules
def classify_status_institucional(prompt: dict) -> str:
    """
    Classify prompt into institutional status based on:
    - expected_value_score
    - lane and stage
    - criticality field
    """
    value = prompt.get('expected_value_score', 5)
    cost = prompt.get('expected_cost_score', 5)
    ratio = prompt.get('value_cost_ratio', 1)
    lane = prompt.get('lane', '')
    stage = prompt.get('stage', '')
    prompt_id = prompt.get('prompt_id', '')
    
    # Core prompts: High value (>=8) AND critical stages
    core_stages = [
        'discovery', 'screening', 'thesis_development', 'synthesis',
        'financial_analysis', 'risk_analysis', 'output'
    ]
    core_prompts = [
        # Lane A core
        'investment_presentation_creator', 'sector_thesis_stress_test',
        'pure_play_filter', 'thematic_candidate_screen',
        # Lane B core
        'investment_thesis_synthesis', 'bull_bear_analysis',
        'financial_statement_analysis', 'valuation_analysis',
        'risk_assessment', 'investment_memo', 'thesis_presentation',
        # Portfolio core
        'portfolio_construction', 'position_sizer', 'risk_monitoring',
    ]
    
    if prompt_id in core_prompts:
        return 'core'
    
    if value >= 8 and stage in core_stages:
        return 'core'
    
    # Supporting prompts: Value >= 6 or important analysis stages
    supporting_stages = [
        'business_analysis', 'industry_analysis', 'management_analysis',
        'macro_context', 'catalyst_analysis', 'technical_analysis',
        'risk_management', 'portfolio_analytics'
    ]
    
    if value >= 6 or stage in supporting_stages:
        return 'supporting'
    
    # Optional prompts: Value < 6 and not in critical paths
    optional_stages = [
        'signal_collection', 'market_analysis', 'esg_analysis',
        'special_situations', 'utility', 'tax_management', 'compliance'
    ]
    
    if stage in optional_stages or value < 6:
        return 'optional'
    
    # Default to supporting
    return 'supporting'


def classify_dependency_type(prompt: dict) -> str:
    """
    Classify prompt dependency type based on:
    - min_signal_dependency array
    - lane (A vs B vs monitoring vs portfolio)
    - stage
    """
    deps = prompt.get('min_signal_dependency', [])
    lane = prompt.get('lane', '')
    stage = prompt.get('stage', '')
    prompt_id = prompt.get('prompt_id', '')
    
    # If has explicit dependencies, it's gate_pass or signal_threshold
    if deps and len(deps) > 0:
        # Check if dependencies are gates or other prompts
        gate_deps = [d for d in deps if 'gate' in d.lower() or 'filter' in d.lower()]
        if gate_deps:
            return 'gate_pass'
        return 'signal_threshold'
    
    # Lane B prompts require Lane A promotion
    if lane == 'lane_b':
        # Output stage requires full research completion
        if stage in ['output', 'synthesis', 'execution']:
            return 'signal_threshold'
        # Other Lane B stages require promotion
        return 'lane_a_promotion'
    
    # Monitoring prompts require active positions
    if lane == 'monitoring':
        return 'signal_threshold'
    
    # Portfolio prompts can vary
    if lane == 'portfolio':
        if stage in ['execution', 'hedging']:
            return 'signal_threshold'
        return 'always'
    
    # Lane A and utility prompts are generally always available
    if lane in ['lane_a', 'utility']:
        return 'always'
    
    # Default
    return 'always'


def migrate_prompts(input_path: str, output_path: str) -> dict:
    """
    Migrate prompts file to add new institutional fields
    """
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    prompts = data.get('prompts', [])
    stats = {
        'total': len(prompts),
        'status_institucional': {},
        'dependency_type': {}
    }
    
    for prompt in prompts:
        # Add status_institucional
        status = classify_status_institucional(prompt)
        prompt['status_institucional'] = status
        stats['status_institucional'][status] = stats['status_institucional'].get(status, 0) + 1
        
        # Add dependency_type
        dep_type = classify_dependency_type(prompt)
        prompt['dependency_type'] = dep_type
        stats['dependency_type'][dep_type] = stats['dependency_type'].get(dep_type, 0) + 1
    
    # Update metadata
    if 'metadata' not in data:
        data['metadata'] = {}
    data['metadata']['version'] = data['metadata'].get('version', '1.0.0')
    data['metadata']['institutional_fields_added'] = True
    data['metadata']['migration_date'] = '2026-01-13'
    
    # Write output
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    return stats


def main():
    # Paths
    base_path = Path(__file__).parent.parent
    input_path = base_path / 'packages/worker/src/prompts/library/prompts_full.json'
    output_path = input_path  # Overwrite in place
    
    print(f"Migrating prompts from: {input_path}")
    print(f"Output to: {output_path}")
    print()
    
    stats = migrate_prompts(str(input_path), str(output_path))
    
    print("=== Migration Complete ===")
    print(f"Total prompts: {stats['total']}")
    print()
    print("status_institucional distribution:")
    for status, count in sorted(stats['status_institucional'].items()):
        print(f"  {status}: {count}")
    print()
    print("dependency_type distribution:")
    for dep_type, count in sorted(stats['dependency_type'].items()):
        print(f"  {dep_type}: {count}")


if __name__ == '__main__':
    main()
