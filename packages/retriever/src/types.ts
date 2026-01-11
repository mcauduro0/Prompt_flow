/**
 * ARC Investment Factory - Retriever Types
 */

export interface CompanyProfile {
  ticker: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry: string;
  country: string;
  currency: string;
  marketCap: number | null;
  description: string;
  website: string;
  ceo: string;
  employees: number | null;
}

export interface FinancialMetrics {
  ticker: string;
  asOf: string;
  marketCapUsd: number | null;
  evToEbitda: number | null;
  pe: number | null;
  fcfYield: number | null;
  revenueCagr3y: number | null;
  ebitMargin: number | null;
  netDebtToEbitda: number | null;
  grossMargin: number | null;
  roic: number | null;
  roe: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
}

export interface IncomeStatement {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  ebitda: number;
  eps: number;
  dilutedEps: number;
}

export interface BalanceSheet {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cash: number;
  totalDebt: number;
  netDebt: number;
}

export interface CashFlowStatement {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  dividendsPaid: number;
  shareRepurchases: number;
}

export interface StockPrice {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  tickers: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface SECFiling {
  accessionNumber: string;
  formType: string;
  filingDate: string;
  ticker: string;
  companyName: string;
  url: string;
  description: string;
}

export interface EarningsTranscript {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter: number;
  date: string;
  content: string;
  participants: string[];
}

export interface AnalystEstimate {
  ticker: string;
  asOf: string;
  targetPriceLow: number;
  targetPriceHigh: number;
  targetPriceAvg: number;
  numberOfAnalysts: number;
  recommendationScore: number; // 1-5 scale
}

export interface DataSourceConfig {
  fmpApiKey?: string;
  polygonApiKey?: string;
  secUserAgent?: string;
}

export interface RetrieverResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  retrievedAt: string;
}
