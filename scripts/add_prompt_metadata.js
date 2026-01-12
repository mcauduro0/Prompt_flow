/**
 * Script to add expected value metadata to prompts
 * 
 * Adds:
 * - expected_value_score: 1-10 (higher = more valuable output)
 * - expected_cost_score: 1-10 (higher = more expensive to run)
 * - min_signal_dependency: array of prompt_ids that must run first
 */

const fs = require('fs');
const path = require('path');

const promptsPath = path.join(__dirname, '../packages/worker/src/prompts/library/prompts_full.json');
const data = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));

// Define expected value scores based on prompt characteristics
// Higher value = more actionable insights, critical for decision making
// Lower value = supporting data, nice to have

const valueScoreMap = {
  // Synthesis prompts - highest value (final outputs)
  'synthesis': { base: 9, variance: 1 },
  // Gate prompts - high value (decision points)
  'gate': { base: 8, variance: 1 },
  // Research prompts - medium-high value (core analysis)
  'research': { base: 7, variance: 2 },
  // Discovery prompts - medium value (screening)
  'discovery': { base: 6, variance: 2 },
  // Monitoring prompts - medium value (ongoing)
  'monitoring': { base: 6, variance: 1 },
  // Portfolio prompts - high value (allocation decisions)
  'portfolio': { base: 8, variance: 1 },
};

// Define cost scores based on complexity and data requirements
const costScoreMap = {
  // Prompts with multiple data sources cost more
  'multi_source': 8,
  // Prompts with SEC filings are expensive (large documents)
  'sec_heavy': 9,
  // Prompts with social data are medium cost
  'social': 5,
  // Basic financial prompts are lower cost
  'basic': 4,
  // Complex analysis prompts
  'complex': 7,
};

// Define dependencies between prompts
const dependencyMap = {
  // Synthesis prompts depend on research
  'bull_bear_analysis': ['financial_statement_analysis', 'valuation_analysis', 'risk_assessment'],
  'investment_thesis_generator': ['business_overview_report', 'competitive_analysis', 'valuation_analysis'],
  'synthesis_committee': ['bull_bear_analysis', 'investment_thesis_generator'],
  
  // Research prompts may depend on discovery
  'valuation_analysis': ['financial_statement_analysis'],
  'competitive_analysis': ['industry_overview'],
  'risk_assessment': ['financial_statement_analysis', 'regulatory_risk_analysis'],
  
  // Gate prompts depend on specific analyses
  'data_sufficiency_gate': [],
  'coherence_gate': ['bull_bear_analysis'],
  'edge_claim_gate': ['competitive_analysis', 'valuation_analysis'],
  'downside_sanity_gate': ['risk_assessment'],
  'style_fit_gate': ['investment_thesis_generator'],
};

// Process each prompt
data.prompts = data.prompts.map(prompt => {
  const stage = prompt.stage || 'research';
  const dataSources = prompt.required_data_sources || [];
  
  // Calculate expected value score
  const stageConfig = valueScoreMap[stage] || { base: 5, variance: 2 };
  let expectedValue = stageConfig.base;
  
  // Adjust based on criticality
  if (prompt.criticality === 'required') {
    expectedValue += 1;
  }
  
  // Adjust based on lane (Lane B deep research is more valuable)
  if (prompt.lane === 'lane_b') {
    expectedValue += 1;
  }
  
  // Cap at 10
  expectedValue = Math.min(10, expectedValue);
  
  // Calculate expected cost score
  let expectedCost = 4; // base cost
  
  // More data sources = higher cost
  expectedCost += Math.min(3, dataSources.length);
  
  // SEC filings are expensive
  if (dataSources.includes('sec_edgar')) {
    expectedCost += 2;
  }
  
  // Social data is medium cost
  if (dataSources.includes('reddit') || dataSources.includes('social_trends')) {
    expectedCost += 1;
  }
  
  // Higher temperature = more tokens typically
  if (prompt.llm_config?.temperature > 0.5) {
    expectedCost += 1;
  }
  
  // Cap at 10
  expectedCost = Math.min(10, expectedCost);
  
  // Get dependencies
  const dependencies = dependencyMap[prompt.prompt_id] || [];
  
  // Add metadata
  return {
    ...prompt,
    expected_value_score: expectedValue,
    expected_cost_score: expectedCost,
    min_signal_dependency: dependencies,
    value_cost_ratio: parseFloat((expectedValue / expectedCost).toFixed(2)),
  };
});

// Sort prompts by value_cost_ratio for optimal execution order
data.prompts.sort((a, b) => b.value_cost_ratio - a.value_cost_ratio);

// Write updated prompts
fs.writeFileSync(promptsPath, JSON.stringify(data, null, 2));

console.log('Updated prompts with expected value metadata');
console.log(`Total prompts: ${data.prompts.length}`);

// Print summary
const summary = data.prompts.reduce((acc, p) => {
  const stage = p.stage || 'unknown';
  if (!acc[stage]) acc[stage] = { count: 0, avgValue: 0, avgCost: 0 };
  acc[stage].count++;
  acc[stage].avgValue += p.expected_value_score;
  acc[stage].avgCost += p.expected_cost_score;
  return acc;
}, {});

console.log('\nSummary by stage:');
for (const [stage, stats] of Object.entries(summary)) {
  console.log(`  ${stage}: count=${stats.count}, avgValue=${(stats.avgValue/stats.count).toFixed(1)}, avgCost=${(stats.avgCost/stats.count).toFixed(1)}`);
}
