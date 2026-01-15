/**
 * Lane 0 to Database Integration
 * 
 * Este módulo faz a ponte entre o Lane 0 (ledger local) e o banco de dados PostgreSQL.
 * Ele:
 * 1. Lê as ideias do ledger do Lane 0
 * 2. Enriquece com dados do FMP e Polygon
 * 3. Persiste no banco de dados para aparecer no frontend
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import {
  LANE_A_DAILY_LIMIT,
  NOVELTY_NEW_TICKER_DAYS,
} from '@arc/shared';
import { createFMPClient, createPolygonClient, getDataRetrieverHub, type SocialSentimentData } from '@arc/retriever';
import { ideasRepository, runsRepository } from '@arc/database';

// Interface para as ideias do Lane 0
interface Lane0Idea {
  ticker: string;
  companyName: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  thesis: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  sourceUrl: string;
  priority: number;
}

// Interface para o ledger do Lane 0
interface Lane0Ledger {
  id: string;
  date: string;
  ideas: Array<{
    ticker: string;
    companyName: string;
    direction: string;
    consensusDirection: string;
    thesis: string;
    aggregatedConfidence: string;
    mentionCount: number;
    sourceCount: number;
    sources: Array<{
      type: string;
      name: string;
      url: string;
      author: string;
    }>;
    priority: number;
  }>;
  stats: {
    totalIdeasExtracted: number;
    uniqueTickers: number;
    substackIdeas: number;
    redditIdeas: number;
    fmpIdeas?: number;
  };
  publishedToLaneA: boolean;
}

// Configuração
interface IntegrationConfig {
  maxIdeasToProcess: number;
  enrichWithFMP: boolean;
  enrichWithPolygon: boolean;
  dryRun: boolean;
}

const DEFAULT_CONFIG: IntegrationConfig = {
  maxIdeasToProcess: 200,
  enrichWithFMP: true,
  enrichWithPolygon: true,
  dryRun: false,
};

// Caminho do ledger do Lane 0
// Find the most recent ledger file in /tmp
function findLatestLedgerPath(): string | null {
  try {
    const files = fs.readdirSync('/tmp')
      .filter((f: string) => f.startsWith('lane0_ledger_') && f.endsWith('.json'))
      .map((f: string) => {
        const fullPath = `/tmp/${f}`;
        return {
          name: f,
          path: fullPath,
          mtime: fs.statSync(fullPath).mtime.getTime()
        };
      })
      .sort((a: any, b: any) => b.mtime - a.mtime);
    
    return files.length > 0 ? files[0].path : null;
  } catch {
    return null;
  }
}

/**
 * Lê o ledger mais recente do Lane 0
 */
async function readLane0Ledger(): Promise<Lane0Ledger | null> {
  try {
    const ledgerPath = findLatestLedgerPath();
    if (!ledgerPath) {
      console.log('[Integration] Lane 0 ledger not found');
      return null;
    }
    console.log(`[Integration] Found ledger at: ${ledgerPath}`);
    const content = fs.readFileSync(ledgerPath, 'utf-8');
    return JSON.parse(content) as Lane0Ledger;
  } catch (error) {
    console.error('[Integration] Error reading Lane 0 ledger:', (error as Error).message);
    return null;
  }
}

/**
 * Converte ideias do Lane 0 para o formato do Lane A
 */
function convertToLaneAFormat(ledger: Lane0Ledger): Lane0Idea[] {
  return ledger.ideas.map(idea => {
    const primarySource = idea.sources[0];
    return {
      ticker: idea.ticker,
      companyName: idea.companyName,
      direction: idea.direction as 'LONG' | 'SHORT' | 'NEUTRAL',
      thesis: idea.thesis,
      confidence: idea.aggregatedConfidence as 'HIGH' | 'MEDIUM' | 'LOW',
      source: primarySource?.name || 'Unknown',
      sourceUrl: primarySource?.url || '',
      priority: idea.priority,
    };
  });
}

/**
 * Enriquece uma ideia com dados do FMP e Polygon
 */
