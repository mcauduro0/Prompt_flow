/**
 * ARC Investment Factory - Run Lane B with Real Data
 * 
 * This script executes Lane B (Deep Research) on a specific ticker with real data from:
 * - FMP: Financial statements, ratios, estimates
 * - Polygon: Price history, news
 * - OpenAI/Anthropic: LLM analysis
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// Get ticker from command line or use default
const TICKER = process.argv[2] || 'FAST'; // Fastenal - high conviction from Lane A

console.log('========================================');
console.log('ARC Investment Factory - Lane B Execution');
console.log('========================================');
console.log(`\nTarget Ticker: ${TICKER}`);
console.log('\nEnvironment check:');
console.log(`  FMP_API_KEY: ${process.env.FMP_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);

// FMP API functions
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

async function fmpFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${FMP_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${process.env.FMP_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (error) {
    console.error(`FMP error: ${(error as Error).message}`);
    return null;
  }
}

// Data fetching functions
async function getCompanyProfile(ticker: string) {
  const data = await fmpFetch<any[]>(`/profile/${ticker}`);
  return data?.[0] || null;
}

async function getIncomeStatements(ticker: string, limit = 4) {
  return await fmpFetch<any[]>(`/income-statement/${ticker}?limit=${limit}`) || [];
}

async function getBalanceSheets(ticker: string, limit = 4) {
  return await fmpFetch<any[]>(`/balance-sheet-statement/${ticker}?limit=${limit}`) || [];
}

async function getCashFlowStatements(ticker: string, limit = 4) {
  return await fmpFetch<any[]>(`/cash-flow-statement/${ticker}?limit=${limit}`) || [];
}

async function getKeyMetrics(ticker: string) {
  const data = await fmpFetch<any[]>(`/key-metrics-ttm/${ticker}`);
  return data?.[0] || null;
}

async function getRatios(ticker: string) {
  const data = await fmpFetch<any[]>(`/ratios-ttm/${ticker}`);
  return data?.[0] || null;
}

async function getAnalystEstimates(ticker: string) {
  return await fmpFetch<any[]>(`/analyst-estimates/${ticker}?limit=4`) || [];
}

async function getCompanyNews(ticker: string) {
  return await fmpFetch<any[]>(`/stock_news?tickers=${ticker}&limit=10`) || [];
}

// Polygon API functions
const POLYGON_BASE_URL = 'https://api.polygon.io';

async function polygonFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${POLYGON_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${process.env.POLYGON_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (error) {
    console.error(`Polygon error: ${(error as Error).message}`);
    return null;
  }
}

async function getPriceHistory(ticker: string, days = 365) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const data = await polygonFetch<any>(`/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc`);
  return data?.results || [];
}

// OpenAI API function
async function analyzeWithLLM(prompt: string, systemPrompt: string): Promise<{ content: string; usage: any } | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  } catch (error) {
    console.error(`LLM error: ${(error as Error).message}`);
    return null;
  }
}

// Analysis modules
async function analyzeBusinessModel(profile: any, income: any[], ratios: any) {
  const systemPrompt = `You are a senior equity analyst specializing in business model analysis. Provide detailed, data-driven analysis.`;
  
  const revenueGrowth = income.length >= 2 
    ? ((income[0].revenue - income[1].revenue) / income[1].revenue * 100).toFixed(1)
    : 'N/A';
  
  const prompt = `Analyze the business model of ${profile.companyName} (${profile.symbol}):

Company Overview:
- Sector: ${profile.sector}
- Industry: ${profile.industry}
- Employees: ${profile.fullTimeEmployees?.toLocaleString() || 'N/A'}
- Market Cap: $${(profile.mktCap / 1e9).toFixed(2)}B

Business Description:
${profile.description?.slice(0, 800) || 'N/A'}

Financial Performance:
- Revenue (TTM): $${(income[0]?.revenue / 1e9).toFixed(2)}B
- Revenue Growth YoY: ${revenueGrowth}%
- Gross Margin: ${(ratios?.grossProfitMarginTTM * 100)?.toFixed(1) || 'N/A'}%
- Operating Margin: ${(ratios?.operatingProfitMarginTTM * 100)?.toFixed(1) || 'N/A'}%
- Net Margin: ${(ratios?.netProfitMarginTTM * 100)?.toFixed(1) || 'N/A'}%

Analyze:
1. Business model sustainability and competitive advantages (moat)
2. Revenue quality and diversification
3. Margin trends and drivers
4. Key business risks

Respond in JSON format:
{
  "moat_rating": "wide|narrow|none",
  "moat_sources": ["string"],
  "revenue_quality": "high|medium|low",
  "margin_sustainability": "strong|moderate|weak",
  "key_strengths": ["string"],
  "key_risks": ["string"],
  "overall_score": number (1-10)
}`;

  return await analyzeWithLLM(prompt, systemPrompt);
}

async function analyzeFinancials(income: any[], balance: any[], cashflow: any[], metrics: any) {
  const systemPrompt = `You are a financial analyst specializing in fundamental analysis. Provide quantitative, data-driven insights.`;
  
  const prompt = `Perform financial analysis for the company:

Income Statement (Last 4 Years):
${income.slice(0, 4).map(i => `- ${i.calendarYear}: Revenue $${(i.revenue/1e9).toFixed(2)}B, Net Income $${(i.netIncome/1e9).toFixed(2)}B, EPS $${i.eps?.toFixed(2)}`).join('\n')}

Balance Sheet (Latest):
- Total Assets: $${(balance[0]?.totalAssets / 1e9).toFixed(2)}B
- Total Debt: $${(balance[0]?.totalDebt / 1e9).toFixed(2)}B
- Cash: $${(balance[0]?.cashAndCashEquivalents / 1e9).toFixed(2)}B
- Shareholders Equity: $${(balance[0]?.totalStockholdersEquity / 1e9).toFixed(2)}B

Cash Flow (Latest):
- Operating CF: $${(cashflow[0]?.operatingCashFlow / 1e9).toFixed(2)}B
- Free Cash Flow: $${(cashflow[0]?.freeCashFlow / 1e9).toFixed(2)}B
- CapEx: $${(cashflow[0]?.capitalExpenditure / 1e9).toFixed(2)}B

Key Metrics:
- ROIC: ${(metrics?.roicTTM * 100)?.toFixed(1) || 'N/A'}%
- ROE: ${(metrics?.roeTTM * 100)?.toFixed(1) || 'N/A'}%
- Debt/Equity: ${metrics?.debtEquityRatioTTM?.toFixed(2) || 'N/A'}
- Current Ratio: ${metrics?.currentRatioTTM?.toFixed(2) || 'N/A'}

Analyze:
1. Financial health and stability
2. Capital efficiency (ROIC, ROE trends)
3. Cash generation quality
4. Leverage and liquidity

Respond in JSON format:
{
  "financial_health": "excellent|good|fair|poor",
  "capital_efficiency": "high|medium|low",
  "cash_generation": "strong|moderate|weak",
  "leverage_risk": "low|moderate|high",
  "key_metrics_summary": {"roic": number, "roe": number, "fcf_yield": number},
  "financial_score": number (1-10)
}`;

  return await analyzeWithLLM(prompt, systemPrompt);
}

async function analyzeValuation(profile: any, metrics: any, estimates: any[], priceHistory: any[]) {
  const systemPrompt = `You are a valuation expert. Provide rigorous, data-driven valuation analysis.`;
  
  const currentPrice = priceHistory[priceHistory.length - 1]?.c || 0;
  const price52wHigh = Math.max(...priceHistory.slice(-252).map((p: any) => p.h || 0));
  const price52wLow = Math.min(...priceHistory.slice(-252).map((p: any) => p.l || Infinity));
  
  const prompt = `Perform valuation analysis:

Current Valuation:
- Stock Price: $${currentPrice.toFixed(2)}
- 52-Week High: $${price52wHigh.toFixed(2)}
- 52-Week Low: $${price52wLow.toFixed(2)}
- Market Cap: $${(profile.mktCap / 1e9).toFixed(2)}B

Valuation Multiples:
- P/E (TTM): ${metrics?.peRatioTTM?.toFixed(1) || 'N/A'}
- EV/EBITDA: ${metrics?.enterpriseValueOverEBITDATTM?.toFixed(1) || 'N/A'}
- P/FCF: ${metrics?.pfcfRatioTTM?.toFixed(1) || 'N/A'}
- P/B: ${metrics?.pbRatioTTM?.toFixed(1) || 'N/A'}
- P/S: ${metrics?.priceToSalesRatioTTM?.toFixed(1) || 'N/A'}

Analyst Estimates:
${estimates.slice(0, 2).map(e => `- ${e.date}: EPS Est $${e.estimatedEpsAvg?.toFixed(2)}, Revenue Est $${(e.estimatedRevenueAvg/1e9).toFixed(2)}B`).join('\n')}

Analyze:
1. Current valuation vs historical and peers
2. Implied growth expectations
3. Margin of safety assessment
4. Fair value estimate

Respond in JSON format:
{
  "valuation_assessment": "undervalued|fairly_valued|overvalued",
  "implied_growth_rate": number (percentage),
  "margin_of_safety": "high|moderate|low|negative",
  "fair_value_estimate": number (price),
  "upside_potential": number (percentage),
  "valuation_score": number (1-10)
}`;

  return await analyzeWithLLM(prompt, systemPrompt);
}

async function synthesizeThesis(ticker: string, profile: any, businessAnalysis: any, financialAnalysis: any, valuationAnalysis: any) {
  const systemPrompt = `You are a portfolio manager synthesizing research into an investment thesis. Be decisive and clear.`;
  
  const prompt = `Synthesize an investment thesis for ${profile.companyName} (${ticker}):

Business Model Analysis:
${businessAnalysis}

Financial Analysis:
${financialAnalysis}

Valuation Analysis:
${valuationAnalysis}

Create a comprehensive investment thesis including:
1. One-sentence investment hypothesis
2. Key investment merits (bull case)
3. Key risks (bear case)
4. Investment recommendation
5. Position sizing guidance

Respond in JSON format:
{
  "ticker": "${ticker}",
  "company_name": "${profile.companyName}",
  "one_sentence_thesis": "string",
  "investment_style": "quality_compounder|garp|cigar_butt|special_situation",
  "bull_case": ["string"],
  "bear_case": ["string"],
  "key_catalysts": ["string"],
  "recommendation": "strong_buy|buy|hold|sell|strong_sell",
  "conviction_score": number (1-10),
  "position_size_guidance": "full|half|quarter|avoid",
  "time_horizon": "string",
  "target_price": number,
  "stop_loss": number
}`;

  return await analyzeWithLLM(prompt, systemPrompt);
}

// Main execution
async function runLaneB(ticker: string) {
  const runId = uuidv4();
  const startTime = Date.now();
  let totalTokens = 0;
  let totalCost = 0;
  const errors: string[] = [];
  
  console.log(`\n[Lane B] Starting run ${runId}`);
  console.log(`[Lane B] Timestamp: ${new Date().toISOString()}`);
  console.log(`[Lane B] Target: ${ticker}`);
  
  // Step 1: Fetch all data
  console.log('\n[Lane B] Step 1: Fetching comprehensive data...');
  
  const [profile, income, balance, cashflow, metrics, ratios, estimates, news, priceHistory] = await Promise.all([
    getCompanyProfile(ticker),
    getIncomeStatements(ticker),
    getBalanceSheets(ticker),
    getCashFlowStatements(ticker),
    getKeyMetrics(ticker),
    getRatios(ticker),
    getAnalystEstimates(ticker),
    getCompanyNews(ticker),
    getPriceHistory(ticker),
  ]);
  
  if (!profile) {
    console.error(`[Lane B] Failed to fetch profile for ${ticker}`);
    return { success: false, error: 'Failed to fetch company profile' };
  }
  
  console.log(`  ✅ Profile: ${profile.companyName}`);
  console.log(`  ✅ Income Statements: ${income.length} years`);
  console.log(`  ✅ Balance Sheets: ${balance.length} years`);
  console.log(`  ✅ Cash Flow: ${cashflow.length} years`);
  console.log(`  ✅ Key Metrics: ${metrics ? 'Available' : 'N/A'}`);
  console.log(`  ✅ Analyst Estimates: ${estimates.length} periods`);
  console.log(`  ✅ News: ${news.length} articles`);
  console.log(`  ✅ Price History: ${priceHistory.length} days`);
  
  // Step 2: Business Model Analysis
  console.log('\n[Lane B] Step 2: Analyzing business model...');
  const businessResult = await analyzeBusinessModel(profile, income, ratios);
  if (businessResult) {
    totalTokens += businessResult.usage?.total_tokens || 0;
    totalCost += (businessResult.usage?.prompt_tokens || 0) * 0.00000015 + (businessResult.usage?.completion_tokens || 0) * 0.0000006;
    console.log(`  ✅ Business model analysis complete`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 3: Financial Analysis
  console.log('\n[Lane B] Step 3: Analyzing financials...');
  const financialResult = await analyzeFinancials(income, balance, cashflow, metrics);
  if (financialResult) {
    totalTokens += financialResult.usage?.total_tokens || 0;
    totalCost += (financialResult.usage?.prompt_tokens || 0) * 0.00000015 + (financialResult.usage?.completion_tokens || 0) * 0.0000006;
    console.log(`  ✅ Financial analysis complete`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 4: Valuation Analysis
  console.log('\n[Lane B] Step 4: Analyzing valuation...');
  const valuationResult = await analyzeValuation(profile, metrics, estimates, priceHistory);
  if (valuationResult) {
    totalTokens += valuationResult.usage?.total_tokens || 0;
    totalCost += (valuationResult.usage?.prompt_tokens || 0) * 0.00000015 + (valuationResult.usage?.completion_tokens || 0) * 0.0000006;
    console.log(`  ✅ Valuation analysis complete`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 5: Synthesize Investment Thesis
  console.log('\n[Lane B] Step 5: Synthesizing investment thesis...');
  const thesisResult = await synthesizeThesis(
    ticker,
    profile,
    businessResult?.content || 'N/A',
    financialResult?.content || 'N/A',
    valuationResult?.content || 'N/A'
  );
  if (thesisResult) {
    totalTokens += thesisResult.usage?.total_tokens || 0;
    totalCost += (thesisResult.usage?.prompt_tokens || 0) * 0.00000015 + (thesisResult.usage?.completion_tokens || 0) * 0.0000006;
    console.log(`  ✅ Investment thesis synthesized`);
  }
  
  const duration = Date.now() - startTime;
  
  // Parse results
  let businessAnalysis, financialAnalysis, valuationAnalysis, investmentThesis;
  
  try {
    const jsonMatch1 = businessResult?.content?.match(/\{[\s\S]*\}/);
    businessAnalysis = jsonMatch1 ? JSON.parse(jsonMatch1[0]) : null;
  } catch (e) { errors.push('Failed to parse business analysis'); }
  
  try {
    const jsonMatch2 = financialResult?.content?.match(/\{[\s\S]*\}/);
    financialAnalysis = jsonMatch2 ? JSON.parse(jsonMatch2[0]) : null;
  } catch (e) { errors.push('Failed to parse financial analysis'); }
  
  try {
    const jsonMatch3 = valuationResult?.content?.match(/\{[\s\S]*\}/);
    valuationAnalysis = jsonMatch3 ? JSON.parse(jsonMatch3[0]) : null;
  } catch (e) { errors.push('Failed to parse valuation analysis'); }
  
  try {
    const jsonMatch4 = thesisResult?.content?.match(/\{[\s\S]*\}/);
    investmentThesis = jsonMatch4 ? JSON.parse(jsonMatch4[0]) : null;
  } catch (e) { errors.push('Failed to parse investment thesis'); }
  
  // Summary
  console.log('\n========================================');
  console.log('Lane B Execution Summary');
  console.log('========================================');
  console.log(`Run ID: ${runId}`);
  console.log(`Ticker: ${ticker}`);
  console.log(`Company: ${profile.companyName}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`Total Tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Estimated Cost: $${totalCost.toFixed(4)}`);
  
  if (investmentThesis) {
    console.log('\n--- Investment Thesis ---');
    console.log(`Recommendation: ${investmentThesis.recommendation}`);
    console.log(`Conviction: ${investmentThesis.conviction_score}/10`);
    console.log(`Style: ${investmentThesis.investment_style}`);
    console.log(`Position Size: ${investmentThesis.position_size_guidance}`);
    console.log(`\nThesis: ${investmentThesis.one_sentence_thesis}`);
    console.log(`\nBull Case:`);
    investmentThesis.bull_case?.forEach((b: string) => console.log(`  • ${b}`));
    console.log(`\nBear Case:`);
    investmentThesis.bear_case?.forEach((b: string) => console.log(`  • ${b}`));
    console.log(`\nCatalysts:`);
    investmentThesis.key_catalysts?.forEach((c: string) => console.log(`  • ${c}`));
    if (investmentThesis.target_price) {
      console.log(`\nTarget Price: $${investmentThesis.target_price}`);
    }
  }
  
  // Return results
  const result = {
    success: true,
    runId,
    ticker,
    companyName: profile.companyName,
    duration_ms: duration,
    analyses: {
      business: businessAnalysis,
      financial: financialAnalysis,
      valuation: valuationAnalysis,
    },
    investmentThesis,
    rawData: {
      profile,
      incomeYears: income.length,
      balanceYears: balance.length,
      cashflowYears: cashflow.length,
      newsCount: news.length,
      priceDays: priceHistory.length,
    },
    telemetry: {
      total_tokens: totalTokens,
      total_cost: totalCost,
      provider: 'openai',
      model: 'gpt-4o-mini',
      analyses_completed: 4,
    },
    errors,
  };
  
  // Save results
  const outputPath = `/home/ubuntu/Prompt_flow/output/lane_b_run_${ticker}_${runId}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return result;
}

// Execute
runLaneB(TICKER)
  .then(result => {
    console.log('\n========================================');
    console.log(result.success ? '✅ Lane B completed successfully' : '❌ Lane B failed');
    console.log('========================================');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
