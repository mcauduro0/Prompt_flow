/**
 * ARC Investment Factory - SEC EDGAR Data Source
 * SEC EDGAR API client for filings
 */

import type { SECFiling, RetrieverResult } from '../types.js';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_EFTS_URL = 'https://efts.sec.gov/LATEST/search-index';

export class SECEdgarClient {
  private userAgent: string;

  constructor(userAgent?: string) {
    // SEC requires a user agent with contact info
    this.userAgent = userAgent ?? process.env.SEC_USER_AGENT ?? 'ARC-Investment-Factory/1.0 (contact@example.com)';
  }

  private async fetch<T>(url: string): Promise<RetrieverResult<T>> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `SEC API error: ${response.status} ${response.statusText}`,
          source: 'sec-edgar',
          retrievedAt: new Date().toISOString(),
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
        source: 'sec-edgar',
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `SEC fetch error: ${(error as Error).message}`,
        source: 'sec-edgar',
        retrievedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get CIK number for a ticker
   */
  async getCIK(ticker: string): Promise<string | null> {
    const result = await this.fetch<Record<string, any>>(
      `${SEC_BASE_URL}/submissions/CIK${ticker.toUpperCase().padStart(10, '0')}.json`
    );

    if (result.success && result.data?.cik) {
      return result.data.cik;
    }

    // Try company tickers lookup
    const tickersResult = await this.fetch<Record<string, any>>(
      `${SEC_BASE_URL}/files/company_tickers.json`
    );

    if (tickersResult.success && tickersResult.data) {
      for (const key of Object.keys(tickersResult.data)) {
        const company = tickersResult.data[key];
        if (company.ticker?.toUpperCase() === ticker.toUpperCase()) {
          return company.cik_str?.toString().padStart(10, '0');
        }
      }
    }

    return null;
  }

  /**
   * Get company filings
   */
  async getFilings(
    ticker: string,
    formTypes?: string[],
    limit = 20
  ): Promise<RetrieverResult<SECFiling[]>> {
    const cik = await this.getCIK(ticker);
    if (!cik) {
      return {
        success: false,
        error: `Could not find CIK for ticker ${ticker}`,
        source: 'sec-edgar',
        retrievedAt: new Date().toISOString(),
      };
    }

    const result = await this.fetch<any>(
      `${SEC_BASE_URL}/submissions/CIK${cik}.json`
    );

    if (!result.success || !result.data?.filings?.recent) {
      return { ...result, data: undefined };
    }

    const recent = result.data.filings.recent;
    const filings: SECFiling[] = [];

    for (let i = 0; i < Math.min(recent.accessionNumber.length, limit * 3); i++) {
      const formType = recent.form[i];
      
      // Filter by form types if specified
      if (formTypes && formTypes.length > 0 && !formTypes.includes(formType)) {
        continue;
      }

      filings.push({
        accessionNumber: recent.accessionNumber[i],
        formType,
        filingDate: recent.filingDate[i],
        ticker: ticker.toUpperCase(),
        companyName: result.data.name,
        url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
        description: recent.primaryDocDescription?.[i] ?? formType,
      });

      if (filings.length >= limit) break;
    }

    return {
      success: true,
      data: filings,
      source: 'sec-edgar',
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Get recent 10-K filings
   */
  async get10K(ticker: string, limit = 5): Promise<RetrieverResult<SECFiling[]>> {
    return this.getFilings(ticker, ['10-K', '10-K/A'], limit);
  }

  /**
   * Get recent 10-Q filings
   */
  async get10Q(ticker: string, limit = 8): Promise<RetrieverResult<SECFiling[]>> {
    return this.getFilings(ticker, ['10-Q', '10-Q/A'], limit);
  }

  /**
   * Get recent 8-K filings
   */
  async get8K(ticker: string, limit = 10): Promise<RetrieverResult<SECFiling[]>> {
    return this.getFilings(ticker, ['8-K', '8-K/A'], limit);
  }

  /**
   * Get proxy statements (DEF 14A)
   */
  async getProxyStatements(ticker: string, limit = 3): Promise<RetrieverResult<SECFiling[]>> {
    return this.getFilings(ticker, ['DEF 14A', 'DEFA14A'], limit);
  }

  /**
   * Get insider transactions (Form 4)
   */
  async getInsiderTransactions(ticker: string, limit = 20): Promise<RetrieverResult<SECFiling[]>> {
    return this.getFilings(ticker, ['4', '4/A'], limit);
  }

  /**
   * Search filings by keyword (full-text search)
   */
  async searchFilings(
    query: string,
    options: {
      ticker?: string;
      formTypes?: string[];
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    } = {}
  ): Promise<RetrieverResult<SECFiling[]>> {
    // Build EFTS query
    const params = new URLSearchParams();
    params.set('q', query);
    if (options.ticker) params.set('company', options.ticker);
    if (options.formTypes?.length) params.set('forms', options.formTypes.join(','));
    if (options.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params.set('dateTo', options.dateTo);
    params.set('from', '0');
    params.set('size', (options.limit ?? 20).toString());

    const result = await this.fetch<any>(`${SEC_EFTS_URL}?${params.toString()}`);

    if (!result.success || !result.data?.hits?.hits) {
      return { ...result, data: undefined };
    }

    return {
      success: true,
      data: result.data.hits.hits.map((hit: any) => ({
        accessionNumber: hit._source.adsh,
        formType: hit._source.form,
        filingDate: hit._source.file_date,
        ticker: hit._source.tickers?.[0] ?? '',
        companyName: hit._source.display_names?.[0] ?? hit._source.company,
        url: hit._source.file_url ?? '',
        description: hit._source.file_description ?? '',
      })),
      source: 'sec-edgar',
      retrievedAt: new Date().toISOString(),
    };
  }
}

/**
 * Create SEC EDGAR client with default configuration
 */
export function createSECEdgarClient(userAgent?: string): SECEdgarClient {
  return new SECEdgarClient(userAgent);
}