async function enrichIdea(idea: Lane0Idea): Promise<{
  profile: any;
  metrics: any;
  price: any;
  news: any[];
  socialSentiment: SocialSentimentData | null;
} | null> {
  const fmp = createFMPClient();
  const polygon = createPolygonClient();
  const dataHub = getDataRetrieverHub();

  try {
    const [profileResult, metricsResult, priceResult, newsResult, sentimentResult] = await Promise.all([
      fmp.getProfile(idea.ticker),
      fmp.getKeyMetrics(idea.ticker),
      polygon.getLatestPrice(idea.ticker),
      polygon.getNews(idea.ticker, 5),
      dataHub.getRedditSentiment(idea.ticker),
    ]);

    if (!profileResult.success || !profileResult.data) {
      console.warn(`[Integration] No profile data for ${idea.ticker}`);
      return null;
    }

    return {
      profile: profileResult.data,
      metrics: metricsResult.data,
      price: priceResult.data,
      news: newsResult.data || [],
      socialSentiment: sentimentResult.success ? (sentimentResult.data as SocialSentimentData) : null,
    };
  } catch (error) {
    console.warn(`[Integration] Error enriching ${idea.ticker}:`, (error as Error).message);
    return null;
  }
}

/**
 * Determina o styleTag baseado na tese e métricas
 */
function determineStyleTag(idea: Lane0Idea, metrics: any): 'quality_compounder' | 'garp' | 'cigar_butt' {
  const thesis = idea.thesis.toLowerCase();
  
  // Quality compounder: high ROIC, stable growth
  if (metrics?.roic && metrics.roic > 0.15) {
    return 'quality_compounder';
  }
  
  // GARP: reasonable P/E with growth
  if (metrics?.pe && metrics.pe >= 10 && metrics.pe <= 25) {
    return 'garp';
  }
  
  // Cigar butt: very low valuation
  if (metrics?.pe && metrics.pe < 10) {
    return 'cigar_butt';
  }
  
  // Default based on thesis keywords
  if (thesis.includes('quality') || thesis.includes('moat') || thesis.includes('compounder')) {
    return 'quality_compounder';
  }
  if (thesis.includes('growth') || thesis.includes('garp')) {
    return 'garp';
  }
  if (thesis.includes('value') || thesis.includes('cheap') || thesis.includes('undervalued')) {
    return 'cigar_butt';
  }
  
  return 'garp'; // Default
}

/**
 * Calcula conviction score baseado na confiança do Lane 0 e métricas
 */
