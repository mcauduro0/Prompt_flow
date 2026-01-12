#!/usr/bin/env python3
"""
Extract all prompts from all_prompts_final.md and update prompts_full.json
with real templates instead of placeholders.
"""

import json
import re
from pathlib import Path

def extract_prompts_from_markdown(md_path: str) -> dict:
    """Extract all prompts from the markdown file."""
    
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    prompts = {}
    
    # Pattern to match each prompt section
    # Format: ### N. Prompt Name
    prompt_pattern = r'###\s+\d+\.\s+(.+?)\n'
    
    # Split by prompt headers
    sections = re.split(r'(?=###\s+\d+\.)', content)
    
    for section in sections:
        if not section.strip() or not section.startswith('###'):
            continue
        
        # Extract prompt name
        name_match = re.search(r'###\s+\d+\.\s+(.+?)\n', section)
        if not name_match:
            continue
        
        prompt_name = name_match.group(1).strip()
        
        # Extract prompt_id (Name field)
        id_match = re.search(r'\*\*Name:\*\*\s*`([^`]+)`', section)
        if not id_match:
            continue
        
        prompt_id = id_match.group(1).strip()
        
        # Extract subcategory
        subcat_match = re.search(r'\*\*Subcategory:\*\*\s*(\S+)', section)
        subcategory = subcat_match.group(1).strip() if subcat_match else "general"
        
        # Extract description
        desc_match = re.search(r'\*\*Description:\*\*\s*(.+?)(?:\n|$)', section)
        description = desc_match.group(1).strip() if desc_match else prompt_name
        
        # Extract LLM config
        llm_match = re.search(r'\*\*LLM:\*\*\s*(\S+)\s*/\s*(\S+)\s*\(temp:\s*([\d.]+),\s*max_tokens:\s*(\d+)\)', section)
        if llm_match:
            provider = llm_match.group(1).strip()
            model = llm_match.group(2).strip()
            temperature = float(llm_match.group(3))
            max_tokens = int(llm_match.group(4))
        else:
            provider = "openai"
            model = "gpt-4"
            temperature = 0.3
            max_tokens = 4000
        
        # Extract template (content between ``` markers after **Template:**)
        template_match = re.search(r'\*\*Template:\*\*\s*```\s*\n(.*?)```', section, re.DOTALL)
        if template_match:
            template = template_match.group(1).strip()
        else:
            # Try alternative format
            template_match = re.search(r'\*\*Template:\*\*\s*\n```\s*\n(.*?)```', section, re.DOTALL)
            if template_match:
                template = template_match.group(1).strip()
            else:
                print(f"WARNING: No template found for {prompt_id}")
                template = f"Analyze {{{{ticker}}}} for {prompt_name.lower()}."
        
        # Extract variables
        vars_match = re.search(r'\*\*Variables:\*\*\s*`(\[.+?\])`', section)
        if vars_match:
            try:
                variables = json.loads(vars_match.group(1))
            except:
                variables = ["ticker"]
        else:
            variables = ["ticker"]
        
        prompts[prompt_id] = {
            "name": prompt_name,
            "prompt_id": prompt_id,
            "subcategory": subcategory,
            "description": description,
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "template": template,
            "variables": variables
        }
        
        print(f"Extracted: {prompt_id} ({len(template)} chars)")
    
    return prompts


def update_prompts_json(prompts_json_path: str, extracted_prompts: dict) -> dict:
    """Update prompts_full.json with real templates."""
    
    with open(prompts_json_path, 'r', encoding='utf-8') as f:
        prompts_data = json.load(f)
    
    updated_count = 0
    not_found = []
    
    for prompt in prompts_data['prompts']:
        prompt_id = prompt['prompt_id']
        
        if prompt_id in extracted_prompts:
            extracted = extracted_prompts[prompt_id]
            
            # Update the template - combine into system_prompt and user_prompt_template
            # The template from MD is the full prompt, we'll use it as user_prompt_template
            # and create a proper system_prompt
            
            template = extracted['template']
            
            # Check if template has system-like instructions at the beginning
            lines = template.split('\n')
            if lines and lines[0].startswith('You are'):
                # First line is system prompt
                system_prompt = lines[0]
                user_template = '\n'.join(lines[1:]).strip()
            else:
                # Create a system prompt based on subcategory
                system_prompt = f"You are a senior investment analyst specializing in {extracted['subcategory']} analysis. Provide detailed, data-driven analysis with specific metrics and actionable insights."
                user_template = template
            
            # Update the prompt
            prompt['system_prompt'] = system_prompt
            prompt['user_prompt_template'] = user_template
            prompt['description'] = extracted['description']
            
            # Update LLM config
            prompt['llm_config']['provider'] = extracted['provider']
            prompt['llm_config']['model'] = extracted['model']
            prompt['llm_config']['temperature'] = extracted['temperature']
            prompt['llm_config']['max_tokens'] = extracted['max_tokens']
            
            # Update version to indicate real template
            prompt['version'] = "2.0.0"
            
            updated_count += 1
            print(f"Updated: {prompt_id}")
        else:
            not_found.append(prompt_id)
    
    print(f"\n=== Summary ===")
    print(f"Updated: {updated_count} prompts")
    print(f"Not found in MD: {len(not_found)} prompts")
    
    if not_found:
        print(f"\nPrompts not found in all_prompts_final.md:")
        for pid in not_found[:20]:
            print(f"  - {pid}")
        if len(not_found) > 20:
            print(f"  ... and {len(not_found) - 20} more")
    
    return prompts_data


def main():
    # Paths
    md_path = "/home/ubuntu/Prompt_flow/docs/all_prompts_final.md"
    prompts_json_path = "/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json"
    output_path = "/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library/prompts_full.json"
    
    print("=== Extracting prompts from Markdown ===\n")
    extracted_prompts = extract_prompts_from_markdown(md_path)
    print(f"\nTotal extracted: {len(extracted_prompts)} prompts\n")
    
    print("=== Updating prompts_full.json ===\n")
    updated_data = update_prompts_json(prompts_json_path, extracted_prompts)
    
    # Write updated JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(updated_data, f, indent=2, ensure_ascii=False)
    
    print(f"\nWritten to: {output_path}")
    
    # Also save extracted prompts for reference
    extracted_path = "/home/ubuntu/Prompt_flow/docs/extracted_prompts.json"
    with open(extracted_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_prompts, f, indent=2, ensure_ascii=False)
    
    print(f"Extracted prompts saved to: {extracted_path}")


if __name__ == "__main__":
    main()
