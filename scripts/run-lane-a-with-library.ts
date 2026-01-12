/**
 * ARC Investment Factory - Run Lane A with Library Prompts
 * 
 * This script executes Lane A (Daily Discovery) using the real prompts
 * from the prompt library (prompts_full.json).
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Load prompts from library
const promptsPath = path.join(__dirname, '../packages/worker/src/prompts/library/prompts_full.json');
const promptsData = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
const prompts: Map<string, any> = new Map(
  promptsData.prompts.map((p: any) => [p.prompt_id, p])
);

// Environment check
console.log('========================================');
console.log('ARC Investment Factory - Lane A Execution');
console.log('Using Library Prompts (v2.0.0)');
console.log('========================================');
console.log('\nEnvironment check:');
console.log(`  FMP_API_KEY: ${process.env.FMP_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);

if (!process.env.FMP_API_KEY) {
  console.error('\n❌ FMP_API_KEY is required for Lane A execution');
  process.exit(1);
}

// FMP API functions
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

async function fmpFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${FMP_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${process.env.FMP_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`FMP error: ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`FMP fetch error: ${(error as Error).message}`);
    return null;
  }
}

async function getProfile(ticker: string) {
  const data = await fmpFetch<any[]>(`/profile/${ticker}`);
  return data?.[0] || null;
}

async function getKeyMetrics(ticker: string) {
  const data = await fmpFetch<any[]>(`/key-metrics-ttm/${ticker}`);
  return data?.[0] || null;
}

async function screenStocks(params: {
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  country?: string;
  exchange?: string;
  limit?: number;
}): Promise<string[]> {
  const queryParams = new URLSearchParams();
  if (params.marketCapMoreThan) queryParams.set('marketCapMoreThan', params.marketCapMoreThan.toString());
  if (params.marketCapLowerThan) queryParams.set('marketCapLowerThan', params.marketCapLowerThan.toString());
  if (params.country) queryParams.set('country', params.country);
  if (params.exchange) queryParams.set('exchange', params.exchange);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  
  const data = await fmpFetch<any[]>(`/stock-screener?${queryParams.toString()}`);
  return data?.map(s => s.symbol) || [];
}

// Polygon API functions
const POLYGON_BASE_URL = 'https://api.polygon.io';

async function polygonFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${POLYGON_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${process.env.POLYGON_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Polygon error: ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Polygon fetch error: ${(error as Error).message}`);
    return null;
  }
}

async function getLatestPrice(ticker: string) {
  const data = await polygonFetch<any>(`/v2/aggs/ticker/${ticker}/prev`);
  return data?.results?.[0] || null;
}

async function getNews(ticker: string, limit: number = 5) {
  const data = await polygonFetch<any>(`/v2/reference/news?ticker=${ticker}&limit=${limit}`);
  return data?.results || [];
}

// Get prompt from library
function getPrompt(promptId: string): any {
  const prompt = prompts.get(promptId);
  if (!prompt) {
    console.warn(`Prompt not found: ${promptId}`);
    return null;
  }
  return prompt;
}

// Render prompt template with variables
function renderPrompt(promptId: string, variables: Record<string, any>): { system: string; user: string } | null {
  const prompt = getPrompt(promptId);
  if (!prompt) return null;
  
  let systemPrompt = prompt.system_prompt;
  let userPrompt = prompt.user_prompt_template;
  
  // Replace variables in templates
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    systemPrompt = systemPrompt.replace(placeholder, String(value));
    userPrompt = userPrompt.replace(placeholder, String(value));
  }
  
  return { system: systemPrompt, user: userPrompt };
}

// Call LLM with prompt
async function callLLM(promptId: string, variables: Record<string, any>): Promise<any | null> {
  const prompt = getPrompt(promptId);
  if (!prompt) return null;
  
  const rendered = renderPrompt(promptId, variables);
  if (!rendered) return null;
  
  const provider = prompt.llm_config?.provider || 'openai';
  const model = prompt.llm_config?.model || 'gpt-4o-mini';
  const temperature = prompt.llm_config?.temperature || 0.3;
  const maxTokens = prompt.llm_config?.max_tokens || 2000;
  
  console.log(`  Calling ${provider}/${model} for ${promptId}...`);
  
  if (provider === 'openai') {
    return callOpenAI(rendered.system, rendered.user, model, temperature, maxTokens);
  } else if (provider === 'google') {
    return callGemini(rendered.system, rendered.user, model, temperature, maxTokens);
  } else {
    // Default to OpenAI
    return callOpenAI(rendered.system, rendered.user, 'gpt-4o-mini', temperature, maxTokens);
  }
}

async function callOpenAI(system: string, user: string, model: string, temperature: number, maxTokens: number): Promise<any | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      }
    };
  } catch (error) {
    console.error(`OpenAI error: ${(error as Error).message}`);
    return null;
  }
}

async function callGemini(system: string, user: string, model: string, temperature: number, maxTokens: number): Promise<any | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`Gemini error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      }
    };
  } catch (error) {
    console.error(`Gemini error: ${(error as Error).message}`);
    return null;
  }
}

// Generate idea using library prompts
async function generateIdea(stock: any): Promise<any | null> {
  const { ticker, profile, metrics, price, news } = stock;
  
  // Build context for the prompt
  const newsSummary = news.length > 0
    ? news.slice(0, 3).map((n: any) => `- ${n.title}`).join('\n')
    : 'No recent news';

  const priceInfo = price
    ? `Current Price: $${price.c?.toFixed(2)}, Volume: ${(price.v / 1_000_000).toFixed(2)}M`
    : 'Price data unavailable';

  // Build financial data string
  const financialData = `
Company: ${profile.companyName} (${ticker})
Sector: ${profile.sector}
Industry: ${profile.industry}
Market Cap: $${((profile.mktCap || 0) / 1_000_000_000).toFixed(2)}B
${priceInfo}

Business Description:
${profile.description?.slice(0, 600) || 'N/A'}

Financial Metrics (TTM):
- EV/EBITDA: ${metrics?.enterpriseValueOverEBITDATTM?.toFixed(2) || 'N/A'}
- P/E: ${metrics?.peRatioTTM?.toFixed(2) || 'N/A'}
- FCF Yield: ${metrics?.freeCashFlowYieldTTM ? (metrics.freeCashFlowYieldTTM * 100).toFixed(2) + '%' : 'N/A'}
- ROIC: ${metrics?.roicTTM ? (metrics.roicTTM * 100).toFixed(2) + '%' : 'N/A'}
- ROE: ${metrics?.roeTTM ? (metrics.roeTTM * 100).toFixed(2) + '%' : 'N/A'}
- Net Debt/EBITDA: ${metrics?.netDebtToEBITDATTM?.toFixed(2) || 'N/A'}

Recent News:
${newsSummary}
`;

  // Use the bull_bear_case_generator prompt for idea generation
  const result = await callLLM('bull_bear_case_generator', {
    ticker,
    financial_data: financialData,
  });

  if (!result) return null;

  // Parse the response
  try {
    // Try to extract JSON from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        ...analysis,
        ticker,
        companyName: profile.companyName,
        sector: profile.sector,
        marketCap: profile.mktCap,
        currentPrice: price?.c,
        usage: result.usage,
      };
    }
    
    // If no JSON, create structured response from text
    return {
      hasInvestmentPotential: result.content.toLowerCase().includes('potential') || 
                              result.content.toLowerCase().includes('opportunity'),
      thesis: result.content.slice(0, 500),
      styleTag: 'garp',
      conviction: 6,
      ticker,
      companyName: profile.companyName,
      sector: profile.sector,
      marketCap: profile.mktCap,
      currentPrice: price?.c,
      usage: result.usage,
    };
  } catch (error) {
    console.warn(`Failed to parse response for ${ticker}`);
    return null;
  }
}

// Main execution
async function main() {
  const runId = uuidv4();
  const startTime = Date.now();
  
  console.log(`\n📋 Run ID: ${runId}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  // Check prompts loaded
  console.log(`\n📚 Loaded ${prompts.size} prompts from library`);
  const laneAPrompts = Array.from(prompts.values()).filter(p => p.lane === 'lane_a');
  console.log(`   Lane A prompts: ${laneAPrompts.length}`);
  
  // Step 1: Screen stocks
  console.log('\n📊 Step 1: Screening stocks...');
  const tickers = await screenStocks({
    marketCapMoreThan: 1_000_000_000,  // > $1B
    marketCapLowerThan: 50_000_000_000, // < $50B
    country: 'US',
    limit: 20,
  });
  
  console.log(`   Found ${tickers.length} stocks matching criteria`);
  
  // Step 2: Enrich with data
  console.log('\n📈 Step 2: Enriching stock data...');
  const stocks: any[] = [];
  
  for (const ticker of tickers.slice(0, 10)) { // Limit to 10 for demo
    console.log(`   Fetching data for ${ticker}...`);
    
    const [profile, metrics, price, news] = await Promise.all([
      getProfile(ticker),
      getKeyMetrics(ticker),
      getLatestPrice(ticker),
      getNews(ticker, 3),
    ]);
    
    if (profile) {
      stocks.push({ ticker, profile, metrics, price, news });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`   Enriched ${stocks.length} stocks`);
  
  // Step 3: Generate ideas using library prompts
  console.log('\n🧠 Step 3: Generating ideas using library prompts...');
  const ideas: any[] = [];
  let totalTokens = 0;
  
  for (const stock of stocks) {
    console.log(`   Analyzing ${stock.ticker}...`);
    const idea = await generateIdea(stock);
    
    if (idea) {
      ideas.push(idea);
      totalTokens += idea.usage?.total_tokens || 0;
      
      if (idea.hasInvestmentPotential) {
        console.log(`   ✅ ${stock.ticker}: Potential idea (conviction: ${idea.conviction || 'N/A'})`);
      } else {
        console.log(`   ⏭️  ${stock.ticker}: No immediate potential`);
      }
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Filter to high-conviction ideas
  const highConvictionIdeas = ideas.filter(i => i.hasInvestmentPotential && (i.conviction || 0) >= 7);
  
  // Summary
  const duration = (Date.now() - startTime) / 1000;
  const estimatedCost = (totalTokens / 1_000_000) * 0.25; // Rough estimate
  
  console.log('\n========================================');
  console.log('LANE A EXECUTION COMPLETE');
  console.log('========================================');
  console.log(`\n📊 Results:`);
  console.log(`   Stocks analyzed: ${stocks.length}`);
  console.log(`   Ideas generated: ${ideas.length}`);
  console.log(`   High conviction (≥7): ${highConvictionIdeas.length}`);
  console.log(`\n📈 Telemetry:`);
  console.log(`   Duration: ${duration.toFixed(1)}s`);
  console.log(`   Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`   Estimated cost: $${estimatedCost.toFixed(4)}`);
  console.log(`   Prompts used: bull_bear_case_generator (from library)`);
  
  // Save results
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `lane_a_library_run_${runId}.json`);
  const output = {
    runId,
    timestamp: new Date().toISOString(),
    config: {
      promptsVersion: '2.0.0',
      promptsUsed: ['bull_bear_case_generator'],
      llmProvider: 'openai',
    },
    results: {
      stocksScreened: tickers.length,
      stocksAnalyzed: stocks.length,
      ideasGenerated: ideas.length,
      highConvictionIdeas: highConvictionIdeas.length,
    },
    telemetry: {
      durationSeconds: duration,
      totalTokens,
      estimatedCost,
    },
    ideas: highConvictionIdeas,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
  
  // Display top ideas
  if (highConvictionIdeas.length > 0) {
    console.log('\n🏆 Top Ideas:');
    for (const idea of highConvictionIdeas.slice(0, 5)) {
      console.log(`\n   ${idea.ticker} (${idea.companyName})`);
      console.log(`   Style: ${idea.styleTag || 'N/A'}`);
      console.log(`   Conviction: ${idea.conviction || 'N/A'}/10`);
      console.log(`   Thesis: ${(idea.thesis || '').slice(0, 150)}...`);
    }
  }
}

main().catch(console.error);
