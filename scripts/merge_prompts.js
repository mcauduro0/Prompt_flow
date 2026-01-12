/**
 * Merge real prompts from prompts.json into prompts_full.json
 * This ensures the system uses detailed prompts instead of placeholders
 */

const fs = require('fs');
const path = require('path');

const libraryPath = '/home/ubuntu/Prompt_flow/packages/worker/src/prompts/library';
const realPromptsPath = path.join(libraryPath, 'prompts.json');
const fullPromptsPath = path.join(libraryPath, 'prompts_full.json');

// Load both files
const realPrompts = JSON.parse(fs.readFileSync(realPromptsPath, 'utf-8'));
const fullPrompts = JSON.parse(fs.readFileSync(fullPromptsPath, 'utf-8'));

console.log('=== Prompt Library Merge ===\n');
console.log(`Real prompts (prompts.json): ${realPrompts.prompts.length}`);
console.log(`Full prompts (prompts_full.json): ${fullPrompts.prompts.length}`);

// Create a map of real prompts by ID
const realPromptsMap = new Map();
for (const prompt of realPrompts.prompts) {
  realPromptsMap.set(prompt.prompt_id, prompt);
}

// Check which prompts in full have real templates
let withTemplate = 0;
let withoutTemplate = 0;
let updated = 0;

for (const prompt of fullPrompts.prompts) {
  const realPrompt = realPromptsMap.get(prompt.prompt_id);
  
  if (realPrompt && realPrompt.template && realPrompt.template.length > 100) {
    // Has a real template - merge it
    prompt.template = realPrompt.template;
    prompt.llm_config = realPrompt.llm_config || prompt.llm_config;
    prompt.inputs_schema = realPrompt.inputs_schema || prompt.inputs_schema;
    withTemplate++;
    updated++;
    console.log(`✅ Updated ${prompt.prompt_id} with real template`);
  } else if (prompt.system_prompt && prompt.user_prompt_template) {
    // Check if it's a placeholder
    if (prompt.system_prompt.length < 100 && prompt.user_prompt_template.length < 100) {
      withoutTemplate++;
      console.log(`⚠️  Placeholder: ${prompt.prompt_id}`);
    } else {
      withTemplate++;
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Prompts with real templates: ${withTemplate}`);
console.log(`Prompts with placeholders: ${withoutTemplate}`);
console.log(`Updated from prompts.json: ${updated}`);

// List the placeholder prompts that need real templates
console.log(`\n=== Placeholder Prompts Needing Real Templates ===`);
const placeholders = fullPrompts.prompts.filter(p => {
  const hasShortSystemPrompt = p.system_prompt && p.system_prompt.length < 100;
  const hasShortUserPrompt = p.user_prompt_template && p.user_prompt_template.length < 100;
  const hasNoTemplate = !p.template || p.template.length < 100;
  return hasShortSystemPrompt && hasShortUserPrompt && hasNoTemplate;
});

for (const p of placeholders.slice(0, 10)) {
  console.log(`  - ${p.prompt_id} (${p.lane}/${p.stage})`);
}
if (placeholders.length > 10) {
  console.log(`  ... and ${placeholders.length - 10} more`);
}

// Save the merged file
fs.writeFileSync(fullPromptsPath, JSON.stringify(fullPrompts, null, 2));
console.log(`\n✅ Saved merged prompts to ${fullPromptsPath}`);