function calculateConvictionScore(idea: Lane0Idea, metrics: any): number {
  let score = 50; // Base score
  
  // Ajuste baseado na confiança do Lane 0
  if (idea.confidence === 'HIGH') score += 20;
  else if (idea.confidence === 'MEDIUM') score += 10;
  
  // Ajuste baseado na prioridade
  score += Math.min(idea.priority * 2, 20);
  
  // Ajuste baseado em métricas
  if (metrics) {
    if (metrics.roic && metrics.roic > 0.15) score += 5;
    if (metrics.pe && metrics.pe >= 10 && metrics.pe <= 25) score += 5;
    if (metrics.netDebtToEbitda && metrics.netDebtToEbitda < 2) score += 5;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Processa e persiste as ideias do Lane 0 no banco de dados
 */
export async function processLane0ToDatabaseIntegration(
  config: Partial<IntegrationConfig> = {}
): Promise<{
  success: boolean;
  ideasProcessed: number;
  ideasPersisted: number;
  errors: string[];
  duration_ms: number;
}> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  const asOf = new Date().toISOString().split('T')[0];
  const runId = uuidv4();

  console.log('[Integration] Starting Lane 0 → Database integration...');
  console.log(`[Integration] Config: maxIdeas=${cfg.maxIdeasToProcess}, enrichFMP=${cfg.enrichWithFMP}`);

  // Create run record
  await runsRepository.create({
    runId,
    runType: 'lane0_integration',
    runDate: new Date(),
    status: 'running',
  });

  try {
    // Step 1: Read Lane 0 ledger
    console.log('[Integration] Step 1: Reading Lane 0 ledger...');
    const ledger = await readLane0Ledger();
    
    if (!ledger) {
      throw new Error('Lane 0 ledger not found or empty');
    }
    
    console.log(`[Integration] Found ledger with ${ledger.ideas.length} ideas`);

    // Step 2: Convert to Lane A format
    console.log('[Integration] Step 2: Converting to Lane A format...');
    const lane0Ideas = convertToLaneAFormat(ledger);
    const ideasToProcess = lane0Ideas.slice(0, cfg.maxIdeasToProcess);
    console.log(`[Integration] Processing ${ideasToProcess.length} ideas`);

    // Step 3: Enrich and persist
    console.log('[Integration] Step 3: Enriching and persisting ideas...');
    let persistedCount = 0;

    for (const idea of ideasToProcess) {
      try {
        // Enrich with FMP/Polygon data
        let enrichedData = null;
        if (cfg.enrichWithFMP) {
          enrichedData = await enrichIdea(idea);
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Determine style tag
        const styleTag = determineStyleTag(idea, enrichedData?.metrics);
        
        // Calculate conviction score
        const convictionScore = calculateConvictionScore(idea, enrichedData?.metrics);

        // Persist to database
        if (!cfg.dryRun) {
          const ideaId = uuidv4();
          
          await ideasRepository.create({
            ideaId,
            ticker: idea.ticker,
            companyName: idea.companyName || enrichedData?.profile?.companyName || idea.ticker,
            asOf,
            styleTag,
            oneSentenceHypothesis: idea.thesis,
            mechanism: `Source: ${idea.source}`,
            edgeType: [idea.direction.toLowerCase()],
            status: 'new',
            quickMetrics: enrichedData?.metrics ? {
              market_cap_usd: enrichedData.profile?.marketCap || null,
              ev_to_ebitda: enrichedData.metrics.evToEbitda ?? null,
              pe: enrichedData.metrics.pe ?? null,
              fcf_yield: enrichedData.metrics.fcfYield ?? null,
              revenue_cagr_3y: enrichedData.metrics.revenueCagr3y ?? null,
              ebit_margin: enrichedData.metrics.ebitMargin ?? null,
              net_debt_to_ebitda: enrichedData.metrics.netDebtToEbitda ?? null,
            } : null,
            score: {
              total: convictionScore,
              edge_clarity: 0,
              business_quality_prior: 0,
              financial_resilience_prior: 0,
              valuation_tension: 0,
              catalyst_clarity: 0,
              information_availability: 0,
              complexity_penalty: 0,
              disclosure_friction_penalty: 0,
            },
            isNewTicker: true,
            noveltyScore: '1.00',
            rankScore: (convictionScore / 100).toFixed(6),
            timeHorizon: '1_3_years',
          });

          persistedCount++;
          
          if (persistedCount % 10 === 0) {
            console.log(`[Integration] Persisted ${persistedCount} ideas...`);
          }
        }

      } catch (error) {
        const errorMsg = `Error processing ${idea.ticker}: ${(error as Error).message}`;
        console.warn(`[Integration] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Update run record
    await runsRepository.updateStatus(runId, 'completed');
    await runsRepository.updatePayload(runId, {
      ideasProcessed: ideasToProcess.length,
      ideasPersisted: persistedCount,
      errors,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[Integration] Completed: ${persistedCount} ideas persisted to database`);

    return {
      success: true,
      ideasProcessed: ideasToProcess.length,
      ideasPersisted: persistedCount,
      errors,
      duration_ms: Date.now() - startTime,
    };

  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[Integration] Fatal error:', errorMsg);
    
    await runsRepository.updateStatus(runId, 'failed');
    await runsRepository.updatePayload(runId, {
      error: errorMsg,
      errors,
      duration_ms: Date.now() - startTime,
    });

    return {
      success: false,
      ideasProcessed: 0,
      ideasPersisted: 0,
      errors: [...errors, errorMsg],
      duration_ms: Date.now() - startTime,
    };
  }
}

// Export for use in scheduler
export default processLane0ToDatabaseIntegration;
