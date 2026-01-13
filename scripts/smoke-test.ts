/**
 * Smoke Test Script - Validates core prompts with real data and LLMs
 * 
 * Tests 7 core prompts across all lanes:
 * - Lane A: macro_environment_analysis, thematic_idea_generator
 * - Lane B: business_overview_report, valuation_analysis
 * - Portfolio: portfolio_construction
 * - Monitoring: news_sentiment_monitor
 * - Utility: daily_market_briefing
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const dotenvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Load prompts library
const promptsPath = path.join(__dirname, '..', 'packages', 'worker', 'src', 'prompts', 'library', 'prompts_full.json');
const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
const prompts: Record<string, any> = {};
promptsData.prompts.forEach((p: any) => {
  prompts[p.prompt_id] = p;
});

// Test configuration
const SMOKE_TEST_PROMPTS = [
  { id: 'macro_environment_analysis', lane: 'lane_a', inputs: { date: new Date().toISOString().split('T')[0] } },
  { id: 'thematic_idea_generator', lane: 'lane_a', inputs: { theme: 'AI Infrastructure', sector: 'Technology' } },
  { id: 'business_overview_report', lane: 'lane_b', inputs: { ticker: 'FAST', company_name: 'Fastenal Company' } },
  { id: 'valuation_analysis', lane: 'lane_b', inputs: { ticker: 'FAST', company_name: 'Fastenal Company' } },
  { id: 'portfolio_construction', lane: 'portfolio', inputs: { ideas: ['AAPL', 'MSFT', 'FAST'], constraints: { max_position: 0.1 } } },
  { id: 'news_sentiment_monitor', lane: 'monitoring', inputs: { watchlist: ['AAPL', 'MSFT', 'FAST'] } },
  { id: 'daily_market_briefing', lane: 'utility', inputs: { date: new Date().toISOString().split('T')[0] } },
];

interface TestResult {
  prompt_id: string;
  lane: string;
  status: 'pass' | 'fail' | 'skip';
  execution_time_ms: number;
  tokens_used: number;
  cost_usd: number;
  llm_called: boolean;
  llm_provider: string;
  output_length: number;
  output_preview: string;
  error?: string;
}

async function fetchRealData(ticker: string): Promise<any> {
  const fmpKey = process.env.FMP_API_KEY;
  const polygonKey = process.env.POLYGON_API_KEY;
  
  const data: any = { ticker };
  
  try {
    // FMP Profile
    const profileRes = await fetch(`https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${fmpKey}`);
    const profile = await profileRes.json();
    if (profile && profile[0]) {
      data.company_name = profile[0].companyName;
      data.sector = profile[0].sector;
      data.industry = profile[0].industry;
      data.market_cap = profile[0].mktCap;
      data.description = profile[0].description;
    }
    
    // Polygon Price
    const priceRes = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${polygonKey}`);
    const priceData = await priceRes.json();
    if (priceData.results && priceData.results[0]) {
      data.price = priceData.results[0].c;
      data.volume = priceData.results[0].v;
    }
  } catch (e) {
    console.log(`  ⚠️ Could not fetch all data for ${ticker}`);
  }
  
  return data;
}

function interpolateTemplate(template: string, inputs: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(inputs)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return result;
}

async function runPromptTest(testConfig: typeof SMOKE_TEST_PROMPTS[0]): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    prompt_id: testConfig.id,
    lane: testConfig.lane,
    status: 'fail',
    execution_time_ms: 0,
    tokens_used: 0,
    cost_usd: 0,
    llm_called: false,
    llm_provider: '',
    output_length: 0,
    output_preview: '',
  };

  try {
    const prompt = prompts[testConfig.id];
    if (!prompt) {
      result.status = 'skip';
      result.error = 'Prompt not found in library';
      return result;
    }

    // Enrich inputs with real data if ticker is provided
    let inputs = { ...testConfig.inputs };
    if (inputs.ticker) {
      const realData = await fetchRealData(inputs.ticker);
      inputs = { ...inputs, ...realData };
    }

    // Interpolate template
    const systemPrompt = prompt.system_prompt || 'You are a financial analyst.';
    const userPrompt = interpolateTemplate(prompt.user_prompt_template, inputs);

    // Determine LLM provider
    const llmConfig = prompt.llm_config || {};
    const model = llmConfig.model || 'gpt-4o-mini';
    const provider = model.includes('claude') ? 'anthropic' : 'openai';
    result.llm_provider = provider;

    console.log(`  📤 Calling ${provider} (${model})...`);

    let response: any;
    
    if (provider === 'anthropic') {
      const completion = await anthropic.messages.create({
        model: model,
        max_tokens: llmConfig.max_tokens || 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      result.tokens_used = (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0);
      result.cost_usd = (completion.usage?.input_tokens || 0) * 0.000015 + (completion.usage?.output_tokens || 0) * 0.000075;
    } else {
      // GPT-5.1+ uses max_completion_tokens instead of max_tokens and doesn't support temperature
      const isGpt5Plus = model.includes('gpt-5.1') || model.includes('gpt-5.2');
      const completion = await openai.chat.completions.create({
        model: model,
        ...(isGpt5Plus 
          ? { max_completion_tokens: llmConfig.max_tokens || 2000 }
          : { 
              temperature: llmConfig.temperature || 0.7,
              max_tokens: llmConfig.max_tokens || 2000 
            }),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      
      response = completion.choices[0]?.message?.content || '';
      result.tokens_used = completion.usage?.total_tokens || 0;
      // Pricing for gpt-4o-mini
      result.cost_usd = (completion.usage?.prompt_tokens || 0) * 0.00000015 + (completion.usage?.completion_tokens || 0) * 0.0000006;
    }

    result.llm_called = true;
    result.output_length = response.length;
    result.output_preview = response.substring(0, 200) + (response.length > 200 ? '...' : '');
    result.status = response.length > 100 ? 'pass' : 'fail';

    if (result.status === 'fail') {
      result.error = 'Output too short (< 100 chars)';
    }

  } catch (e: any) {
    result.error = e.message;
    console.log(`  ❌ Error: ${e.message}`);
  } finally {
    result.execution_time_ms = Date.now() - startTime;
  }

  return result;
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🔥 ARC INVESTMENT FACTORY - SMOKE TESTS');
  console.log('═'.repeat(60));
  console.log(`\nTesting ${SMOKE_TEST_PROMPTS.length} core prompts with REAL data and LLMs...\n`);

  // Verify API keys
  console.log('📋 Checking API Keys:');
  console.log(`  - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`  - ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`  - FMP_API_KEY: ${process.env.FMP_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`  - POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log('');

  const results: TestResult[] = [];
  let totalTokens = 0;
  let totalCost = 0;

  for (const testConfig of SMOKE_TEST_PROMPTS) {
    console.log(`\n🧪 Testing: ${testConfig.id} (${testConfig.lane})`);
    console.log('─'.repeat(50));
    
    const result = await runPromptTest(testConfig);
    results.push(result);
    
    totalTokens += result.tokens_used;
    totalCost += result.cost_usd;

    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌';
    console.log(`  ${statusIcon} Status: ${result.status.toUpperCase()}`);
    console.log(`  ⏱️  Time: ${result.execution_time_ms}ms`);
    console.log(`  🔢 Tokens: ${result.tokens_used}`);
    console.log(`  💰 Cost: $${result.cost_usd.toFixed(4)}`);
    console.log(`  📝 Output: ${result.output_length} chars`);
    
    if (result.output_preview) {
      console.log(`  📄 Preview: "${result.output_preview.substring(0, 100)}..."`);
    }
    
    if (result.error) {
      console.log(`  ⚠️  Error: ${result.error}`);
    }
  }

  // Generate summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`\n  Total Tests: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  📈 Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`\n  🔢 Total Tokens: ${totalTokens}`);
  console.log(`  💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`  ⏱️  Total Time: ${results.reduce((a, r) => a + r.execution_time_ms, 0)}ms`);

  // Results by lane
  console.log('\n📋 Results by Lane:');
  const lanes = ['lane_a', 'lane_b', 'portfolio', 'monitoring', 'utility'];
  for (const lane of lanes) {
    const laneResults = results.filter(r => r.lane === lane);
    const lanePassed = laneResults.filter(r => r.status === 'pass').length;
    console.log(`  ${lane}: ${lanePassed}/${laneResults.length} passed`);
  }

  // Failed tests details
  const failedTests = results.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n🔴 Failed Tests:');
    failedTests.forEach(t => {
      console.log(`  - ${t.prompt_id}: ${t.error}`);
    });
  }

  // Save results to file
  const reportPath = path.join(__dirname, '..', 'output', 'smoke_test_results.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: results.length, passed, failed, skipped, pass_rate: (passed / results.length) * 100 },
    metrics: { total_tokens: totalTokens, total_cost_usd: totalCost },
    results,
  }, null, 2));
  console.log(`\n💾 Results saved to: ${reportPath}`);

  // Exit code
  const exitCode = failed > 0 ? 1 : 0;
  console.log(`\n${exitCode === 0 ? '✅ All smoke tests passed!' : '❌ Some tests failed.'}`);
  process.exit(exitCode);
}

main().catch(console.error);
