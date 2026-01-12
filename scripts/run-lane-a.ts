/**
 * ARC Investment Factory - Run Lane A with Real Data
 * 
 * This script executes Lane A (Daily Discovery) with real data from:
 * - FMP: Company fundamentals, screening
 * - Polygon: Real-time prices, news
 * - OpenAI/Anthropic: LLM analysis
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

// Environment check
console.log('========================================');
console.log('ARC Investment Factory - Lane A Execution');
console.log('========================================');
console.log('\nEnvironment check:');
console.log(`  FMP_API_KEY: ${process.env.FMP_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);

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

// OpenAI API function
async function generateIdea(stock: any): Promise<any | null> {
  const { ticker, profile, metrics, price, news } = stock;
  
  // Build news summary
  const newsSummary = news.length > 0
    ? news.slice(0, 3).map((n: any) => `- ${n.title}`).join('\n')
    : 'No recent news';

  // Calculate price info
  const priceInfo = price
    ? `Current Price: $${price.c?.toFixed(2)}, Volume: ${(price.v / 1_000_000).toFixed(2)}M`
    : 'Price data unavailable';

  const prompt = `You are a senior investment analyst at a fundamental-focused hedge fund. Analyze this company and determine if it has investment potential.

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

Based on this information, provide your analysis:
1. Does this company have investment potential? Consider quality of business, valuation, and catalysts.
2. A brief investment thesis (2-3 sentences max)
3. Investment style classification:
   - quality_compounder: High quality business with durable moat, strong ROIC, can compound value over time
   - garp: Growth at reasonable price - good growth prospects at fair valuation
   - cigar_butt: Deep value - trading below intrinsic value, potential catalyst for rerating
4. The mechanism - how will value be realized?
5. Edge types - what is the informational or analytical edge?
6. Conviction level (1-10)

Respond ONLY in valid JSON format:
{
  "hasInvestmentPotential": boolean,
  "thesis": "string",
  "styleTag": "quality_compounder" | "garp" | "cigar_butt",
  "mechanism": "string",
  "edgeType": ["string"],
  "conviction": number
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`No JSON found in response for ${ticker}`);
      return null;
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      ...analysis,
      ticker,
      companyName: profile.companyName,
      sector: profile.sector,
      marketCap: profile.mktCap,
      currentPrice: price?.c,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error(`Error generating idea for ${ticker}:`, (error as Error).message);
    return null;
  }
}

// Main execution
async function runLaneA() {
  const runId = uuidv4();
  const startTime = Date.now();
  const results: any[] = [];
  const errors: string[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  
  console.log(`\n[Lane A] Starting run ${runId}`);
  console.log(`[Lane A] Timestamp: ${new Date().toISOString()}`);
  
  // Step 1: Fetch universe
  console.log('\n[Lane A] Step 1: Fetching stock universe...');
  const universe = await screenStocks({
    marketCapMoreThan: 1_000_000_000,  // $1B+
    marketCapLowerThan: 50_000_000_000, // $50B max
    country: 'US',
    exchange: 'NYSE,NASDAQ',
    limit: 20,  // Start with 20 stocks for testing
  });
  
  if (universe.length === 0) {
    console.error('[Lane A] Failed to fetch universe');
    return { success: false, error: 'Failed to fetch universe' };
  }
  
  // Shuffle and take sample
  const shuffled = universe.sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, 10); // Analyze 10 stocks
  console.log(`[Lane A] Universe: ${universe.length} stocks, analyzing ${sample.length}`);
  console.log(`[Lane A] Sample: ${sample.join(', ')}`);
  
  // Step 2: Enrich stock data
  console.log('\n[Lane A] Step 2: Enriching stock data...');
  const enrichedStocks: any[] = [];
  
  for (const ticker of sample) {
    try {
      console.log(`  Fetching data for ${ticker}...`);
      
      const [profile, metrics, price, news] = await Promise.all([
        getProfile(ticker),
        getKeyMetrics(ticker),
        getLatestPrice(ticker),
        getNews(ticker, 3),
      ]);
      
      if (!profile) {
        console.warn(`  Skipping ${ticker} - no profile data`);
        continue;
      }
      
      enrichedStocks.push({ ticker, profile, metrics, price, news });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      errors.push(`Error enriching ${ticker}: ${(error as Error).message}`);
    }
  }
  
  console.log(`[Lane A] Enriched ${enrichedStocks.length} stocks`);
  
  // Step 3: Generate ideas using LLM
  console.log('\n[Lane A] Step 3: Generating investment ideas...');
  const ideas: any[] = [];
  
  for (const stock of enrichedStocks) {
    try {
      console.log(`  Analyzing ${stock.ticker}...`);
      
      const idea = await generateIdea(stock);
      
      if (idea) {
        totalTokens += idea.usage?.total_tokens || 0;
        // Estimate cost: ~$0.00015 per 1K input tokens, ~$0.0006 per 1K output tokens for gpt-4o-mini
        totalCost += (idea.usage?.prompt_tokens || 0) * 0.00000015 + (idea.usage?.completion_tokens || 0) * 0.0000006;
        
        if (idea.hasInvestmentPotential && idea.conviction >= 6) {
          ideas.push(idea);
          console.log(`  ✅ ${stock.ticker}: ${idea.styleTag} (conviction: ${idea.conviction})`);
          console.log(`     Thesis: ${idea.thesis?.slice(0, 100)}...`);
        } else {
          console.log(`  ⏭️ ${stock.ticker}: No investment potential or low conviction`);
        }
      }
      
      // Rate limiting for API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      errors.push(`Error analyzing ${stock.ticker}: ${(error as Error).message}`);
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Summary
  console.log('\n========================================');
  console.log('Lane A Execution Summary');
  console.log('========================================');
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`Universe: ${universe.length} stocks`);
  console.log(`Analyzed: ${enrichedStocks.length} stocks`);
  console.log(`Ideas Generated: ${ideas.length}`);
  console.log(`Total Tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated Cost: $${totalCost.toFixed(4)}`);
  console.log(`Errors: ${errors.length}`);
  
  if (ideas.length > 0) {
    console.log('\n--- Generated Ideas ---');
    for (const idea of ideas) {
      console.log(`\n${idea.ticker} - ${idea.companyName}`);
      console.log(`  Style: ${idea.styleTag}`);
      console.log(`  Conviction: ${idea.conviction}/10`);
      console.log(`  Sector: ${idea.sector}`);
      console.log(`  Market Cap: $${(idea.marketCap / 1e9).toFixed(2)}B`);
      console.log(`  Thesis: ${idea.thesis}`);
      console.log(`  Mechanism: ${idea.mechanism}`);
      console.log(`  Edge: ${idea.edgeType?.join(', ')}`);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n--- Errors ---');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  // Return results for telemetry
  return {
    success: true,
    runId,
    duration_ms: duration,
    universeSize: universe.length,
    analyzed: enrichedStocks.length,
    ideasGenerated: ideas.length,
    ideas,
    telemetry: {
      total_tokens: totalTokens,
      total_cost: totalCost,
      provider: 'openai',
      model: 'gpt-4o-mini',
    },
    errors,
  };
}

// Execute
runLaneA()
  .then(result => {
    console.log('\n========================================');
    console.log(result.success ? '✅ Lane A completed successfully' : '❌ Lane A failed');
    console.log('========================================');
    
    // Save results to file
    const fs = require('fs');
    const outputPath = `/home/ubuntu/Prompt_flow/output/lane_a_run_${result.runId || 'unknown'}.json`;
    fs.mkdirSync('/home/ubuntu/Prompt_flow/output', { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
