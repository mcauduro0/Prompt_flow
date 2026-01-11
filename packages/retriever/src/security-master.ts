/**
 * ARC Investment Factory - Security Master
 * 
 * Handles security master normalization and universe coverage reporting.
 * 
 * Features:
 * - Ticker normalization (handle symbol changes, mergers, delistings)
 * - CUSIP/ISIN/SEDOL mapping
 * - Universe coverage tracking
 * - Data quality reporting
 */

import { z } from 'zod';

// ============================================================================
// SECURITY MASTER SCHEMA
// ============================================================================

/**
 * Security identifier types
 */
export const IdentifierTypeSchema = z.enum([
  'ticker',
  'cusip',
  'isin',
  'sedol',
  'figi',
  'cik',
  'permid',
]);

export type IdentifierType = z.infer<typeof IdentifierTypeSchema>;

/**
 * Security status
 */
export const SecurityStatusSchema = z.enum([
  'active',
  'delisted',
  'merged',
  'acquired',
  'bankrupt',
  'suspended',
]);

export type SecurityStatus = z.infer<typeof SecurityStatusSchema>;

/**
 * Security Master Record
 */
export const SecurityMasterRecordSchema = z.object({
  // Primary identifier
  security_id: z.string().min(1),
  
  // Identifiers
  ticker: z.string().min(1).max(10),
  cusip: z.string().length(9).optional(),
  isin: z.string().length(12).optional(),
  sedol: z.string().length(7).optional(),
  figi: z.string().length(12).optional(),
  cik: z.string().optional(),
  
  // Company info
  company_name: z.string().min(1),
  company_name_normalized: z.string().min(1),
  
  // Classification
  exchange: z.string().min(1),
  country: z.string().length(2),
  currency: z.string().length(3),
  sector: z.string().optional(),
  industry: z.string().optional(),
  sub_industry: z.string().optional(),
  
  // Market data
  market_cap: z.number().optional(),
  market_cap_category: z.enum(['mega', 'large', 'mid', 'small', 'micro', 'nano']).optional(),
  avg_daily_volume: z.number().optional(),
  
  // Status
  status: SecurityStatusSchema,
  status_date: z.string().datetime().optional(),
  
  // Corporate actions
  previous_tickers: z.array(z.string()).optional(),
  successor_ticker: z.string().optional(),
  
  // Metadata
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  data_sources: z.array(z.string()),
});

export type SecurityMasterRecord = z.infer<typeof SecurityMasterRecordSchema>;

/**
 * Ticker Change Event
 */
export const TickerChangeEventSchema = z.object({
  old_ticker: z.string(),
  new_ticker: z.string(),
  effective_date: z.string().datetime(),
  reason: z.enum(['symbol_change', 'merger', 'acquisition', 'spin_off', 'delisting']),
  notes: z.string().optional(),
});

export type TickerChangeEvent = z.infer<typeof TickerChangeEventSchema>;

// ============================================================================
// UNIVERSE COVERAGE
// ============================================================================

/**
 * Universe definition
 */
