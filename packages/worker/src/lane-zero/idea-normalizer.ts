/**
 * Lane 0 - Idea Normalizer & Deduplicator
 * 
 * Módulo responsável por:
 * 1. Normalizar tickers e nomes de empresas
 * 2. Validar tickers contra lista de símbolos válidos
 * 3. Detectar e mesclar ideias duplicadas
 * 4. Calcular score de confiança agregado
 */

import type { RawIdea } from './substack-ingestor.js';

// Interface para ideia normalizada
export interface NormalizedIdea {
  ticker: string;
  companyName: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  thesis: string;
  sources: Array<{
    type: 'substack' | 'reddit';
    name: string;
    url: string;
    author: string;
    publishedAt: Date;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    rawQuote?: string;
  }>;
  aggregatedConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  mentionCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  consensusDirection: 'LONG' | 'SHORT' | 'MIXED' | 'NEUTRAL';
  normalizedAt: Date;
}

// Mapeamento de tickers alternativos/comuns
const TICKER_ALIASES: Record<string, string> = {
  'GOOGL': 'GOOG',
  'BRK.A': 'BRK-A',
  'BRK.B': 'BRK-B',
  'BRK/A': 'BRK-A',
  'BRK/B': 'BRK-B',
  'META': 'META',
  'FB': 'META',
  'FACEBOOK': 'META',
};

// Lista de tickers inválidos ou muito genéricos
const INVALID_TICKERS = new Set([
  'AI', 'CEO', 'CFO', 'IPO', 'ETF', 'GDP', 'CPI', 'FED', 'SEC',
  'USA', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'BTC', 'ETH',
  'Q1', 'Q2', 'Q3', 'Q4', 'YOY', 'MOM', 'QOQ',
  'PE', 'PS', 'PB', 'EV', 'ROE', 'ROA', 'ROIC',
  'DD', 'YOLO', 'HODL', 'FOMO', 'FUD',
]);

export class IdeaNormalizer {
  private validTickers: Set<string> = new Set();
  private tickerToCompany: Map<string, string> = new Map();

  constructor() {
    this.initializeValidTickers();
  }

  private initializeValidTickers(): void {
    console.log('[IdeaNormalizer] Using permissive ticker validation');
  }

  normalizeTicker(ticker: string): string | null {
    if (!ticker) return null;
    
    let normalized = ticker.toUpperCase().trim();
    normalized = normalized.replace(/[^A-Z0-9.-]/g, '');
    
    if (TICKER_ALIASES[normalized]) {
      normalized = TICKER_ALIASES[normalized];
    }
    
    if (INVALID_TICKERS.has(normalized)) {
      return null;
    }
    
    if (normalized.length < 1 || normalized.length > 6) {
      return null;
    }
    
    if (!/[A-Z]/.test(normalized)) {
      return null;
    }
    
    return normalized;
  }

  normalizeCompanyName(name: string | undefined, ticker: string): string {
    if (name) {
      return name.trim();
    }
    
    if (this.tickerToCompany.has(ticker)) {
      return this.tickerToCompany.get(ticker)!;
    }
    
    return ticker;
  }

  normalizeDirection(direction: string): 'LONG' | 'SHORT' | 'NEUTRAL' {
    const upper = direction.toUpperCase();
    if (upper === 'LONG' || upper === 'BUY' || upper === 'BULLISH') {
      return 'LONG';
    }
    if (upper === 'SHORT' || upper === 'SELL' || upper === 'BEARISH') {
      return 'SHORT';
    }
    return 'NEUTRAL';
  }

  calculateAggregatedConfidence(sources: NormalizedIdea['sources']): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (sources.length === 0) return 'LOW';
    
    const scores = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    
    let totalScore = 0;
    for (const source of sources) {
      totalScore += scores[source.confidence];
      
      if (source.type === 'substack') {
        totalScore += 0.5;
      }
    }
    
    if (sources.length >= 3) {
      totalScore += 2;
    } else if (sources.length >= 2) {
      totalScore += 1;
    }
    
    const avgScore = totalScore / sources.length;
    
