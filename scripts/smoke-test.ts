/**
 * Smoke Test Script - Validates core prompts with real data and LLMs
 * 
 * Supports all three LLM providers:
 * - OpenAI GPT-5.2-chat-latest
 * - Google Gemini 2.5 Pro
 * - Anthropic Claude Opus 4
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
    if (line.startsWith('#') || !line.includes('=')) return;
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value && !value.startsWith('$')) {
      process.env[key.trim()] = value;
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

// Test configuration - one prompt per model type
const SMOKE_TEST_PROMPTS = [
  // GPT-5.2 prompts
  { id: 'macro_environment_analysis', lane: 'lane_a', inputs: { date: new Date().toISOString().split('T')[0] } },
  { id: 'thematic_idea_generator', lane: 'lane_a', inputs: { theme: 'AI Infrastructure', sector: 'Technology' } },
  { id: 'portfolio_construction', lane: 'portfolio', inputs: { ideas: ['AAPL', 'MSFT', 'FAST'], constraints: { max_position: 0.1 } } },
  { id: 'news_sentiment_monitor', lane: 'monitoring', inputs: { watchlist: ['AAPL', 'MSFT', 'FAST'] } },
  { id: 'daily_market_briefing', lane: 'utility', inputs: { date: new Date().toISOString().split('T')[0] } },
  // Gemini 2.5 Pro prompts
  { id: 'business_overview_report', lane: 'lane_b', inputs: { ticker: 'FAST', company_name: 'Fastenal Company' } },
  { id: 'valuation_analysis', lane: 'lane_b', inputs: { ticker: 'FAST', company_name: 'Fastenal Company' } },
  // Claude Opus 4 prompts
  { id: 'investment_thesis_synthesis', lane: 'lane_b', inputs: { ticker: 'FAST', company_name: 'Fastenal Company' } },
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
  llm_model: string;
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
    
    // FMP Ratios
    const ratiosRes = await fetch(`https://financialmodelingprep.com/api/v3/ratios/${ticker}?limit=1&apikey=${fmpKey}`);
    const ratios = await ratiosRes.json();
    if (ratios && ratios[0]) {
      data.pe_ratio = ratios[0].priceEarningsRatio;
      data.roe = ratios[0].returnOnEquity;
      data.debt_to_equity = ratios[0].debtEquityRatio;
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

async function callGemini(systemPrompt: string, userPrompt: string, model: string, maxTokens: number): Promise<{ response: string; tokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokens = data.usageMetadata?.totalTokenCount || 0;
  
  return { response: text, tokens };
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
    llm_model: '',
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
    const model = llmConfig.model || 'gpt-5.2-chat-latest';
    const provider = llmConfig.provider || (model.includes('claude') ? 'anthropic' : model.includes('gemini') ? 'google' : 'openai');
    
    result.llm_provider = provider;
    result.llm_model = model;

    console.log(`  📤 Calling ${provider} (${model})...`);

    let response = '';
    
    if (provider === 'anthropic') {
      // Claude Opus 4
      const completion = await anthropic.messages.create({
        model: model,
        max_tokens: llmConfig.max_tokens || 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      response = completion.content[0].type === 'text' ? completion.content[0].text : '';
      result.tokens_used = (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0);
      // Claude Opus 4 pricing: $15/1M input, $75/1M output
      result.cost_usd = (completion.usage?.input_tokens || 0) * 0.000015 + (completion.usage?.output_tokens || 0) * 0.000075;
      
    } else if (provider === 'google') {
      // Gemini 2.5 Pro
      const geminiResult = await callGemini(systemPrompt, userPrompt, model, llmConfig.max_tokens || 4000);
      response = geminiResult.response;
      result.tokens_used = geminiResult.tokens;
      // Gemini 2.5 Pro pricing: $1.25/1M input, $5/1M output (approximate)
      result.cost_usd = result.tokens_used * 0.000003;
      
    } else {
      // OpenAI GPT-5.2
      const isGpt5Plus = model.includes('gpt-5.1') || model.includes('gpt-5.2');
      const completion = await openai.chat.completions.create({
        model: model,
        ...(isGpt5Plus 
          ? { max_completion_tokens: llmConfig.max_tokens || 4000 }
          : { 
              temperature: llmConfig.temperature || 0.7,
              max_tokens: llmConfig.max_tokens || 4000 
            }),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      
      response = completion.choices[0]?.message?.content || '';
      result.tokens_used = completion.usage?.total_tokens || 0;
      // GPT-5.2 pricing: $5/1M input, $20/1M output
      result.cost_usd = (completion.usage?.prompt_tokens || 0) * 0.000005 + (completion.usage?.completion_tokens || 0) * 0.00002;
    }

    result.llm_called = true;
    result.output_length = response.length;
    result.output_preview = response.substring(0, 100).replace(/\n/g, ' ') + (response.length > 100 ? '...' : '');
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
  console.log('🔥 ARC INVESTMENT FACTORY - SMOKE TESTS (STATE-OF-THE-ART)');
  console.log('═'.repeat(60));
  console.log(`Testing ${SMOKE_TEST_PROMPTS.length} core prompts with REAL data and LLMs...`);
  console.log(`\n📋 LLM Providers:`);
  console.log(`  - OpenAI: GPT-5.2-chat-latest`);
  console.log(`  - Google: Gemini 2.5 Pro`);
  console.log(`  - Anthropic: Claude Opus 4`);
  
  console.log(`\n📋 Checking API Keys:`);
  console.log(`  - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`  - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`  - ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`  - FMP_API_KEY: ${process.env.FMP_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`  - POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? '✅ SET' : '❌ NOT SET'}`);

  const results: TestResult[] = [];
  
  for (const testConfig of SMOKE_TEST_PROMPTS) {
    console.log(`\n🧪 Testing: ${testConfig.id} (${testConfig.lane})`);
    console.log('─'.repeat(50));
    
    const result = await runPromptTest(testConfig);
    results.push(result);
    
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'skip' ? '⏭️' : '❌';
    console.log(`  ${statusIcon} Status: ${result.status.toUpperCase()}`);
    console.log(`  ⏱️  Time: ${result.execution_time_ms}ms`);
    console.log(`  🔢 Tokens: ${result.tokens_used}`);
    console.log(`  💰 Cost: $${result.cost_usd.toFixed(4)}`);
    console.log(`  📝 Output: ${result.output_length} chars`);
    console.log(`  🤖 Model: ${result.llm_provider}/${result.llm_model}`);
    if (result.output_preview) {
      console.log(`  📄 Preview: "${result.output_preview}"`);
    }
    if (result.error) {
      console.log(`  ⚠️  Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const totalTokens = results.reduce((sum, r) => sum + r.tokens_used, 0);
  const totalCost = results.reduce((sum, r) => sum + r.cost_usd, 0);
  const totalTime = results.reduce((sum, r) => sum + r.execution_time_ms, 0);
  
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  📈 Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`  🔢 Total Tokens: ${totalTokens}`);
  console.log(`  💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`  ⏱️  Total Time: ${totalTime}ms`);
  
  // By provider
  console.log(`\n📋 Results by Provider:`);
  const byProvider: Record<string, { passed: number; total: number }> = {};
  results.forEach(r => {
    const key = r.llm_provider || 'unknown';
    if (!byProvider[key]) byProvider[key] = { passed: 0, total: 0 };
    byProvider[key].total++;
    if (r.status === 'pass') byProvider[key].passed++;
  });
  Object.entries(byProvider).forEach(([provider, stats]) => {
    console.log(`  ${provider}: ${stats.passed}/${stats.total} passed`);
  });
  
  // By lane
  console.log(`\n📋 Results by Lane:`);
  const byLane: Record<string, { passed: number; total: number }> = {};
  results.forEach(r => {
    if (!byLane[r.lane]) byLane[r.lane] = { passed: 0, total: 0 };
    byLane[r.lane].total++;
    if (r.status === 'pass') byLane[r.lane].passed++;
  });
  Object.entries(byLane).forEach(([lane, stats]) => {
    console.log(`  ${lane}: ${stats.passed}/${stats.total} passed`);
  });

  if (failed > 0) {
    console.log(`\n🔴 Failed Tests:`);
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.prompt_id}: ${r.error || 'Unknown error'}`);
    });
  }

  // Save results
  const outputPath = path.join(__dirname, '..', 'output', 'smoke_test_results.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: results.length, passed, failed, skipped, pass_rate: (passed / results.length) * 100 },
    metrics: { total_tokens: totalTokens, total_cost_usd: totalCost, total_time_ms: totalTime },
    by_provider: byProvider,
    by_lane: byLane,
    results,
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${outputPath}`);
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main().catch(console.error);