export const UniverseDefinitionSchema = z.object({
  universe_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Filters
  filters: z.object({
    exchanges: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    market_cap_min: z.number().optional(),
    market_cap_max: z.number().optional(),
    sectors: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
    avg_volume_min: z.number().optional(),
    custom_list: z.array(z.string()).optional(),
  }),
  
  // Metadata
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UniverseDefinition = z.infer<typeof UniverseDefinitionSchema>;

/**
 * Universe Coverage Report
 */
export const UniverseCoverageReportSchema = z.object({
  universe_id: z.string(),
  universe_name: z.string(),
  report_date: z.string().datetime(),
  
  // Coverage stats
  total_securities: z.number().int(),
  covered_securities: z.number().int(),
  coverage_rate: z.number().min(0).max(1),
  
  // By data source
  coverage_by_source: z.record(z.object({
    covered: z.number().int(),
    missing: z.number().int(),
    stale: z.number().int(),
    rate: z.number().min(0).max(1),
  })),
  
  // By data type
  coverage_by_data_type: z.record(z.object({
    covered: z.number().int(),
    missing: z.number().int(),
    rate: z.number().min(0).max(1),
  })),
  
  // Missing securities
  missing_securities: z.array(z.object({
    ticker: z.string(),
    company_name: z.string(),
    missing_sources: z.array(z.string()),
    missing_data_types: z.array(z.string()),
  })),
  
  // Stale data
  stale_securities: z.array(z.object({
    ticker: z.string(),
    company_name: z.string(),
    stale_sources: z.array(z.object({
      source: z.string(),
      last_update: z.string().datetime(),
      days_stale: z.number().int(),
    })),
  })),
  
  // Quality metrics
  quality_metrics: z.object({
    completeness_score: z.number().min(0).max(1),
    freshness_score: z.number().min(0).max(1),
    accuracy_score: z.number().min(0).max(1),
    overall_quality_score: z.number().min(0).max(1),
  }),
});

export type UniverseCoverageReport = z.infer<typeof UniverseCoverageReportSchema>;

// ============================================================================
// SECURITY MASTER SERVICE
// ============================================================================

export interface SecurityMasterConfig {
  primarySource: 'fmp' | 'polygon' | 'sec';
  staleDaysThreshold: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
}

export interface SecurityMasterRepository {
  getByTicker(ticker: string): Promise<SecurityMasterRecord | null>;
  getByIdentifier(type: IdentifierType, value: string): Promise<SecurityMasterRecord | null>;
  getByUniverseFilter(filters: UniverseDefinition['filters']): Promise<SecurityMasterRecord[]>;
  upsert(record: SecurityMasterRecord): Promise<void>;
  recordTickerChange(event: TickerChangeEvent): Promise<void>;
  getTickerHistory(ticker: string): Promise<TickerChangeEvent[]>;
}

/**
 * Security Master Service
 */
export class SecurityMasterService {
  private config: SecurityMasterConfig;
  private repository: SecurityMasterRepository;
  private cache: Map<string, { record: SecurityMasterRecord; expiresAt: number }> = new Map();

  constructor(config: SecurityMasterConfig, repository: SecurityMasterRepository) {
    this.config = config;
    this.repository = repository;
  }

  // -------------------------------------------------------------------------
  // TICKER NORMALIZATION
  // -------------------------------------------------------------------------

  /**
   * Normalize a ticker symbol
   * Handles historical ticker changes, mergers, etc.
   */
  async normalizeTicker(ticker: string): Promise<{
    normalized_ticker: string;
    is_current: boolean;
    changes: TickerChangeEvent[];
    security?: SecurityMasterRecord;
  }> {
    const upperTicker = ticker.toUpperCase().trim();
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(upperTicker);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          normalized_ticker: cached.record.ticker,
          is_current: cached.record.status === 'active',
          changes: [],
          security: cached.record,
        };
      }
    }

    // Look up in repository
    let security = await this.repository.getByTicker(upperTicker);
    const changes: TickerChangeEvent[] = [];

    // If not found, check ticker history
    if (!security) {
      const history = await this.repository.getTickerHistory(upperTicker);
      if (history.length > 0) {
        // Follow the chain to current ticker
        let currentTicker = upperTicker;
        for (const event of history) {
          if (event.old_ticker === currentTicker) {
            changes.push(event);
            currentTicker = event.new_ticker;
          }
        }
        security = await this.repository.getByTicker(currentTicker);
      }
    }

    if (security) {
      // Update cache
      if (this.config.cacheEnabled) {
        this.cache.set(upperTicker, {
          record: security,
          expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
        });
      }

      return {
        normalized_ticker: security.ticker,
        is_current: security.status === 'active',
        changes,
        security,
      };
    }

    return {
      normalized_ticker: upperTicker,
      is_current: false,
      changes: [],
    };
  }

  /**
   * Resolve multiple identifiers to a single security
   */
  async resolveIdentifiers(identifiers: Partial<Record<IdentifierType, string>>): Promise<SecurityMasterRecord | null> {
    // Try each identifier type in order of reliability
    const priority: IdentifierType[] = ['isin', 'cusip', 'figi', 'sedol', 'cik', 'ticker'];
    
    for (const type of priority) {
      const value = identifiers[type];
      if (value) {
        const security = await this.repository.getByIdentifier(type, value);
        if (security) {
          return security;
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // UNIVERSE COVERAGE
  // -------------------------------------------------------------------------

  /**
   * Generate universe coverage report
   */
  async generateCoverageReport(
    universe: UniverseDefinition,
    dataAvailability: Map<string, { sources: string[]; dataTypes: string[]; lastUpdate: Date }>
  ): Promise<UniverseCoverageReport> {
    // Get all securities in universe
    const securities = await this.repository.getByUniverseFilter(universe.filters);
    
    const now = new Date();
    const coverageBySource: Record<string, { covered: number; missing: number; stale: number; rate: number }> = {};
    const coverageByDataType: Record<string, { covered: number; missing: number; rate: number }> = {};
    const missingSecurities: UniverseCoverageReport['missing_securities'] = [];
    const staleSecurities: UniverseCoverageReport['stale_securities'] = [];
    
    // Define expected sources and data types
    const expectedSources = ['fmp', 'polygon', 'sec_edgar'];
    const expectedDataTypes = ['price', 'fundamentals', 'filings', 'transcripts'];
    
    // Initialize counters
    for (const source of expectedSources) {
      coverageBySource[source] = { covered: 0, missing: 0, stale: 0, rate: 0 };
    }
    for (const dataType of expectedDataTypes) {
      coverageByDataType[dataType] = { covered: 0, missing: 0, rate: 0 };
    }
    
    let coveredCount = 0;
    
    for (const security of securities) {
      const availability = dataAvailability.get(security.ticker);
      
      if (!availability) {
        // No data at all
        missingSecurities.push({
          ticker: security.ticker,
          company_name: security.company_name,
          missing_sources: expectedSources,
          missing_data_types: expectedDataTypes,
        });
        
        for (const source of expectedSources) {
          coverageBySource[source].missing++;
        }
        for (const dataType of expectedDataTypes) {
          coverageByDataType[dataType].missing++;
        }
        continue;
      }
      
      // Check each source
      const missingSources: string[] = [];
      const staleSources: { source: string; last_update: string; days_stale: number }[] = [];
      
      for (const source of expectedSources) {
        if (availability.sources.includes(source)) {
          const daysSinceUpdate = Math.floor((now.getTime() - availability.lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceUpdate > this.config.staleDaysThreshold) {
            coverageBySource[source].stale++;
            staleSources.push({
              source,
              last_update: availability.lastUpdate.toISOString(),
              days_stale: daysSinceUpdate,
            });
          } else {
            coverageBySource[source].covered++;
          }
        } else {
          coverageBySource[source].missing++;
          missingSources.push(source);
        }
      }
      
      // Check each data type
      const missingDataTypes: string[] = [];
      for (const dataType of expectedDataTypes) {
        if (availability.dataTypes.includes(dataType)) {
          coverageByDataType[dataType].covered++;
        } else {
          coverageByDataType[dataType].missing++;
          missingDataTypes.push(dataType);
        }
      }
      
      // Track missing/stale
      if (missingSources.length > 0 || missingDataTypes.length > 0) {
        missingSecurities.push({
          ticker: security.ticker,
          company_name: security.company_name,
          missing_sources: missingSources,
          missing_data_types: missingDataTypes,
        });
      }
      
      if (staleSources.length > 0) {
        staleSecurities.push({
          ticker: security.ticker,
          company_name: security.company_name,
          stale_sources: staleSources,
        });
      }
      
      // Count as covered if has at least one source
      if (availability.sources.length > 0) {
        coveredCount++;
      }
    }
    
    // Calculate rates
    for (const source of expectedSources) {
      const total = coverageBySource[source].covered + coverageBySource[source].missing + coverageBySource[source].stale;
      coverageBySource[source].rate = total > 0 ? coverageBySource[source].covered / total : 0;
    }
    for (const dataType of expectedDataTypes) {
      const total = coverageByDataType[dataType].covered + coverageByDataType[dataType].missing;
      coverageByDataType[dataType].rate = total > 0 ? coverageByDataType[dataType].covered / total : 0;
    }
    
    // Calculate quality metrics
    const coverageRate = securities.length > 0 ? coveredCount / securities.length : 0;
    const freshnessRate = securities.length > 0 ? (securities.length - staleSecurities.length) / securities.length : 0;
    
    // Calculate average source coverage rate
    const avgSourceRate = Object.values(coverageBySource).reduce((sum, s) => sum + s.rate, 0) / expectedSources.length;
    
    return {
      universe_id: universe.universe_id,
      universe_name: universe.name,
      report_date: now.toISOString(),
      total_securities: securities.length,
      covered_securities: coveredCount,
      coverage_rate: coverageRate,
      coverage_by_source: coverageBySource,
      coverage_by_data_type: coverageByDataType,
      missing_securities: missingSecurities.slice(0, 100), // Limit to top 100
      stale_securities: staleSecurities.slice(0, 100),
      quality_metrics: {
        completeness_score: coverageRate,
        freshness_score: freshnessRate,
        accuracy_score: avgSourceRate, // Proxy for accuracy
        overall_quality_score: (coverageRate + freshnessRate + avgSourceRate) / 3,
      },
    };
  }

  // -------------------------------------------------------------------------
  // DATA QUALITY
  // -------------------------------------------------------------------------

  /**
   * Check data quality for a security
   */
  async checkDataQuality(ticker: string): Promise<{
    ticker: string;
    has_basic_info: boolean;
    has_identifiers: boolean;
    has_classification: boolean;
    has_market_data: boolean;
    quality_score: number;
    issues: string[];
  }> {
    const security = await this.repository.getByTicker(ticker);
    const issues: string[] = [];
    
    if (!security) {
      return {
        ticker,
        has_basic_info: false,
        has_identifiers: false,
        has_classification: false,
        has_market_data: false,
        quality_score: 0,
        issues: ['Security not found in master'],
      };
    }
    
    // Check basic info
    const hasBasicInfo = !!(security.ticker && security.company_name && security.exchange);
    if (!hasBasicInfo) {
      issues.push('Missing basic info (ticker, company_name, or exchange)');
    }
    
    // Check identifiers
    const hasIdentifiers = !!(security.cusip || security.isin || security.figi);
    if (!hasIdentifiers) {
      issues.push('Missing standard identifiers (CUSIP, ISIN, or FIGI)');
    }
    
    // Check classification
    const hasClassification = !!(security.sector && security.industry);
    if (!hasClassification) {
      issues.push('Missing sector/industry classification');
    }
    
    // Check market data
    const hasMarketData = !!(security.market_cap && security.avg_daily_volume);
    if (!hasMarketData) {
      issues.push('Missing market data (market_cap or avg_daily_volume)');
    }
    
    // Calculate quality score
    let score = 0;
    if (hasBasicInfo) score += 0.3;
    if (hasIdentifiers) score += 0.3;
    if (hasClassification) score += 0.2;
    if (hasMarketData) score += 0.2;
    
    return {
      ticker,
      has_basic_info: hasBasicInfo,
      has_identifiers: hasIdentifiers,
      has_classification: hasClassification,
      has_market_data: hasMarketData,
      quality_score: score,
      issues,
    };
  }

  /**
   * Get market cap category
   */
  getMarketCapCategory(marketCap: number): SecurityMasterRecord['market_cap_category'] {
    if (marketCap >= 200_000_000_000) return 'mega';      // $200B+
    if (marketCap >= 10_000_000_000) return 'large';      // $10B-$200B
    if (marketCap >= 2_000_000_000) return 'mid';         // $2B-$10B
    if (marketCap >= 300_000_000) return 'small';         // $300M-$2B
    if (marketCap >= 50_000_000) return 'micro';          // $50M-$300M
    return 'nano';                                         // <$50M
  }

  /**
   * Normalize company name for matching
   */
  normalizeCompanyName(name: string): string {
    return name
      .toUpperCase()
      .replace(/[.,]/g, '')
      .replace(/\s+(INC|CORP|CORPORATION|LTD|LIMITED|LLC|LP|PLC|CO|COMPANY)\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ============================================================================
// PREDEFINED UNIVERSES
// ============================================================================

export const PREDEFINED_UNIVERSES: Record<string, UniverseDefinition> = {
  US_LARGE_CAP: {
    universe_id: 'us_large_cap',
    name: 'US Large Cap',
    description: 'US-listed securities with market cap >= $10B',
    filters: {
      exchanges: ['NYSE', 'NASDAQ'],
      countries: ['US'],
      market_cap_min: 10_000_000_000,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  US_MID_CAP: {
    universe_id: 'us_mid_cap',
    name: 'US Mid Cap',
    description: 'US-listed securities with market cap $2B-$10B',
    filters: {
      exchanges: ['NYSE', 'NASDAQ'],
      countries: ['US'],
      market_cap_min: 2_000_000_000,
      market_cap_max: 10_000_000_000,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  US_SMALL_CAP: {
    universe_id: 'us_small_cap',
    name: 'US Small Cap',
    description: 'US-listed securities with market cap $300M-$2B',
    filters: {
      exchanges: ['NYSE', 'NASDAQ'],
      countries: ['US'],
      market_cap_min: 300_000_000,
      market_cap_max: 2_000_000_000,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  GLOBAL_EQUITIES: {
    universe_id: 'global_equities',
    name: 'Global Equities',
    description: 'Global equities with market cap >= $1B and adequate liquidity',
    filters: {
      market_cap_min: 1_000_000_000,
      avg_volume_min: 100_000,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SecurityMasterRecordSchema,
  TickerChangeEventSchema,
  UniverseDefinitionSchema,
  UniverseCoverageReportSchema,
  SecurityMasterService,
  PREDEFINED_UNIVERSES,
};