    if (avgScore >= 2.5) return 'HIGH';
    if (avgScore >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  calculateConsensusDirection(directions: string[]): 'LONG' | 'SHORT' | 'MIXED' | 'NEUTRAL' {
    const counts = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
    
    for (const dir of directions) {
      const normalized = this.normalizeDirection(dir);
      counts[normalized]++;
    }
    
    const total = directions.length;
    
    if (counts.LONG / total > 0.7) return 'LONG';
    if (counts.SHORT / total > 0.7) return 'SHORT';
    if (counts.NEUTRAL / total > 0.5) return 'NEUTRAL';
    if (counts.LONG > 0 && counts.SHORT > 0) return 'MIXED';
    if (counts.LONG > counts.SHORT) return 'LONG';
    if (counts.SHORT > counts.LONG) return 'SHORT';
    
    return 'NEUTRAL';
  }

  mergeTheses(theses: string[]): string {
    if (theses.length === 0) return '';
    if (theses.length === 1) return theses[0];
    
    const sortedByLength = [...theses].sort((a, b) => b.length - a.length);
    const primaryThesis = sortedByLength[0];
    
    if (theses.length >= 2) {
      return `[Consensus from ${theses.length} sources] ${primaryThesis}`;
    }
    
    return primaryThesis;
  }

  normalizeAndDeduplicate(rawIdeas: RawIdea[]): NormalizedIdea[] {
    console.log(`[IdeaNormalizer] Processing ${rawIdeas.length} raw ideas...`);
    
    const ideaMap = new Map<string, {
      idea: Partial<NormalizedIdea>;
      theses: string[];
      directions: string[];
    }>();
    
    for (const raw of rawIdeas) {
      const normalizedTicker = this.normalizeTicker(raw.ticker);
      if (!normalizedTicker) {
        console.log(`[IdeaNormalizer] Skipping invalid ticker: ${raw.ticker}`);
        continue;
      }
      
      if (ideaMap.has(normalizedTicker)) {
        const existing = ideaMap.get(normalizedTicker)!;
        
        existing.idea.sources!.push({
          type: raw.source.type,
          name: raw.source.name,
          url: raw.source.url,
          author: raw.source.author,
          publishedAt: raw.source.publishedAt,
          confidence: raw.confidence,
          rawQuote: raw.rawQuote,
        });
        
        existing.theses.push(raw.thesis);
        existing.directions.push(raw.direction);
        existing.idea.mentionCount = (existing.idea.mentionCount || 0) + 1;
        
        if (raw.source.publishedAt < existing.idea.firstSeenAt!) {
          existing.idea.firstSeenAt = raw.source.publishedAt;
        }
        if (raw.source.publishedAt > existing.idea.lastSeenAt!) {
          existing.idea.lastSeenAt = raw.source.publishedAt;
        }
        
      } else {
        ideaMap.set(normalizedTicker, {
          idea: {
            ticker: normalizedTicker,
            companyName: this.normalizeCompanyName(raw.companyName, normalizedTicker),
            sources: [{
              type: raw.source.type,
              name: raw.source.name,
              url: raw.source.url,
              author: raw.source.author,
              publishedAt: raw.source.publishedAt,
              confidence: raw.confidence,
              rawQuote: raw.rawQuote,
            }],
            mentionCount: 1,
            firstSeenAt: raw.source.publishedAt,
            lastSeenAt: raw.source.publishedAt,
            normalizedAt: new Date(),
          },
          theses: [raw.thesis],
          directions: [raw.direction],
        });
      }
    }
    
    const normalizedIdeas: NormalizedIdea[] = [];
    
    for (const [, data] of ideaMap) {
      const idea = data.idea as NormalizedIdea;
      
      idea.thesis = this.mergeTheses(data.theses);
      idea.direction = this.normalizeDirection(data.directions[0]);
      idea.consensusDirection = this.calculateConsensusDirection(data.directions);
      idea.aggregatedConfidence = this.calculateAggregatedConfidence(idea.sources);
      
      normalizedIdeas.push(idea);
    }
    
    normalizedIdeas.sort((a, b) => {
      const confScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const confDiff = confScore[b.aggregatedConfidence] - confScore[a.aggregatedConfidence];
      if (confDiff !== 0) return confDiff;
      return b.mentionCount - a.mentionCount;
    });
    
    console.log(`[IdeaNormalizer] Normalized to ${normalizedIdeas.length} unique ideas`);
    
    return normalizedIdeas;
  }
}

export default IdeaNormalizer;
